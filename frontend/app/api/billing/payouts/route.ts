import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // --- Validate balance ---
    // 1. Fetch total sales (completed)
    const { data: salesData } = await supabaseAdmin
      .from('order_items')
      .select('price_at_purchase, quantity')
      .eq('seller_id', user.id)
      .eq('status', 'completed'); // Only completed sales are payoutable

    const totalEarned = salesData?.reduce((acc, sale: any) => acc + (sale.price_at_purchase * (sale.quantity || 1)), 0) || 0;

    // 2. Fetch already requested payouts (pending or completed)
    const { data: payoutsData } = await supabaseAdmin
      .from('payouts')
      .select('amount')
      .eq('user_id', user.id)
      .in('status', ['pending', 'completed']);

    const totalPayouts = payoutsData?.reduce((acc, payout: any) => acc + Number(payout.amount), 0) || 0;

    const availableBalance = totalEarned - totalPayouts;

    if (amount > availableBalance) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // 3. Create payout record
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from('payouts')
      .insert({
        user_id: user.id,
        amount: Number(amount),
        status: 'pending'
      })
      .select()
      .single();

    if (payoutError) {
      throw new Error(payoutError.message);
    }

    return NextResponse.json({ success: true, payout });

  } catch (error: any) {
    console.error('Payout creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token || '');
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: payouts } = await supabaseAdmin
      .from('payouts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ payouts });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
