import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [{ data: profiles, error }, emailMap] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, full_name, roles, avatar_url, country, currency, created_at, onboarding_complete, stripe_account_id')
        .order('created_at', { ascending: false }),
      getAuthEmailMap(),
    ]);

    if (error) throw error;

    // Compute balance for every user
    const [
      { data: orderItemsByUser },
      { data: spentOrders },
      { data: payoutsAll },
    ] = await Promise.all([
      supabaseAdmin.from('order_items').select('seller_id, price_at_purchase, quantity, status'),
      supabaseAdmin.from('orders').select('buyer_id, total_amount, stripe_payment_intent_id'),
      supabaseAdmin.from('payouts').select('user_id, amount, status'),
    ]);

    const balanceMap: Record<string, number> = {};
    const earnedMap: Record<string, number> = {};

    (orderItemsByUser || []).forEach(item => {
      if (!balanceMap[item.seller_id]) balanceMap[item.seller_id] = 0;
      if (!earnedMap[item.seller_id]) earnedMap[item.seller_id] = 0;
      if (item.status === 'completed') {
        const amt = item.price_at_purchase * (item.quantity || 1);
        balanceMap[item.seller_id] += amt;
        earnedMap[item.seller_id] += amt;
      }
    });

    (spentOrders || []).forEach(order => {
      if (order.stripe_payment_intent_id?.startsWith('balance_')) {
        if (!balanceMap[order.buyer_id]) balanceMap[order.buyer_id] = 0;
        balanceMap[order.buyer_id] -= order.total_amount;
      }
    });

    (payoutsAll || []).forEach(p => {
      if (p.status === 'completed' || p.status === 'pending') {
        if (!balanceMap[p.user_id]) balanceMap[p.user_id] = 0;
        balanceMap[p.user_id] -= Number(p.amount);
      }
    });

    const enriched = (profiles || []).map(p => ({
      ...p,
      email: emailMap[p.id] || '',
      balance: Math.max(0, balanceMap[p.id] || 0),
      totalEarned: earnedMap[p.id] || 0,
    }));

    return NextResponse.json({ users: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
