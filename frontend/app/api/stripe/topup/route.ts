import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '../../../lib/stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fallback rates if API fails
const FALLBACK_RATES: Record<string, number> = {
  PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96,
};

async function getEurAmount(amount: number, fromCurrency: string): Promise<number> {
  const currency = fromCurrency.toUpperCase();
  if (currency === 'EUR') return amount;

  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
    if (res.ok) {
      const json = await res.json();
      const rate = json.rates?.[currency];
      if (rate) return amount / rate;
    }
  } catch (err) {
    console.warn('⚠️ Exchange rate API failed for topup, using fallback for', currency);
  }

  const fallbackRate = FALLBACK_RATES[currency] || 1;
  return amount / fallbackRate;
}

export async function POST(req: Request) {
  try {
    const { userId, sessionId } = await req.json();

    console.log('💰 [Topup API] Finalizing Currency-Aware Topup for User:', userId);

    if (!userId || !sessionId) {
      return NextResponse.json({ success: false, error: 'Missing userId/sessionId' }, { status: 400 });
    }

    // 1. Verify the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ success: false, error: 'Payment not verified' }, { status: 400 });
    }

    // 2. Verify session belongs to the requesting user (anti-spoofing)
    if (session.metadata?.userId && session.metadata.userId !== userId) {
      console.warn(`⚠️ [Topup API] User mismatch: session owner=${session.metadata.userId}, requester=${userId}`);
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    // 3. Verify session type is topup
    if (session.metadata?.type && session.metadata.type !== 'topup') {
      return NextResponse.json({ success: false, error: 'Invalid session type' }, { status: 400 });
    }

    // 4. BULLETPROOF IDEMPOTENCY CHECK — Has this session already been credited?
    const targetPayoutId = `topup:${sessionId}`;
    const { data: existingPayouts } = await supabase
      .from('payouts')
      .select('id, stripe_payout_id')
      .eq('user_id', userId);

    const isAlreadyCredited = existingPayouts?.some((p: any) =>
      p.stripe_payout_id === targetPayoutId ||
      p.stripe_payout_id === sessionId ||
      p.stripe_session_id === sessionId
    );

    if (isAlreadyCredited) {
      console.log(`✅ [Topup API] Session ${sessionId} already credited for user ${userId}. Skipping duplicate credit.`);
      const paidAmount = (session.amount_total || 0) / 100;
      const paidCurrency = (session.currency || 'EUR').toUpperCase();
      return NextResponse.json({
        success: true,
        amount: paidAmount,
        paidAmount,
        paidCurrency,
        alreadyProcessed: true,
      });
    }

    // 5. CONVERT TO INTERNAL SYSTEM CURRENCY (EUR)
    const paidAmount = (session.amount_total || 0) / 100;
    const paidCurrency = (session.currency || 'EUR').toUpperCase();
    const paidRate = Number(session.metadata?.topup_rate || 1);
    
    // Internal EUR calculation for the database
    const amountInEur = paidAmount / paidRate;
    const negativeAmount = -Math.abs(amountInEur);

    console.log(`💰 [Topup API] Paid: ${paidAmount} ${paidCurrency} -> Internal: ${amountInEur.toFixed(2)} EUR`);

    // 6. LOG TRANSACTION AS NEGATIVE PAYOUT (negative = funds added to wallet)
    // Always supply `stripe_payout_id` which is guaranteed in payouts table
    const { error: txError } = await supabase.from('payouts').insert({
      user_id: userId,
      amount: negativeAmount,
      status: 'completed',
      stripe_payout_id: targetPayoutId,
      stripe_session_id: sessionId,
    });

    if (txError) {
      // If stripe_session_id column is missing, insert with stripe_payout_id which is guaranteed
      const { error: txError2 } = await supabase.from('payouts').insert({
        user_id: userId,
        amount: negativeAmount,
        status: 'completed',
        stripe_payout_id: targetPayoutId,
      });
      if (txError2) {
        console.error('❌ [Topup API] DB Error:', txError2);
        return NextResponse.json({ success: false, error: `DB Error: ${txError2.message}` }, { status: 500 });
      }
    }

    console.log(`✅ [Topup API] Credit added: ${negativeAmount} EUR`);
    return NextResponse.json({ 
      success: true, 
      amount: amountInEur,
      paidAmount: paidAmount,
      paidCurrency: paidCurrency,
    });

  } catch (error: any) {
    console.error('❌ [Topup API] Critical Exception:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
