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
      if (rate) return amount / rate; // amount in GBP / (GBP/EUR rate) = EUR
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

    // 4. IDEMPOTENCY CHECK — has this session already been credited?
    const { data: existing, error: existingErr } = await supabase
      .from('payouts')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .limit(1);

    if (existingErr) {
      // If the column doesn't exist yet, log and continue (will fix with migration)
      console.warn('⚠️ [Topup API] stripe_session_id column may not exist yet:', existingErr.message);
    } else if (existing && existing.length > 0) {
      // Already processed — return success without doing anything
      console.log(`✅ [Topup API] Session ${sessionId} already credited. Returning cached success.`);
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
    const { error: txError } = await supabase.from('payouts').insert({
      user_id: userId,
      amount: negativeAmount,
      status: 'completed',
      stripe_session_id: sessionId,
    });

    if (txError) {
      // If column doesn't exist, retry without it
      if (txError.message?.includes('stripe_session_id')) {
        console.warn('⚠️ [Topup API] stripe_session_id column missing — inserting without it.');
        const { error: txError2 } = await supabase.from('payouts').insert({
          user_id: userId,
          amount: negativeAmount,
          status: 'completed',
        });
        if (txError2) {
          console.error('❌ [Topup API] DB Error:', txError2);
          return NextResponse.json({ success: false, error: `DB Error: ${txError2.message}` }, { status: 500 });
        }
      } else {
        console.error('❌ [Topup API] DB Error:', txError);
        return NextResponse.json({ success: false, error: `DB Error: ${txError.message}` }, { status: 500 });
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
