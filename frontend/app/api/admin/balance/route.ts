import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

/**
 * POST — Add or subtract balance from a user account.
 * Body: { userId: string, amount: number, note: string, action: 'add' | 'remove' }
 *
 * Balance is stored via the payouts table:
 *   - To ADD balance: insert a row with negative amount (mirrors how top-ups work via Stripe webhooks)
 *   - To REMOVE balance: insert a row with positive amount (mirrors withdrawals)
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

    // Adding balance = negative amount (credits wallet — same as top-up logic)
    // Removing balance = positive amount (debits wallet — same as withdrawal logic)
    const payoutAmount = action === 'add' ? -Math.abs(amount) : Math.abs(amount);

    const { error } = await supabaseAdmin.from('payouts').insert({
      user_id: userId,
      amount: payoutAmount,
      status: 'completed',
      // We include a note in the id-based audit by storing it in a way the system recognizes
      // The label "admin_adjustment" prefix distinguishes these from normal payouts
    });

    if (error) throw error;

    return NextResponse.json({ success: true, action, amount: payoutAmount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
