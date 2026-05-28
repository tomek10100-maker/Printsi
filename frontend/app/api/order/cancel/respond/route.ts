import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/order/cancel/respond
 * Seller responds to a buyer's cancellation request.
 *   accept: true  → cancel + partial refund (item - shipping)
 *   accept: false → open dispute
 */
export async function POST(req: Request) {
  try {
    const { itemId, chatId, userId, accept } = await req.json();

    if (!itemId || !chatId || !userId || typeof accept !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: item, error: itemErr } = await supabase
      .from('order_items')
      .select('id, order_id, seller_id, price_at_purchase, quantity, status, cancellation_reason')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    if (item.status !== 'cancellation_requested') {
      return NextResponse.json({ error: 'No pending cancellation request for this item' }, { status: 400 });
    }

    // Verify caller is the seller
    if (String(userId) !== String(item.seller_id)) {
      return NextResponse.json({ error: 'Unauthorized — only the seller can respond' }, { status: 403 });
    }

    const { data: chat } = await supabase
      .from('chats')
      .select('buyer_id')
      .eq('id', chatId)
      .single();

    const buyerId = chat?.buyer_id;
    if (!buyerId) return NextResponse.json({ error: 'Chat buyer not found' }, { status: 404 });

    const { data: order } = await supabase
      .from('orders')
      .select('shipping_cost_eur')
      .eq('id', item.order_id)
      .maybeSingle();

    const shippingCostEur = Number(order?.shipping_cost_eur) || 0;
    const itemTotalEur = item.price_at_purchase * item.quantity;
    const refundEur = Math.max(0, itemTotalEur - shippingCostEur);

    if (accept) {
      // ── SELLER ACCEPTS ─────────────────────────────────────────
      await supabase.from('order_items').update({ status: 'cancelled' }).eq('id', itemId);

      // Partial refund → buyer wallet
      if (refundEur > 0) {
        await supabase.from('payouts').insert({
          user_id: buyerId,
          amount: -refundEur, // negative = wallet credit
          status: 'completed',
          notes: `Refund: seller accepted cancellation request (item ${itemId}). Shipping €${shippingCostEur.toFixed(2)} deducted.`,
        });
      }

      // System message confirming cancellation
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({
          type: 'seller_accepted_cancel',
          refund_eur: refundEur,
          shipping_deducted_eur: shippingCostEur,
        }),
        message_type: 'status_cancelled',
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: buyerId,
        title: '✅ Cancellation Accepted',
        message: `The seller accepted your cancellation request. A refund of €${refundEur.toFixed(2)} has been credited to your Printis Wallet.${shippingCostEur > 0 ? ` (€${shippingCostEur.toFixed(2)} shipping cost was non-refundable)` : ''}`,
        type: 'cancellation',
        is_read: false,
      });

      return NextResponse.json({ success: true, action: 'accepted', refund_eur: refundEur });

    } else {
      // ── SELLER DECLINES → OPEN DISPUTE ─────────────────────────
      await supabase.from('order_items').update({ status: 'disputed' }).eq('id', itemId);

      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({
          problemType: 'cancellation_declined',
          description: 'The seller declined the cancellation request. A dispute has been opened for admin review. Funds remain on hold.',
        }),
        message_type: 'dispute_opened',
      });

      await supabase.from('notifications').insert({
        user_id: buyerId,
        title: '⚠️ Cancellation Declined — Dispute Opened',
        message: 'The seller declined your cancellation request. A dispute has been opened and our support team will review the case. Funds remain on hold.',
        type: 'dispute',
        is_read: false,
      });

      return NextResponse.json({ success: true, action: 'declined_dispute_opened' });
    }

  } catch (err: any) {
    console.error('❌ Cancel respond error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
