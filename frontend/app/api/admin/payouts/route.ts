import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [{ data: payouts, error }, { data: { users: authUsers } }] = await Promise.all([
      supabaseAdmin
        .from('payouts')
        .select('id, amount, status, created_at, user_id, profiles!payouts_user_id_fkey(full_name, avatar_url, payout_iban, payout_recipient_name)')
        .order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    if (error) throw error;

    const emailMap: Record<string, string> = {};
    (authUsers || []).forEach(u => { emailMap[u.id] = u.email || ''; });

    const enriched = (payouts || []).map((p: any) => ({
      ...p,
      profiles: p.profiles ? { ...p.profiles, email: emailMap[p.user_id] || '' } : null,
    }));

    return NextResponse.json({ payouts: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Approve or reject a payout request
 * Body: { payoutId: string, action: 'approve' | 'reject' }
 */
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { payoutId, action } = await req.json();

    if (!payoutId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'completed' : 'failed';

    const { error } = await supabaseAdmin
      .from('payouts')
      .update({ status: newStatus })
      .eq('id', payoutId);

    if (error) throw error;
    return NextResponse.json({ success: true, newStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
