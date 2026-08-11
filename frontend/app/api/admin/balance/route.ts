import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

/**
 * POST — Add or subtract balance from a user account.
 * Body: { userId: string, amount: number, note: string, action: 'add' | 'remove' }
 */
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { userId, amount, note, action } = await req.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 });
    }

    // 1. Verify user profile exists using guaranteed columns (id, full_name)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error('[/api/admin/balance] Profile lookup error:', profileErr);
      return NextResponse.json({ error: 'User profile not found in database' }, { status: 404 });
    }

    const numAmount = Math.abs(Number(amount));
    // Negative amount in payouts = credit added to user wallet balance
    // Positive amount in payouts = debit removed from user wallet balance
    const payoutAmount = action === 'add' ? -numAmount : numAmount;

    // 2. Log transaction in payouts table (which computes live wallet balance across system)
    const { error: insertErr } = await supabaseAdmin.from('payouts').insert({
      user_id: userId,
      amount: payoutAmount,
      status: 'completed',
      stripe_payout_id: note ? `admin_adj: ${note}` : 'admin_adjustment',
    });

    if (insertErr) {
      console.error('[/api/admin/balance] DB Insert Error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action,
      amount: numAmount,
      note: note || '',
    });
  } catch (error: any) {
    console.error('[/api/admin/balance] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
