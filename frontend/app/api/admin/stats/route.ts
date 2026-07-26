import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [
      { count: totalUsers },
      { count: totalOffers },
      { count: totalOrders },
      { data: orders },
      { count: pendingPayouts },
      { data: pendingPayoutsData },
      { data: recentUsers },
      { data: recentOrders },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('offers').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total_amount'),
      supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'pending').gt('amount', 0),
      supabaseAdmin.from('payouts').select('amount').eq('status', 'pending').gt('amount', 0),
      supabaseAdmin.from('profiles').select('id, full_name, roles, avatar_url, created_at').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('orders').select('id, total_amount, status, created_at, buyer_id, profiles!orders_buyer_id_fkey(full_name)').order('created_at', { ascending: false }).limit(10),
      getAuthEmailMap(),
    ]);

    const enrichedUsers = (recentUsers || []).map(u => ({ ...u, email: emailMap[u.id] || '' }));
    const enrichedOrders = (recentOrders || []).map((o: any) => ({
      ...o,
      profiles: o.profiles ? { ...o.profiles, email: emailMap[o.buyer_id] || '' } : null,
    }));

    const totalRevenue = orders?.reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
    const pendingPayoutsTotal = pendingPayoutsData?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalOffers: totalOffers || 0,
      totalOrders: totalOrders || 0,
      totalRevenue,
      pendingPayouts: pendingPayouts || 0,
      pendingPayoutsTotal,
      recentUsers: enrichedUsers,
      recentOrders: enrichedOrders,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
