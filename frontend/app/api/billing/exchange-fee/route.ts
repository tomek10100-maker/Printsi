import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    // 1. Calculate current balance (standard formula)
    const [sales, orders, payouts] = await Promise.all([
      supabaseAdmin.from('order_items').select('price_at_purchase, quantity, status').eq('seller_id', userId),
      supabaseAdmin.from('orders').select('total_amount').eq('buyer_id', userId).like('stripe_payment_intent_id', 'balance_%'),
      supabaseAdmin.from('payouts').select('amount, status').eq('user_id', userId)
    ]);

    const totalEarned = sales.data?.reduce((acc, s) => s.status === 'completed' ? acc + (s.price_at_purchase * (s.quantity || 1)) : acc, 0) || 0;
    const totalSpent = orders.data?.reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
    const totalPayouts = payouts.data?.reduce((acc, p) => (p.status === 'completed' || p.status === 'pending') ? acc + Number(p.amount) : acc, 0) || 0;

    const currentBalance = totalEarned - totalSpent - totalPayouts;

    if (currentBalance <= 0) {
      return NextResponse.json({ success: true, feeApplied: 0 });
    }

    // 3% Fee
    const fee = currentBalance * 0.03;

    // 2. Apply fee by inserting a payout record
    // We use a positive amount to represent a deduction/fee/withdrawal
    const { error: insertError } = await supabaseAdmin.from('payouts').insert({
      user_id: userId,
      amount: fee,
      status: 'completed'
    });

    if (insertError) throw insertError;

    return NextResponse.json({ 
      success: true, 
      feeApplied: fee,
      newBalance: currentBalance - fee 
    });

  } catch (error: any) {
    console.error('❌ Exchange Fee Apply Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
