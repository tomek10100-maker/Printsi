import { createClient } from '@supabase/supabase-js';
import { sendDigitalFileEmail } from './sendDigitalFileEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr', CHF: 'Fr',
};

async function convertFromEur(amountEur: number, toCurrency: string): Promise<string> {
  const FALLBACK_RATES: Record<string, number> = {
    PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96,
  };
  try {
    if (toCurrency === 'EUR') return `€${amountEur.toFixed(2)}`;
    let rate = FALLBACK_RATES[toCurrency] || 1;
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (res.ok) {
        const json = await res.json();
        if (json.rates?.[toCurrency]) rate = json.rates[toCurrency];
      }
    } catch { console.warn('⚠️ Exchange API failed, using fallback rate for', toCurrency); }
    const converted = Math.ceil(amountEur * rate * 100) / 100;
    if (toCurrency === 'PLN') return `${converted.toFixed(2)} zł`;
    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + ' ';
    return `${symbol}${converted.toFixed(2)}`;
  } catch {
    return `€${amountEur.toFixed(2)}`;
  }
}

async function getSellerCurrency(sellerId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('currency').eq('id', sellerId).single();
  return data?.currency || 'EUR';
}

async function decrementFilamentStock(layers: { filament_id?: string; grams?: string | number }[], quantity: number): Promise<string[]> {
  const affectedFilamentIds: string[] = [];
  if (!layers || layers.length === 0) return affectedFilamentIds;
  for (const layer of layers) {
    if (!layer.filament_id || !layer.grams) continue;
    const gramsPerPiece = parseFloat(String(layer.grams));
    if (isNaN(gramsPerPiece) || gramsPerPiece <= 0) continue;
    const totalGrams = gramsPerPiece * quantity;
    const { error } = await supabase.rpc('decrement_filament_stock', {
      filament_id: layer.filament_id,
      grams_used: totalGrams,
    });
    if (error) console.error(`❌ Filament stock error for ${layer.filament_id}:`, error);
    else {
      console.log(`✅ Filament ${layer.filament_id} -${totalGrams}g (qty ${quantity} × ${gramsPerPiece}g)`);
      affectedFilamentIds.push(layer.filament_id);
    }
  }
  return affectedFilamentIds;
}

/**
 * After filament stock is deducted, recalculate the stock of ALL offers
 * by the same seller that use any of the affected filament IDs.
 * This ensures that if two products share the same filament,
 * selling one can make the other go sold out.
 */
async function recalculateOffersStockForFilaments(sellerId: string, affectedFilamentIds: string[]) {
  if (!affectedFilamentIds.length) return;

  // 1. Get current stock of affected filaments
  const { data: filaments, error: filErr } = await supabase
    .from('filaments')
    .select('id, stock_grams')
    .in('id', affectedFilamentIds);

  if (filErr || !filaments) {
    console.error('❌ Could not fetch filament stock for recalculation:', filErr);
    return;
  }

  const filamentStockMap: Record<string, number> = {};
  filaments.forEach(f => { filamentStockMap[f.id] = f.stock_grams ?? 0; });

  // 2. Find all offers by this seller that have color_variants using these filaments
  const { data: offers, error: offErr } = await supabase
    .from('offers')
    .select('id, color_variants, stock')
    .eq('user_id', sellerId)
    .not('color_variants', 'is', null);

  if (offErr || !offers) {
    console.error('❌ Could not fetch offers for recalculation:', offErr);
    return;
  }

  for (const offer of offers) {
    const variants: any[] = offer.color_variants || [];
    let totalNewStock = 0;
    let usesAffectedFilament = false;

    for (const variant of variants) {
      const layers: any[] = variant.layers || [];
      let variantMaxPieces = Infinity;
      let variantUsesAffected = false;

      for (const layer of layers) {
        if (!layer.filament_id || !layer.grams) continue;
        const g = parseFloat(String(layer.grams));
        if (isNaN(g) || g <= 0) continue;

        if (affectedFilamentIds.includes(layer.filament_id)) {
          variantUsesAffected = true;
          const remaining = filamentStockMap[layer.filament_id] ?? 0;
          variantMaxPieces = Math.min(variantMaxPieces, Math.floor(remaining / g));
        }
      }

      if (variantUsesAffected) {
        usesAffectedFilament = true;
        // Update the variant stock in the color_variants array
        const newVarStock = Math.max(0, variantMaxPieces === Infinity ? 0 : variantMaxPieces);
        variant.stock = newVarStock;
        totalNewStock += newVarStock;
      } else {
        totalNewStock += (variant.stock || 0);
      }
    }

    if (usesAffectedFilament) {
      const { error: updateErr } = await supabase
        .from('offers')
        .update({ stock: totalNewStock, color_variants: variants })
        .eq('id', offer.id);

      if (updateErr) console.error(`❌ Stock recalc failed for offer ${offer.id}:`, updateErr);
      else console.log(`🔄 Offer ${offer.id} stock recalculated → ${totalNewStock}`);
    }
  }
}

/**
 * Core order processing: creates chats, sends messages, notifications, decrements stock.
 * Called after a confirmed payment (balance or Stripe).
 */
export async function processOrder(orderId: string, userId: string) {
  console.log(`🔄 processOrder: orderId=${orderId}, userId=${userId}`);

  // 1. Fetch all order items
  const { data: orderItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, offer_id, seller_id, quantity, price_at_purchase')
    .eq('order_id', orderId);

  if (itemsErr || !orderItems?.length) {
    console.error('❌ Could not fetch order items:', itemsErr);
    return { success: false, error: 'Order items not found' };
  }

  console.log(`📦 Found ${orderItems.length} order item(s)`);

  // 2. Fetch offer details
  const offerIds = orderItems.map(i => i.offer_id);
  const { data: offers } = await supabase
    .from('offers')
    .select('id, title, is_custom, parent_offer_id, color_variants, category, file_url')
    .in('id', offerIds);

  const offerMap: Record<string, any> = {};
  (offers || []).forEach(o => { offerMap[o.id] = o; });

  // Fetch buyer info
  const { data: buyerShipping } = await supabase
    .from('order_shipping_details')
    .select('email, full_name')
    .eq('order_id', orderId)
    .maybeSingle();

  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  // Get buyer email safely - non-fatal if it fails
  let buyerEmail = buyerShipping?.email || '';
  let buyerName = buyerShipping?.full_name || buyerProfile?.full_name || 'Customer';
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    if (authData?.user?.email && !buyerEmail) buyerEmail = authData.user.email;
  } catch (authErr) {
    console.warn('⚠️ Could not get buyer auth email (non-fatal):', authErr);
  }

  const results: string[] = [];

  for (const item of orderItems) {
    const offer = offerMap[item.offer_id] || {};
    const isCustom = offer.is_custom;
    const parentOfferId = offer.parent_offer_id;
    const title = offer.title || 'your item';
    const chatOfferId = (isCustom && parentOfferId) ? parentOfferId : item.offer_id;
    const sellerId = item.seller_id;

    if (!sellerId) { console.warn('⚠️ No sellerId for item', item.offer_id); continue; }

    // 3. Create / find chat thread
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('buyer_id', userId)
      .eq('seller_id', sellerId)
      .eq('offer_id', chatOfferId)
      .maybeSingle();

    let chatId = existingChat?.id;

    if (!chatId) {
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ buyer_id: userId, seller_id: sellerId, offer_id: chatOfferId, order_id: orderId })
        .select('id')
        .single();

      if (chatErr) {
        console.error('❌ Failed to create chat:', chatErr);
        results.push(`chat_fail:${item.offer_id}`);
        continue;
      }
      chatId = newChat.id;
      console.log(`💬 Chat created: ${chatId}`);
      results.push(`chat_created:${chatId}`);
    } else {
      await supabase.from('chats').update({ order_id: orderId }).eq('id', chatId);
      results.push(`chat_updated:${chatId}`);
    }

    // 4. System message: order confirmed
    const msgOrder = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content: `New order: ${item.quantity}x "${title}" has been purchased successfully.`,
      message_type: 'system',
    });
    if (msgOrder.error) console.error('❌ Order message failed:', msgOrder.error);

    // Auto-complete if digital, else remind about 4 days limit
    if (offer.category === 'digital') {
      await supabase.from('order_items').update({ status: 'completed' }).eq('id', item.id);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `Digital file delivered automatically. Transaction completed!`,
        message_type: 'status_completed',
      });
    } else {
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `The seller has 4 days to ship the item. Use the confirmation buttons below to track delivery progress.`,
        message_type: 'system',
      });
    }

    // 5. Notify seller
    try {
      const sellerCurrency = await getSellerCurrency(sellerId);
      const earnedEur = item.price_at_purchase * item.quantity;
      const formattedAmount = await convertFromEur(earnedEur, sellerCurrency);
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: sellerId,
        title: '🎉 New sale!',
        message: offer.category === 'digital' 
          ? `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds added to your Printsi balance.`
          : `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds added to Pending Balance.`,
        type: 'sale',
        is_read: false,
      });
      if (notifErr) console.error('❌ Seller notification failed:', notifErr);
    } catch (notifErr) {
      console.error('❌ Seller notification threw:', notifErr);
    }

    // 6. Decrement offer stock
    await supabase.rpc('decrement_stock', { row_id: item.offer_id, quantity_amt: item.quantity });
    if (isCustom && parentOfferId) {
      await supabase.rpc('decrement_stock', { row_id: parentOfferId, quantity_amt: item.quantity });
    }

    // 7. Decrement filament stock (use offer's color_variants layers as source)
    const colorVariants: any[] = offer.color_variants || [];
    const fallbackLayers = colorVariants[0]?.layers || [];
    if (fallbackLayers.length > 0) {
      const affectedFilamentIds = await decrementFilamentStock(fallbackLayers, item.quantity);
      // 7.5 Recalculate stock for ALL offers by this seller using same filaments
      if (affectedFilamentIds.length > 0) {
        await recalculateOffersStockForFilaments(sellerId, affectedFilamentIds);
      }
    }
  }

  // 8. Send digital file emails
  const digitalItems = orderItems.filter(item => {
    const offer = offerMap[item.offer_id];
    return offer?.category === 'digital' && offer?.file_url;
  });

  if (digitalItems.length > 0 && buyerEmail) {
    for (const item of digitalItems) {
      const offer = offerMap[item.offer_id];
      try {
        await sendDigitalFileEmail({
          buyerEmail,
          buyerName,
          productTitle: offer.title || 'Your 3D File',
          fileUrl: offer.file_url,
          orderId,
        });
      } catch (emailErr) {
        console.error(`❌ Could not send file email for offer ${item.offer_id}:`, emailErr);
      }
    }
  }

  console.log('✅ processOrder complete, results:', results);
  return { success: true, results };
}
