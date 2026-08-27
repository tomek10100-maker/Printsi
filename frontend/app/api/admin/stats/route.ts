import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

let cachedStats: { data: any; expires: number } | null = null;

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  const now = Date.now();
  if (cachedStats && cachedStats.expires > now) {
    return NextResponse.json(cachedStats.data);
  }

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
      { data: allProfiles },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('offers').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total_amount'),
      supabaseAdmin.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'pending').gt('amount', 0),
      supabaseAdmin.from('payouts').select('amount').eq('status', 'pending').gt('amount', 0),
      supabaseAdmin.from('profiles').select('id, full_name, roles, avatar_url').limit(5),
      supabaseAdmin.from('orders').select('id, total_amount, status, created_at, buyer_id').order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('profiles').select('id, full_name'),
      getAuthEmailMap(),
    ]);

    const profileMap: Record<string, any> = {};
    (allProfiles || []).forEach(p => { profileMap[p.id] = p; });

    const enrichedUsers = (recentUsers || []).map(u => ({ ...u, email: emailMap[u.id] || '' }));
    const enrichedOrders = (recentOrders || []).map((o: any) => {
      const prof = profileMap[o.buyer_id];
      return {
        ...o,
        profiles: prof ? { ...prof, email: emailMap[o.buyer_id] || '' } : null,
      };
    });

    const totalRevenue = orders?.reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
    const pendingPayoutsTotal = pendingPayoutsData?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    const result = {
      totalUsers: totalUsers || 0,
      totalOffers: totalOffers || 0,
      totalOrders: totalOrders || 0,
      totalRevenue,
      pendingPayouts: pendingPayouts || 0,
      pendingPayoutsTotal,
      recentUsers: enrichedUsers,
      recentOrders: enrichedOrders,
    };

    cachedStats = { data: result, expires: now + 15000 };
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
