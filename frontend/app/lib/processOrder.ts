import { createClient } from '@supabase/supabase-js';
import { sendDigitalFileEmail } from './sendDigitalFileEmail';
import { sendEmail, EmailTemplates } from './emailService';
import { sendOutOfStockEmail, sendLowFilamentWarning } from './sendNotificationEmail';


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

  // 1. Get ALL filaments for this seller to ensure we have stock info for every required layer
  const { data: allFilaments, error: filErr } = await supabase
    .from('filaments')
    .select('id, stock_grams')
    .eq('user_id', sellerId);

  if (filErr || !allFilaments) {
    console.error('❌ Could not fetch filaments for recalculation:', filErr);
    return;
  }

  const filamentStockMap: Record<string, number> = {};
  allFilaments.forEach(f => { filamentStockMap[f.id] = f.stock_grams ?? 0; });

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
    let totalOfferNewStock = 0;
    let offerNeedsUpdate = false;

    // We only update the offer IF at least one of its variants uses one of the AFFECTED filaments.
    // (Optimization to avoid updating every single product every time).
    let anyVariantUsesAffected = false;

    const updatedVariants = variants.map(variant => {
      const layers: any[] = variant.layers || [];
      if (layers.length === 0) {
        totalOfferNewStock += (parseInt(variant.stock) || 0);
        return variant;
      }

      let variantUsesAffected = false;
      let variantMaxPieces = Infinity;
      let usesFilamentTracking = false;

      for (const layer of layers) {
        if (!layer.filament_id || !layer.grams) continue;
        const g = parseFloat(String(layer.grams));
        if (isNaN(g) || g <= 0) continue;

        usesFilamentTracking = true;
        if (affectedFilamentIds.includes(layer.filament_id)) {
          variantUsesAffected = true;
          anyVariantUsesAffected = true;
        }

        // IMPORTANT: We check stock for EVERY layer, not just affected ones
        const remaining = filamentStockMap[layer.filament_id] ?? 0;
        variantMaxPieces = Math.min(variantMaxPieces, Math.floor(remaining / g));
      }

      if (variantUsesAffected && variant.stockTracking !== 'manual') {
        const newVarStock = Math.max(0, variantMaxPieces === Infinity ? 0 : variantMaxPieces);
        totalOfferNewStock += newVarStock;
        offerNeedsUpdate = true;
        return { ...variant, stock: newVarStock };
      } else {
        totalOfferNewStock += (parseInt(variant.stock) || 0);
        return variant;
      }
    });

    if (anyVariantUsesAffected && offerNeedsUpdate) {
      const { error: updateErr } = await supabase
        .from('offers')
        .update({ stock: totalOfferNewStock, color_variants: updatedVariants })
        .eq('id', offer.id);

      if (updateErr) console.error(`❌ Stock recalc failed for offer ${offer.id}: ${updateErr.message}`);
      else console.log(`🔄 Offer ${offer.id} stock recalculated → ${totalOfferNewStock}`);
    }
  }
}


/**
 * Core order processing: creates chats, sends messages, notifications, decrements stock.
 * Called after a confirmed payment (balance or Stripe).
 */
export async function processOrder(orderId: string, userId: string) {
  console.log(`🔄 processOrder: orderId=${orderId}, userId=${userId}`);

  // 1. Fetch all order items (including variant_layers - the specific filament composition of what was bought)
  const { data: orderItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, offer_id, seller_id, quantity, price_at_purchase, variant_layers, variant_name')
    .eq('order_id', orderId);


  if (itemsErr || !orderItems?.length) {
    console.error('❌ Could not fetch order items:', itemsErr);
    return { success: false, error: 'Order items not found' };
  }

  console.log(`📦 Found ${orderItems.length} order item(s)`);

  // 2. Fetch offer details
  const offerIds = orderItems.map(i => i.offer_id);
  const { data: initialOffers } = await supabase
    .from('offers')
    .select('id, title, is_custom, parent_offer_id, color_variants, category, file_url')
    .in('id', offerIds);

  const offerMap: Record<string, any> = {};
  (initialOffers || []).forEach(o => { offerMap[o.id] = o; });

  // Fetch parent offers for custom items to ensure we have filament data for deduction
  const neededParentIds = (initialOffers || [])
    .filter(o => o.is_custom && o.parent_offer_id && !offerMap[o.parent_offer_id])
    .map(o => o.parent_offer_id);

  if (neededParentIds.length > 0) {
    const { data: parents } = await supabase
      .from('offers')
      .select('id, color_variants, file_url, category')
      .in('id', neededParentIds);
    (parents || []).forEach(p => { offerMap[p.id] = p; });
  }


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
  const buyerName = buyerShipping?.full_name || buyerProfile?.full_name || 'Customer';
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
      content: offer.category === 'job'
        ? `🖨️ Print job confirmed! Payment for ${item.quantity}x "${title}" has been received. The 3D file will be sent to the printer's email shortly.`
        : `New order: ${item.quantity}x "${title}" has been purchased successfully.`,
      message_type: 'system',
    });
    if (msgOrder.error) console.error('❌ Order message failed:', msgOrder.error);

    // Set to 'shipped' for digital (allows buyer to confirm/dispute), else remind about 4 days limit
    if (offer.category === 'digital') {
      await supabase.from('order_items').update({ status: 'shipped' }).eq('id', item.id);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `Digital file delivered automatically to your email. Please check it and confirm everything is correct!`,
        message_type: 'status_shipped',
      });
    } else if (offer.category === 'job') {
      // ── PRINT ON DEMAND FLOW ──
      // 1. Send the 3D file to the PRINTER (seller in order_items)
      const parentOffer = offer.parent_offer_id ? offerMap[offer.parent_offer_id] : null;
      const fileUrl = parentOffer?.file_url || offer.file_url;

      if (fileUrl) {
        try {
          // Get the printer's (seller's) email
          const { data: printerAuth } = await supabase.auth.admin.getUserById(sellerId);
          const printerEmail = printerAuth?.user?.email;
          const { data: printerProfile } = await supabase.from('profiles').select('full_name').eq('id', sellerId).single();
          const printerName = printerProfile?.full_name || 'Printer';

          if (printerEmail) {
            await sendDigitalFileEmail({
              buyerEmail: printerEmail,
              buyerName: printerName,
              productTitle: `Print Job: ${title}`,
              fileUrl,
              orderId,
            });
            console.log(`✅ 3D file sent to printer ${printerEmail} for job: ${title}`);
          }
        } catch (emailErr) {
          console.error(`❌ Could not send 3D file to printer:`, emailErr);
        }
      }

      // 2. Mark the original job listing as fulfilled (stock → 0)
      const jobListingId = offer.parent_offer_id || item.offer_id;
      await supabase.from('offers').update({ stock: 0 }).eq('id', jobListingId);
      console.log(`📦 Job listing ${jobListingId} marked as fulfilled (stock → 0)`);

      // 3. System messages explaining next steps
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `📧 The 3D file has been sent to the printer's email. The printer now has 4 days to print and ship the item. Track the progress below.`,
        message_type: 'system',
      });
    } else {
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `The seller has 4 days to ship the item. If not shipped within this time, the order will be cancelled. Use the confirmation buttons below to track delivery progress.`,
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
          ? `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds will be added to your balance once the buyer confirms delivery.`
          : `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds added to Pending Balance.`,
        type: 'sale',
        is_read: false,
      });
      if (notifErr) console.error('❌ Seller notification failed:', notifErr);
    } catch (notifErr) {
      console.error('❌ Seller notification threw:', notifErr);
    }

    // 6. Decrement offer stock (Physical items only)
    if (offer.category !== 'digital') {
      await supabase.rpc('decrement_stock', { row_id: item.offer_id, quantity_amt: item.quantity });
      if (isCustom && parentOfferId) {
        await supabase.rpc('decrement_stock', { row_id: parentOfferId, quantity_amt: item.quantity });
      }
    }

    // Check if offer is now out of stock and notify seller
    try {
      const { data: updatedOffer } = await supabase
        .from('offers')
        .select('stock, title')
        .eq('id', item.offer_id)
        .single();

      if (updatedOffer && updatedOffer.stock <= 0 && !offer.is_custom) {
        await sendOutOfStockEmail(sellerId, updatedOffer.title || title);
      }
    } catch (stockCheckErr) {
      console.error('⚠️ Stock check email failed (non-fatal):', stockCheckErr);
    }

    // 7. Decrement filament stock using the EXACT layers of the purchased variant
    // variant_layers is stored in order_items at checkout time (specific to which color was bought)
    let layersToUse: { filament_id: string; grams: string | number }[] = item.variant_layers || [];

    // Fallback: if no variant_layers saved (older order or custom offer), try offer's color_variants
    if (layersToUse.length === 0) {
      layersToUse = (offer.color_variants && offer.color_variants[0]?.layers) || [];
    }

    // Last fallback: try parent offer layers (for custom/negotiated offers)
    if (layersToUse.length === 0 && offer.is_custom && offer.parent_offer_id) {
      const parentOffer = offerMap[offer.parent_offer_id];
      if (parentOffer?.color_variants && parentOffer.color_variants[0]?.layers) {
        layersToUse = parentOffer.color_variants[0].layers;
      }
    }

    if (layersToUse.length > 0) {
      console.log(`🎨 Deducting filament for variant: ${item.variant_name || 'default'}, layers: ${layersToUse.length}`);
      const affectedFilamentIds = await decrementFilamentStock(layersToUse, item.quantity);
      // Recalculate stock for ALL offers by this seller using same filaments → updates marketplace instantly
      if (affectedFilamentIds.length > 0) {
        await recalculateOffersStockForFilaments(sellerId, affectedFilamentIds);

        // Check if any affected filament dropped to 75g or below → send low filament warning
        try {
          const { data: lowFilaments } = await supabase
            .from('filaments')
            .select('id, color_name, color_hex, stock_grams, color')
            .in('id', affectedFilamentIds)
            .lte('stock_grams', 100);

          if (lowFilaments && lowFilaments.length > 0) {
            for (const fil of lowFilaments) {
              const displayName = fil.color_name || fil.color || 'Unknown Filament';
              await sendLowFilamentWarning(sellerId, displayName, fil.stock_grams ?? 0);
            }
          }
        } catch (lowFilErr) {
          console.error('⚠️ Low filament check failed (non-fatal):', lowFilErr);
        }
      }
    } else {
      console.warn(`⚠️ No filament layers found for offer ${item.offer_id} (variant: ${item.variant_name || 'none'}) - skipping filament deduction`);
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

  console.log('✅ processOrder database work complete, now sending summary emails...');

  // 9. Send Order Confirmation Email to Buyer (Single comprehensive email)
  if (buyerEmail) {
    try {
      // Calculate total price for the email (assuming EUR for now or base price)
      const totalEur = orderItems.reduce((acc, item) => acc + (item.price_at_purchase * item.quantity), 0);
      const buyerItems = orderItems.map(item => {
        const off = offerMap[item.offer_id] || {};
        return {
          title: off.title || 'Product',
          quantity: item.quantity,
          price: item.price_at_purchase
        };
      });

      await sendEmail({
        to: buyerEmail,
        subject: `🛍️ Order Confirmed - Printis #${orderId.slice(0, 8)}`,
        html: EmailTemplates.orderConfirmation(
          buyerName,
          orderId,
          buyerItems,
          `€${totalEur.toFixed(2)}`
        )
      });
    } catch (err) {
      console.error('❌ Failed to send buyer order confirmation email:', err);
    }
  }

  // 10. Send Sale Notification Emails to Sellers
  // De-duplicate: custom offers + their parent might both be in order, send only once per seller
  const uniqueSellerIds = Array.from(new Set(orderItems.map(i => i.seller_id)));
  // Track which offer IDs have already sent a sale email (to avoid double for custom+parent)
  const emailedOfferIds = new Set<string>();

  for (const sId of uniqueSellerIds) {
    if (!sId) continue;
    try {
      const { data: sellerProf } = await supabase.from('profiles').select('full_name, email_notifs').eq('id', sId).single();
      
      // If sellers don't have emails in profiles, we fetch from auth.admin
      const { data: authUser } = await supabase.auth.admin.getUserById(sId);
      const sellerEmail = authUser?.user?.email;

      if (sellerEmail) {
        const sellerItems = orderItems.filter(i => i.seller_id === sId);
        const sellerName = sellerProf?.full_name || 'Seller';
        
        for (const item of sellerItems) {
          const off = offerMap[item.offer_id] || {};

          // Skip if this is a custom offer and the parent was already emailed
          // (prevents seller from getting 2 "you made a sale" emails for 1 transaction)
          const emailKey = off.is_custom && off.parent_offer_id
            ? `${sId}:${off.parent_offer_id}`
            : `${sId}:${item.offer_id}`;
          if (emailedOfferIds.has(emailKey)) {
            console.log(`⏭️ Skipping duplicate sale email for ${emailKey}`);
            continue;
          }
          emailedOfferIds.add(emailKey);

          const sellerCurrency = await getSellerCurrency(sId);
          const earnedEur = item.price_at_purchase * item.quantity;
          const formattedAmount = await convertFromEur(earnedEur, sellerCurrency);

          // Use parent offer title when it's a custom/negotiated offer
          const displayTitle = (off.is_custom && off.parent_offer_id && offerMap[off.parent_offer_id]?.title)
            ? offerMap[off.parent_offer_id].title
            : (off.title || 'Your Product');

          await sendEmail({
            to: sellerEmail,
            subject: `🎉 New Sale on Printis: ${displayTitle}`,
            html: EmailTemplates.saleNotification(
              sellerName,
              buyerName,
              displayTitle,
              formattedAmount
            )
          });
        }
      }
    } catch (err) {
      console.error(`❌ Failed to send seller notification for ${sId}:`, err);
    }
  }

  console.log('✅ processOrder complete, results:', results);
  return { success: true, results };
}
