import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [
      { data: orders, error: ordersErr },
      { data: profiles },
      { data: disputes },
      { data: chats },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select(`
          id,
          total_amount,
          shipping_cost_eur,
          status,
          stripe_payment_intent_id,
          created_at,
          buyer_id
        `)
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('profiles').select('id, full_name, avatar_url'),
      supabaseAdmin.from('disputes').select('*'),
      supabaseAdmin.from('chats').select('id, buyer_id, seller_id'),
      getAuthEmailMap(),
    ]);

    if (ordersErr) throw ordersErr;

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    const disputeByItem: Record<string, any> = {};
    (disputes || []).forEach(d => { disputeByItem[d.order_item_id] = d; });

    const chatMap: Record<string, string> = {};
    (chats || []).forEach(c => {
      chatMap[`${c.buyer_id}_${c.seller_id}`] = c.id;
      chatMap[`${c.seller_id}_${c.buyer_id}`] = c.id;
    });

    // Fetch order items for each order to get seller info and statuses
    const orderIds = (orders || []).map(o => o.id);
    const { data: items } = orderIds.length > 0
      ? await supabaseAdmin
          .from('order_items')
          .select('id, order_id, seller_id, status, price_at_purchase, quantity, offer_id')
          .in('order_id', orderIds)
      : { data: [] };

    const itemsByOrder: Record<string, any[]> = {};
    (items || []).forEach((item: any) => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      const sellerProf = profileMap[item.seller_id];
      const itemDispute = disputeByItem[item.id] || null;
      itemsByOrder[item.order_id].push({
        ...item,
        profiles: sellerProf ? { ...sellerProf, email: emailMap[item.seller_id] || '' } : null,
        dispute: itemDispute,
      });
    });

    const enriched = (orders || []).map((order: any) => {
      const buyerProf = profileMap[order.buyer_id];
      const enrichedItems = (itemsByOrder[order.id] || []).map(item => ({
        ...item,
        chat_id: item.dispute?.chat_id || chatMap[`${order.buyer_id}_${item.seller_id}`] || null,
      }));

      return {
        ...order,
        profiles: buyerProf ? { ...buyerProf, email: emailMap[order.buyer_id] || '' } : null,
        items: enrichedItems,
      };
    });

    return NextResponse.json({ orders: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
