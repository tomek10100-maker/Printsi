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

    // 2. CONVERT TO INTERNAL SYSTEM CURRENCY (EUR)
    // We take the EXACT paid amount from the Stripe Session to be 100% sure.
    const paidAmount = (session.amount_total || 0) / 100;
    const paidCurrency = (session.currency || 'EUR').toUpperCase();
    const paidRate = Number(session.metadata?.topup_rate || 1);
    
    // Internal EUR calculation for the database
    const amountInEur = paidAmount / paidRate;
    
    const negativeAmount = -Math.abs(amountInEur);

    console.log(`💰 [Topup API] Paid: ${paidAmount} ${(session.currency || 'EUR').toUpperCase()} -> Internal: ${amountInEur.toFixed(2)} EUR`);

    // 3. LOG TRANSACTION AS NEGATIVE PAYOUT
    const { error: txError } = await supabase.from('payouts').insert({
      user_id: userId,
      amount: negativeAmount,
      status: 'completed'
    });

    if (txError) {
      console.error('❌ [Topup API] DB Error:', txError);
      return NextResponse.json({ success: false, error: `DB Error: ${txError.message}` }, { status: 500 });
    }

    console.log(`✅ [Topup API] Credit added: ${negativeAmount} EUR`);
    return NextResponse.json({ 
      success: true, 
      amount: amountInEur,
      paidAmount: paidAmount,
      paidCurrency: (session.currency || 'EUR').toUpperCase()
    });

  } catch (error: any) {
    console.error('❌ [Topup API] Critical Exception:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
