import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendDigitalFileEmail } from '../../lib/sendDigitalFileEmail';
import { sendOutOfStockEmail } from '../../lib/sendNotificationEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr', CHF: 'Fr',
};

async function convertFromEur(amountEur: number, toCurrency: string): Promise<string> {
  try {
    if (toCurrency === 'EUR') return `€${amountEur.toFixed(2)}`;
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    const data = await res.json();
    const rate = data.rates?.[toCurrency] || 1;
    const converted = Math.ceil(amountEur * rate * 100) / 100;
    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + ' ';
    if (toCurrency === 'PLN') return `${converted.toFixed(2)} ${symbol}`;
    return `${symbol}${converted.toFixed(2)}`;
  } catch {
    return `€${amountEur.toFixed(2)}`;
  }
}

async function getSellerCurrency(sellerId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('currency').eq('id', sellerId).single();
  return data?.currency || 'EUR';
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ Missing STRIPE_WEBHOOK_SECRET');
    return new NextResponse('Missing Webhook Secret', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error(`❌ Webhook Signature Error: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  console.log(`📨 Webhook event: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log('Session metadata:', session.metadata);
    const userId = session.metadata?.userId;
    if (!userId) {
      console.warn('⚠️ Missing userId in metadata!');
      return new NextResponse('OK - no userId', { status: 200 });
    }

    // Map Stripe currency code to symbol
    const currencyCode = (session.currency || 'eur').toUpperCase();
    const currencySymbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč' };
    const currencySymbol = currencySymbols[currencyCode] || currencyCode + ' ';

    console.log(`👤 buyer: ${userId} | total: ${currencySymbol}${(session.amount_total || 0) / 100}`);

    // --- 1. Create the order ---
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: session.amount_total ? session.amount_total / 100 : 0,
        status: 'paid',
        shipping_address: (session as any).shipping_details || session.customer_details || null,
        stripe_payment_intent_id: (session.payment_intent as string) || session.id,
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ ORDER INSERT FAILED:', JSON.stringify(orderError));
      return new NextResponse(`Order insert failed: ${orderError.message}`, { status: 500 });
    }

    console.log(`✅ Order created: ${newOrder.id}`);

    // --- 1.5 Create the shipping details ---
    const shippingDetails = (session as any).shipping_details || session.customer_details;
    if (shippingDetails) {
      const addressObj = shippingDetails.address || {};
      const { error: shippingError } = await supabase
        .from('order_shipping_details')
        .insert({
          order_id: newOrder.id,
          full_name: shippingDetails.name || '',
          email: session.customer_details?.email || '',
          address: addressObj.line1 || '',
          city: addressObj.city || '',
          zip_code: addressObj.postal_code || '',
          country: addressObj.country || '',
        });

      if (shippingError) {
        console.error('❌ SHIPPING INSERT FAILED:', JSON.stringify(shippingError));
      } else {
        console.log(`✅ Shipping details created for order: ${newOrder.id}`);
      }
    }

    // --- 2. Fetch buyer's profile for notifications ---
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    const buyerName = buyerProfile?.full_name || 'A customer';
    const orderTotal = ((session.amount_total || 0) / 100).toFixed(2);

    // --- 3. Notify the BUYER: order confirmed ---
    const { error: buyerNotifError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: '✅ Order confirmed!',
        message: `Hey ${buyerName}! Your order of ${currencySymbol}${orderTotal} has been confirmed and is being processed. Check your orders page for details.`,

        type: 'order',
        is_read: false,
      });

    if (buyerNotifError) console.error('❌ Buyer notification error:', JSON.stringify(buyerNotifError));
    else console.log('✅ Buyer notified!');

    // --- 4. Retrieve line items from Stripe ---
    const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
      session.id,
      { expand: ['line_items.data.price.product'] }
    );

    const lineItems = sessionWithLineItems.line_items?.data || [];
    console.log(`🛒 ${lineItems.length} line item(s)`);

    for (const item of lineItems) {
      const product = item.price?.product as Stripe.Product;
      const quantityBought = item.quantity || 1;
      const offerId = product.metadata?.offer_id;
      const sellerId = product.metadata?.seller_id;

      if (!offerId) {
        console.warn(`⚠️ No offer_id on "${product.name}", skipping`);
        continue;
      }

      // --- 4.5 Fetch offer details ---
      const { data: offerDetails } = await supabase
        .from('offers')
        .select('is_custom, parent_offer_id, color_variants, category, file_url')
        .eq('id', offerId)
        .single();

      const isCustom = offerDetails?.is_custom;
      const parentOfferId = offerDetails?.parent_offer_id;

      // --- 5. Decrement offer stock ---
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        row_id: offerId,
        quantity_amt: quantityBought,
      });
      if (stockError) console.error('❌ Stock error:', JSON.stringify(stockError));
      else console.log(`✅ Stock updated for: ${offerId}`);

      if (isCustom && parentOfferId) {
        await supabase.rpc('decrement_stock', {
          row_id: parentOfferId,
          quantity_amt: quantityBought,
        });
        console.log(`✅ Parent Stock updated for: ${parentOfferId}`);
      }

      // Check if offer is now out of stock → notify seller
      if (sellerId) {
        try {
          const { data: updatedOffer } = await supabase
            .from('offers')
            .select('stock, title')
            .eq('id', offerId)
            .single();
          if (updatedOffer && updatedOffer.stock <= 0) {
            await sendOutOfStockEmail(sellerId, updatedOffer.title || product.name);
          }
        } catch (e) {
          console.error('⚠️ Out-of-stock email check failed (non-fatal):', e);
        }
      }

      // --- 5.5 Decrement filament stock_grams ---
      const colorVariants: any[] = offerDetails?.color_variants || [];
      const affectedFilamentIds: string[] = [];
      if (colorVariants.length > 0) {
        // Bierzemy warstwy z pierwszego wariantu (Stripe webhook nie wie który wariant wybrano)
        const layers = colorVariants[0]?.layers || [];
        for (const layer of layers) {
          if (!layer.filament_id || !layer.grams) continue;
          const gramsPerPiece = parseFloat(String(layer.grams));
          if (isNaN(gramsPerPiece) || gramsPerPiece <= 0) continue;
          const totalGrams = gramsPerPiece * quantityBought;
          const { error: filErr } = await supabase.rpc('decrement_filament_stock', {
            filament_id: layer.filament_id,
            grams_used: totalGrams,
          });
          if (filErr) console.error(`❌ Filament stock error for ${layer.filament_id}:`, filErr);
          else {
            console.log(`✅ Filament ${layer.filament_id} -${totalGrams}g`);
            affectedFilamentIds.push(layer.filament_id);
          }
        }
      }

      // --- 5.6 Recalculate stock for ALL seller's offers using same filaments ---
      if (sellerId && affectedFilamentIds.length > 0) {
        try {
          // Get current filament stock
          const { data: filStocks } = await supabase
            .from('filaments').select('id, stock_grams').in('id', affectedFilamentIds);
          const filMap: Record<string, number> = {};
          (filStocks || []).forEach(f => { filMap[f.id] = f.stock_grams ?? 0; });

          // Find all offers by this seller with color_variants
          const { data: sellerOffers } = await supabase
            .from('offers').select('id, color_variants, stock')
            .eq('user_id', sellerId).not('color_variants', 'is', null);

          for (const sOffer of (sellerOffers || [])) {
            const svars: any[] = sOffer.color_variants || [];
            let totalNew = 0; let touched = false;
            for (const sv of svars) {
              const sLayers: any[] = sv.layers || [];
              let maxPcs = Infinity; let used = false;
              for (const sl of sLayers) {
                if (!sl.filament_id || !sl.grams) continue;
                const sg = parseFloat(String(sl.grams));
                if (sg <= 0) continue;
                if (affectedFilamentIds.includes(sl.filament_id)) {
                  used = true;
                  maxPcs = Math.min(maxPcs, Math.floor((filMap[sl.filament_id] ?? 0) / sg));
                }
              }
              if (used) { touched = true; sv.stock = Math.max(0, maxPcs === Infinity ? 0 : maxPcs); }
              totalNew += (sv.stock || 0);
            }
            if (touched) {
              await supabase.from('offers').update({ stock: totalNew, color_variants: svars }).eq('id', sOffer.id);
              console.log(`🔄 Offer ${sOffer.id} stock recalculated → ${totalNew}`);
            }
          }
        } catch (recalcErr) {
          console.error('⚠️ Stock recalculation error (non-fatal):', recalcErr);
        }
      }


      // --- 6. Insert order_item ---
      if (!sellerId) {
        console.warn(`⚠️ No seller_id for "${product.name}", skipping`);
        continue;
      }

      const priceAtPurchase = item.amount_total
        ? (item.amount_total / 100) / quantityBought
        : 0;

      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: newOrder.id,
          offer_id: offerId,
          seller_id: sellerId,
          quantity: quantityBought,
          price_at_purchase: priceAtPurchase,
        });

      if (itemError) {
        console.error('❌ order_item INSERT FAILED:', JSON.stringify(itemError));
        continue;
      }

      console.log(`✅ order_item saved for: ${offerId}`);

      // --- 7. Notify the SELLER with buyer's name and amount in seller's currency ---
      const earned = priceAtPurchase * quantityBought;
      const sellerCurrency = await getSellerCurrency(sellerId);
      const formattedAmount = await convertFromEur(earned, sellerCurrency);
      const { error: sellerNotifError } = await supabase
        .from('notifications')
        .insert({
          user_id: sellerId,
          title: '🎉 You made a sale!',
          message: `Your product "${product.name}" (x${quantityBought}) was purchased by ${buyerName} for ${formattedAmount}. Funds added to your Printsi balance.`,
          type: 'sale',
          is_read: false,
        });

      if (sellerNotifError) console.error('❌ Seller notification error:', JSON.stringify(sellerNotifError));
      else console.log(`✅ Seller notified!`);

      // --- 8. Create or Update Chat between Buyer & Seller ---
      const chatOfferId = (isCustom && parentOfferId) ? parentOfferId : offerId;

      const { data: existingChat } = await supabase
        .from('chats')
        .select('id')
        .eq('buyer_id', userId)
        .eq('seller_id', sellerId)
        .eq('offer_id', chatOfferId)
        .single();

      let chatId = existingChat?.id;

      if (!chatId) {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            buyer_id: userId,
            seller_id: sellerId,
            offer_id: chatOfferId,
            order_id: newOrder.id, // linked to purchase
          })
          .select('id')
          .single();

        if (chatError) console.error('❌ Chat insert error:', JSON.stringify(chatError));
        else chatId = newChat.id;
      } else {
        await supabase.from('chats').update({ order_id: newOrder.id }).eq('id', chatId);
      }

      if (chatId) {
        // Send system message about the order
        await supabase.from('messages').insert({
          chat_id: chatId,
          sender_id: userId,
          content: `New order: ${quantityBought}x ${product.name} has been purchased successfully.`,
          message_type: 'system',
        });
        // If physical, add shipping reminder
        if (offerDetails?.category !== 'digital') {
          await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: userId,
            content: `The seller has 4 days to ship the item. Use the confirmation buttons below to track delivery progress.`,
            message_type: 'system',
          });
        } else {
          await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: userId,
            content: `Digital file delivered automatically. Transaction completed!`,
            message_type: 'status_completed',
          });
        }
        console.log(`💬 Chat created/updated for order: ${chatId}`);
      }

      // --- 9. Send digital file email if the product is a digital file ---
      if (offerDetails?.category === 'digital' && offerDetails?.file_url) {
        const buyerEmail = session.customer_details?.email || '';
        const buyerName = buyerProfile?.full_name || session.customer_details?.name || 'Customer';

        if (buyerEmail) {
          try {
            await sendDigitalFileEmail({
              buyerEmail,
              buyerName,
              productTitle: product.name,
              fileUrl: offerDetails.file_url,
              orderId: newOrder.id,
            });
          } catch (emailErr) {
            console.error(`❌ Failed to send digital file email for offer ${offerId}:`, emailErr);
            // Non-fatal – order still processed
          }
        } else {
          console.warn(`⚠️ Digital product ${offerId} purchased but no buyer email in Stripe session`);
        }
      }
    }

    console.log('🎉 Webhook complete!');
  }

  return new NextResponse('OK', { status: 200 });
}