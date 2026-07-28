import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../../lib/adminAuth';
import { sendDisputeResolutionEmail } from '../../../../lib/sendNotificationEmail';

export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { disputeId, orderItemId, action, adminNotes } = await req.json();

    if (!action || (!disputeId && !orderItemId)) {
      return NextResponse.json({ error: 'Missing required parameters: action and disputeId or orderItemId' }, { status: 400 });
    }

    if (action !== 'refund_buyer' && action !== 'payout_seller') {
      return NextResponse.json({ error: 'Invalid action. Must be refund_buyer or payout_seller' }, { status: 400 });
    }

    // 1. Fetch Dispute or Order Item details
    let dispute: any = null;
    let targetItemId = orderItemId;

    if (disputeId) {
      const { data: d } = await supabaseAdmin
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .maybeSingle();
      dispute = d;
      if (dispute) targetItemId = dispute.order_item_id;
    }

    if (!targetItemId) {
      return NextResponse.json({ error: 'Order item ID not provided' }, { status: 400 });
    }

    // 2. Fetch Order Item and associated Order
    const { data: item, error: itemErr } = await supabaseAdmin
      .from('order_items')
      .select('id, order_id, seller_id, price_at_purchase, quantity, status')
      .eq('id', targetItemId)
      .maybeSingle();

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Order item not found in database' }, { status: 404 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_id')
      .eq('id', item.order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'Parent order not found' }, { status: 404 });
    }

    const buyerId = order.buyer_id;
    const sellerId = item.seller_id;
    const itemAmountEUR = Number(item.price_at_purchase || 0) * Number(item.quantity || 1);

    // 3. Safely locate chat conversation between buyer and seller
    let chatId = dispute?.chat_id;
    if (!chatId && buyerId && sellerId) {
      const { data: chat1 } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('seller_id', sellerId)
        .maybeSingle();

      if (chat1) {
        chatId = chat1.id;
      } else {
        const { data: chat2 } = await supabaseAdmin
          .from('chats')
          .select('id')
          .eq('buyer_id', sellerId)
          .eq('seller_id', buyerId)
          .maybeSingle();
        if (chat2) chatId = chat2.id;
      }
    }

    // 4. Handle Resolution Action
    if (action === 'refund_buyer') {
      // Refund item amount to Buyer's wallet (excluding shipping)
      const { data: buyerProfile } = await supabaseAdmin
        .from('profiles')
        .select('wallet_balance')
        .eq('id', buyerId)
        .single();

      const currentBal = Number(buyerProfile?.wallet_balance || 0);
      const newBal = currentBal + itemAmountEUR;

      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBal })
        .eq('id', buyerId);

      // Update Order Item status
      await supabaseAdmin
        .from('order_items')
        .update({ status: 'cancelled' })
        .eq('id', targetItemId);

      // Update Dispute record if exists
      if (dispute) {
        await supabaseAdmin
          .from('disputes')
          .update({ status: 'resolved_refunded', admin_notes: adminNotes || '' })
          .eq('id', dispute.id);
      }

      // Post Official Admin System Announcement to Chat
      if (chatId) {
        await supabaseAdmin.from('messages').insert({
          chat_id: chatId,
          sender_id: adminId,
          content: JSON.stringify({
            action: 'refund_buyer',
            amountEUR: itemAmountEUR,
            notes: adminNotes || 'Issue resolved by Platform Administration. Item cost refunded to Buyer account balance (shipping excluded).',
            timestamp: new Date().toISOString(),
          }),
          message_type: 'admin_resolution',
        });
      }

      // Send email notifications
      sendDisputeResolutionEmail(buyerId, sellerId, 'refund_buyer', itemAmountEUR, adminNotes).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Successfully refunded €${itemAmountEUR.toFixed(2)} to Buyer balance (excl. shipping).`,
        refundedAmountEUR: itemAmountEUR,
      });

    } else if (action === 'payout_seller') {
      // Transfer/Credit funds to Seller's wallet
      const { data: sellerProfile } = await supabaseAdmin
        .from('profiles')
        .select('wallet_balance')
        .eq('id', sellerId)
        .single();

      const currentBal = Number(sellerProfile?.wallet_balance || 0);
      const newBal = currentBal + itemAmountEUR;

      await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBal })
        .eq('id', sellerId);

      // Update Order Item status
      await supabaseAdmin
        .from('order_items')
        .update({ status: 'transfer_completed' })
        .eq('id', targetItemId);

      // Update Dispute record if exists
      if (dispute) {
        await supabaseAdmin
          .from('disputes')
          .update({ status: 'resolved_payout_seller', admin_notes: adminNotes || '' })
          .eq('id', dispute.id);
      }

      // Post Official Admin System Announcement to Chat
      if (chatId) {
        await supabaseAdmin.from('messages').insert({
          chat_id: chatId,
          sender_id: adminId,
          content: JSON.stringify({
            action: 'payout_seller',
            amountEUR: itemAmountEUR,
            notes: adminNotes || 'Issue resolved by Platform Administration in favor of Seller. Funds released to Seller account balance.',
            timestamp: new Date().toISOString(),
          }),
          message_type: 'admin_resolution',
        });
      }

      // Send email notifications
      sendDisputeResolutionEmail(buyerId, sellerId, 'payout_seller', itemAmountEUR, adminNotes).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Successfully released €${itemAmountEUR.toFixed(2)} payout to Seller balance.`,
        payoutAmountEUR: itemAmountEUR,
      });
    }

  } catch (err: any) {
    console.error('[/api/admin/disputes/resolve] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
