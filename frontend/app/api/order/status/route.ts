import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendShippedEmail, sendDeliveredEmail, sendCompletedEmail, getUserEmailInfo, sendTrackingAddedEmails } from '@/app/lib/sendNotificationEmail';


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
    const FALLBACK_RATES: Record<string, number> = {
      PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96,
    };
    let rate = FALLBACK_RATES[toCurrency] || 1;
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (res.ok) {
        const json = await res.json();
        if (json.rates?.[toCurrency]) rate = json.rates[toCurrency];
      }
    } catch { }
    const converted = Math.ceil(amountEur * rate * 100) / 100;
    if (toCurrency === 'PLN') return `${converted.toFixed(2)} zł`;
    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + ' ';
    return `${symbol}${converted.toFixed(2)}`;
  } catch {
    return `€${amountEur.toFixed(2)}`;
  }
}

export async function POST(req: Request) {
  try {
    const { itemId, newStatus, chatId, userId, trackingCode } = await req.json();

    if (!itemId || !newStatus || !chatId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    // Update status in order_items (with optional tracking code)
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'shipped' && trackingCode) {
      updatePayload.tracking_code = trackingCode;
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update(updatePayload)
      .eq('id', itemId);


    if (updateError) throw updateError;

    // If tracking code was just added → send emails to both parties
    if (trackingCode) {
      try {
        const { data: trackItem } = await supabase
          .from('order_items')
          .select('order_id, offer_id, seller_id')
          .eq('id', itemId)
          .single();

        if (trackItem) {
          const { data: trackOffer } = await supabase
            .from('offers')
            .select('title')
            .eq('id', trackItem.offer_id)
            .single();

          const { data: trackChat } = await supabase
            .from('chats')
            .select('buyer_id')
            .eq('id', chatId)
            .single();

          const { data: trackShipping } = await supabase
            .from('order_shipping_details')
            .select('email, full_name')
            .eq('order_id', trackItem.order_id)
            .maybeSingle();

          if (trackChat?.buyer_id && trackItem.seller_id) {
            await sendTrackingAddedEmails(
              trackChat.buyer_id,
              trackItem.seller_id,
              trackOffer?.title || 'Your Order',
              trackingCode,
              trackShipping?.email,
              trackShipping?.full_name
            );
          }
        }
      } catch (trackEmailErr) {
        console.error('⚠️ Tracking email failed (non-fatal):', trackEmailErr);
      }
    }

    // Fetch order item info (order_id, offer_id, seller_id, price, quantity)
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('order_id, offer_id, seller_id, price_at_purchase, quantity')
      .eq('id', itemId)
      .single();
    
    const { data: offer } = await supabase
      .from('offers')
      .select('title')
      .eq('id', orderItem?.offer_id)
      .single();

    const { data: buyerShipping } = await supabase
      .from('order_shipping_details')
      .select('email, full_name')
      .eq('order_id', orderItem?.order_id)
      .single();

    // Get chat info for seller/buyer IDs
    const { data: chatData } = await supabase
      .from('chats')
      .select('buyer_id, seller_id')
      .eq('id', chatId)
      .single();

    // Add a system message about the status change
    let messageContent = '';
    let messageType = 'system';
    
    if (newStatus === 'shipped') {
      messageContent = `The seller has shipped the package. It's on the way!`;
      messageType = 'status_shipped';
    } else if (newStatus === 'delivered') {
      messageContent = `The buyer has confirmed receiving the package.`;
      messageType = 'status_delivered';
    } else if (newStatus === 'completed') {
      messageContent = `Transaction completed successfully! The buyer confirmed everything is fine. Funds have been released to the seller's balance.`;
      messageType = 'status_completed';
    } else if (newStatus === 'disputed') {
      messageContent = `A dispute has been opened. Funds are on hold until the issue is resolved by support.`;
      messageType = 'status_disputed';
    } else {
      messageContent = `Status changed to: ${newStatus}`;
    }

    // Insert system message
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content: messageContent,
      message_type: messageType,
    });

    // ─── SEND EMAILS based on status ───────────────────────────

    const productTitle = offer?.title || 'Your item';

    // SHIPPED → email to buyer
    if (newStatus === 'shipped' && buyerShipping?.email) {
      try {
        const sellerInfo = await getUserEmailInfo(orderItem?.seller_id);
        await sendShippedEmail(
          buyerShipping.email,
          buyerShipping.full_name || 'Customer',
          productTitle,
          sellerInfo?.name || 'Seller'
        );
      } catch (err) {
        console.error('❌ Failed to send shipment email:', err);
      }
    }

    // DELIVERED → email to seller
    if (newStatus === 'delivered' && chatData?.seller_id) {
      try {
        const buyerName = buyerShipping?.full_name || 'Buyer';
        await sendDeliveredEmail(chatData.seller_id, buyerName, productTitle);
      } catch (err) {
        console.error('❌ Failed to send delivered email:', err);
      }
    }

    // COMPLETED → email to both buyer & seller with amount
    if (newStatus === 'completed' && chatData) {
      try {
        const earnedEur = (orderItem?.price_at_purchase || 0) * (orderItem?.quantity || 1);
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('currency')
          .eq('id', chatData.seller_id)
          .single();
        const amount = await convertFromEur(earnedEur, sellerProfile?.currency || 'EUR');

        await sendCompletedEmail(
          chatData.seller_id,
          chatData.buyer_id,
          productTitle,
          amount
        );
      } catch (err) {
        console.error('❌ Failed to send completed email:', err);
      }
    }

    return NextResponse.json({ success: true, newStatus });

  } catch (error: any) {
    console.error('❌ Status Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
