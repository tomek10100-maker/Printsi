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

    // 1. Fetch current profile wallet balance
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const currentBal = Number(profile.wallet_balance || 0);
    const numAmount = Math.abs(Number(amount));
    const newBal = action === 'add' ? currentBal + numAmount : Math.max(0, currentBal - numAmount);

    // 2. Update user wallet balance directly
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: newBal })
      .eq('id', userId);

    if (updateErr) throw updateErr;

    // 3. Log transaction in payouts table with note
    const payoutAmount = action === 'add' ? -numAmount : numAmount;

    await supabaseAdmin.from('payouts').insert({
      user_id: userId,
      amount: payoutAmount,
      status: 'completed',
      stripe_payout_id: note ? `admin_adj: ${note}` : 'admin_adjustment',
    });

    return NextResponse.json({
      success: true,
      action,
      amount: numAmount,
      newBalance: newBal,
      note: note || '',
    });
  } catch (error: any) {
    console.error('[/api/admin/balance] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
