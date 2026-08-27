import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../../lib/adminAuth';

export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { orderItemId, newStatus, trackingCode, carrier } = await req.json();

    if (!orderItemId || !newStatus) {
      return NextResponse.json({ error: 'orderItemId and newStatus are required' }, { status: 400 });
    }

    const validStatuses = ['ordered', 'shipped', 'in_transit', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // 1. Fetch order item
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from('order_items')
      .select('*, offers(title, parent_offer_id)')
      .eq('id', orderItemId)
      .single();

    if (fetchErr || !item) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    }

    const now = new Date();
    const updatePayload: Record<string, any> = {
      status: newStatus
    };

    if (trackingCode) updatePayload.tracking_code = trackingCode;
    if (carrier) updatePayload.carrier = carrier;

    // Handle specific status timestamps
    if (newStatus === 'delivered') {
      updatePayload.delivered_at = now.toISOString();
      // 48-hour confirm deadline
      updatePayload.buyer_confirm_deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    } else if (newStatus === 'completed') {
      updatePayload.buyer_confirmed_at = updatePayload.buyer_confirmed_at || now.toISOString();
    }

    // 2. Update order_items in Supabase
    const { error: updateErr } = await supabaseAdmin
      .from('order_items')
      .update(updatePayload)
      .eq('id', orderItemId);

    if (updateErr) throw updateErr;

    // 3. Find linked chat
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('buyer_id')
      .eq('id', item.order_id)
      .single();

    const buyerId = order?.buyer_id;

    const { data: chat } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('order_id', item.order_id)
      .maybeSingle();

    const title = item.offers?.title || '3D Printed Item';

    // 4. Send System Chat Message & Notifications for status changes
    if (chat?.id) {
      let systemText = `STATUS_UPDATE:${newStatus}`;
      if (newStatus === 'shipped') {
        systemText = `🚚 Package has been shipped! Tracking code: ${trackingCode || item.tracking_code || 'Standard Shipping'}.`;
      } else if (newStatus === 'in_transit') {
        systemText = `📦 Package is currently in transit to recipient destination.`;
      } else if (newStatus === 'delivered') {
        systemText = `✅ Package Delivered! Buyer has 48 hours to inspect the item and confirm receipt or open a dispute.`;
      } else if (newStatus === 'completed') {
        systemText = `🎉 Order Completed! Payment released to seller. Review & rating option unlocked for buyer.`;
      } else if (newStatus === 'cancelled') {
        systemText = `❌ Order status updated to Cancelled by Admin.`;
      }

      await supabaseAdmin.from('messages').insert({
        chat_id: chat.id,
        sender_id: adminId,
        message_type: 'status_' + newStatus,
        content: systemText,
      });
    }

    // Send In-App Notifications to Buyer & Seller
    const notifMessages: Record<string, string> = {
      shipped: `Your order for "${title}" has been shipped!`,
      in_transit: `Your package for "${title}" is currently in transit.`,
      delivered: `📦 "${title}" delivered! You have 48 hours to inspect and confirm receipt or open a dispute.`,
      completed: `🎉 Order for "${title}" marked as completed. Thank you!`,
      cancelled: `Order for "${title}" was cancelled by platform administration.`
    };

    if (buyerId && notifMessages[newStatus]) {
      await supabaseAdmin.from('notifications').insert({
        user_id: buyerId,
        title: `Package Status: ${newStatus.toUpperCase()}`,
        message: notifMessages[newStatus],
        type: 'info',
        offer_id: item.offer_id,
        is_read: false
      });
    }

    return NextResponse.json({
      success: true,
      message: `Order item status successfully updated to ${newStatus}`,
      orderItemId,
      status: newStatus
    });

  } catch (error: any) {
    console.error('Admin status update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
