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
    const { itemId, newStatus, chatId, userId, trackingCode, action } = await req.json();

    // ─── NEW ACTIONS: extension + confirm receipt ──────────────────────
    if (action === 'request_extension') {
      const { data: oi } = await supabase.from('order_items').select('extension_requested_at, ship_by_deadline, seller_id').eq('id', itemId).single();
      if (oi?.extension_requested_at) return NextResponse.json({ success: false, error: 'Extension already requested.' }, { status: 400 });
      if (oi?.seller_id !== userId) return NextResponse.json({ success: false, error: 'Only the seller can request an extension.' }, { status: 403 });
      await supabase.from('order_items').update({ extension_requested_at: new Date().toISOString() }).eq('id', itemId);
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: userId, message_type: 'extension_request',
        content: JSON.stringify({ type: 'extension_request', current_deadline: oi?.ship_by_deadline }),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'approve_extension') {
      const { data: oi } = await supabase.from('order_items').select('ship_by_deadline, seller_id').eq('id', itemId).single();
      const newDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await supabase.from('order_items').update({ ship_by_deadline: newDeadline.toISOString(), extension_approved: true }).eq('id', itemId);
      const deadlineLabel = newDeadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: userId, message_type: 'extension_approved',
        content: JSON.stringify({ type: 'extension_approved', new_deadline: newDeadline.toISOString(), deadline_label: deadlineLabel }),
      });
      // Notify seller
      if (oi?.seller_id) {
        await supabase.from('notifications').insert({ user_id: oi.seller_id, title: 'Shipping extension approved', message: `The buyer approved your extension request. New deadline: ${deadlineLabel}.`, type: 'info', is_read: false });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'deny_extension') {
      const { data: oi } = await supabase.from('order_items').select('seller_id, ship_by_deadline').eq('id', itemId).single();
      await supabase.from('order_items').update({ extension_denied: true }).eq('id', itemId);
      const deadlineLabel = oi?.ship_by_deadline ? new Date(oi.ship_by_deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'original deadline';
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: userId, message_type: 'extension_denied',
        content: JSON.stringify({ type: 'extension_denied', original_deadline: oi?.ship_by_deadline, deadline_label: deadlineLabel }),
      });
      if (oi?.seller_id) {
        await supabase.from('notifications').insert({ user_id: oi.seller_id, title: 'Shipping extension denied', message: `The buyer denied your extension request. You must ship by ${deadlineLabel}.`, type: 'warning', is_read: false });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'confirm_receipt') {
      // Guard: only allow if status is 'delivered'
      const { data: oi } = await supabase.from('order_items').select('status, seller_id, price_at_purchase, quantity, offer_id, order_id').eq('id', itemId).single();
      if (!oi) return NextResponse.json({ success: false, error: 'Order item not found.' }, { status: 404 });
      if (oi.status !== 'delivered') return NextResponse.json({ success: false, error: 'Cannot confirm receipt — package not yet marked as delivered.' }, { status: 400 });
      await supabase.from('order_items').update({ status: 'completed', buyer_confirmed_at: new Date().toISOString() }).eq('id', itemId);
      await supabase.from('messages').insert({
        chat_id: chatId, sender_id: userId, message_type: 'status_completed',
        content: JSON.stringify({ type: 'completed', confirmed_by: 'buyer', confirmed_at: new Date().toISOString() }),
      });
      await supabase.from('chats').update({ completed_at: new Date().toISOString() }).eq('id', chatId);
      // Notify seller
      if (oi.seller_id) {
        const { data: offer } = await supabase.from('offers').select('title').eq('id', oi.offer_id).single();
        const { data: sellerProfile } = await supabase.from('profiles').select('currency').eq('id', oi.seller_id).single();
        const earnedEur = (oi.price_at_purchase || 0) * (oi.quantity || 1);
        const sellerCurrency = sellerProfile?.currency || 'EUR';
        const FALLBACK_RATES: Record<string, number> = { PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96 };
        const rate = FALLBACK_RATES[sellerCurrency] || 1;
        const converted = sellerCurrency === 'EUR' ? `€${earnedEur.toFixed(2)}` : `${Math.ceil(earnedEur * rate * 100) / 100} ${sellerCurrency}`;
        await supabase.from('notifications').insert({ user_id: oi.seller_id, title: '🎉 Sale confirmed!', message: `The buyer confirmed receipt of "${offer?.title || 'your item'}". ${converted} has been added to your balance.`, type: 'sale', is_read: false });
        try {
          const { sendCompletedEmail } = await import('@/app/lib/sendNotificationEmail');
          const { data: chatInfo } = await supabase.from('chats').select('buyer_id').eq('id', chatId).single();
          if (chatInfo?.buyer_id) await sendCompletedEmail(oi.seller_id, chatInfo.buyer_id, offer?.title || 'your item', converted);
        } catch { /* non-fatal */ }
      }
      return NextResponse.json({ success: true, newStatus: 'completed' });
    }
    // ─────────────────────────────────────────────────────────────────────
    if (!itemId || !newStatus || !chatId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    // Check current status in database first to prevent duplicate status changes or double payouts on multi-click
    const { data: currentItem } = await supabase
      .from('order_items')
      .select('status')
      .eq('id', itemId)
      .single();

    if (currentItem?.status === newStatus || currentItem?.status === 'completed') {
      console.log(`[OrderStatus Route] Order item ${itemId} is already status '${currentItem?.status}'. Skipping duplicate request.`);
      return NextResponse.json({ success: true, newStatus: currentItem?.status || newStatus, message: 'Status already up to date' });
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

    // SHIPPED → email to buyer (only if not already sent via tracking email)
    if (newStatus === 'shipped' && buyerShipping?.email && !trackingCode) {
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
    // + expire related custom offers + schedule chat for auto-archiving
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

      // Expire all custom offers tied to this chat's offer (so they can't be bought again)
      try {
        const { data: chatInfo } = await supabase
          .from('chats')
          .select('offer_id')
          .eq('id', chatId)
          .single();

        if (chatInfo?.offer_id) {
          // Expire custom sub-offers linked to this parent offer
          await supabase
            .from('offers')
            .update({ stock: 0 })
            .eq('parent_offer_id', chatInfo.offer_id)
            .eq('is_custom', true);
        }

        // Also expire the specific custom offer bought in this order
        if (orderItem?.offer_id) {
          await supabase
            .from('offers')
            .update({ stock: 0 })
            .eq('id', orderItem.offer_id)
            .eq('is_custom', true);
        }
      } catch (err) {
        console.error('⚠️ Failed to expire custom offers (non-fatal):', err);
      }

      // Schedule this chat for auto-archiving after 24h
      // We record completed_at on the chat so the frontend can check it
      try {
        await supabase
          .from('chats')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', chatId);
      } catch (err) {
        console.error('⚠️ Failed to set completed_at on chat (non-fatal):', err);
      }
    }

    return NextResponse.json({ success: true, newStatus });

  } catch (error: any) {
    console.error('❌ Status Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
