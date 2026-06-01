import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/order/cancel
 * Handles order cancellation initiation:
 *   - initiator = 'seller': immediate cancel + full refund
 *   - initiator = 'buyer': sets status to cancellation_requested, waits for seller
 */
export async function POST(req: Request) {
  try {
    const { itemId, chatId, userId, initiator, reason } = await req.json();

    if (!itemId || !chatId || !userId || !initiator || !reason?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch order item
    const { data: item, error: itemErr } = await supabase
      .from('order_items')
      .select('id, order_id, seller_id, price_at_purchase, quantity, status, furgonetka_package_id')
      .eq('id', itemId)
      .single();

    if (itemErr || !item) return NextResponse.json({ error: 'Order item not found' }, { status: 404 });

    // Safety: only allow cancel on pending or shipped (not completed/disputed/already cancelled)
    const cancelableStatuses = ['pending', 'shipped', 'cancellation_requested'];
    if (!cancelableStatuses.includes(item.status)) {
      return NextResponse.json({ error: `Cannot cancel order in status: ${item.status}` }, { status: 400 });
    }

    // Fetch chat for buyer_id
    const { data: chat } = await supabase
      .from('chats')
      .select('buyer_id, seller_id')
      .eq('id', chatId)
      .single();

    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

    // Fetch order for shipping cost
    const { data: order } = await supabase
      .from('orders')
      .select('shipping_cost_eur')
      .eq('id', item.order_id)
      .maybeSingle();

    const shippingCostEur = Number(order?.shipping_cost_eur) || 0;
    const itemTotalEur = item.price_at_purchase * item.quantity;
    const buyerId = chat.buyer_id;

    // ─── SELLER INITIATES CANCELLATION ───────────────────────────
    if (initiator === 'seller') {
      // Verify the caller is the seller
      if (String(userId) !== String(item.seller_id)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Cancel the item
      await supabase.from('order_items').update({
        status: 'cancelled',
        cancellation_reason: reason.trim(),
        cancellation_initiated_by: 'seller',
      }).eq('id', itemId);

      // Cancel Furgonetka package if exists
      if (item.furgonetka_package_id) {
        try {
          console.log(`[Cancel Route] Cancelling Furgonetka package ${item.furgonetka_package_id}...`);
          const { furgonetkaClient } = await import('@/app/lib/furgonetkaClient');
          await furgonetkaClient.cancelPackage(item.furgonetka_package_id);
          console.log(`[Cancel Route] Furgonetka package ${item.furgonetka_package_id} cancelled successfully.`);
        } catch (e) {
          console.error('[Cancel Route] Failed to cancel Furgonetka package (non-fatal):', e);
        }
      }

      // Full refund → buyer wallet via payouts table (negative amount = credit)
      await supabase.from('payouts').insert({
        user_id: buyerId,
        amount: -itemTotalEur, // negative = wallet top-up credit
        status: 'completed',
        notes: `Refund: seller cancelled order (item ${itemId})`,
      });

      // System message for buyer
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({
          type: 'seller_cancelled',
          reason: reason.trim(),
          refund_eur: itemTotalEur,
        }),
        message_type: 'status_cancelled',
      });

      // In-app notification to buyer
      await supabase.from('notifications').insert({
        user_id: buyerId,
        title: '❌ Order Cancelled by Seller',
        message: `The seller has cancelled your order. You will receive a full refund of €${itemTotalEur.toFixed(2)} to your Printis Wallet. Reason: "${reason.trim()}"`,
        type: 'cancellation',
        is_read: false,
      });

      return NextResponse.json({ success: true, action: 'seller_cancelled' });
    }

    // ─── BUYER REQUESTS CANCELLATION ─────────────────────────────
    if (initiator === 'buyer') {
      // Verify the caller is the buyer
      if (String(userId) !== String(buyerId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Buyer can only request cancel when pending (not after shipped)
      if (item.status !== 'pending') {
        return NextResponse.json({ error: 'You can only request cancellation before the item is shipped. Please use the dispute system.' }, { status: 400 });
      }

      const refundEur = Math.max(0, itemTotalEur - shippingCostEur);

      // Mark as requested
      await supabase.from('order_items').update({
        status: 'cancellation_requested',
        cancellation_reason: reason.trim(),
        cancellation_initiated_by: 'buyer',
      }).eq('id', itemId);

      // System message for seller with payload for inline buttons
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({
          type: 'buyer_cancel_request',
          reason: reason.trim(),
          item_total_eur: itemTotalEur,
          shipping_cost_eur: shippingCostEur,
          refund_eur: refundEur,
          item_id: itemId,
        }),
        message_type: 'cancellation_request',
      });

      // In-app notification to seller
      await supabase.from('notifications').insert({
        user_id: item.seller_id,
        title: '⚠️ Buyer Requested Cancellation',
        message: `A buyer wants to cancel their order. Reason: "${reason.trim()}". Please review the request in your messages.`,
        type: 'cancellation',
        is_read: false,
      });

      return NextResponse.json({ success: true, action: 'cancellation_requested', refund_eur: refundEur });
    }

    return NextResponse.json({ error: 'Invalid initiator' }, { status: 400 });

  } catch (err: any) {
    console.error('❌ Cancel error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
