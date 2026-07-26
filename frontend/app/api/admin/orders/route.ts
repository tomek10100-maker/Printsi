import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        total_amount,
        shipping_cost_eur,
        status,
        stripe_payment_intent_id,
        created_at,
        buyer_id,
        profiles!orders_buyer_id_fkey(full_name, email, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch order items for each order to get seller info and statuses
    const orderIds = (orders || []).map(o => o.id);
    const { data: items } = orderIds.length > 0
      ? await supabaseAdmin
          .from('order_items')
          .select('order_id, seller_id, status, price_at_purchase, quantity, offer_id, profiles!order_items_seller_id_fkey(full_name, email)')
          .in('order_id', orderIds)
      : { data: [] };

    const itemsByOrder: Record<string, any[]> = {};
    (items || []).forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    const enriched = (orders || []).map(order => ({
      ...order,
      items: itemsByOrder[order.id] || [],
    }));

    return NextResponse.json({ orders: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
