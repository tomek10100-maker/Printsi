import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Inicjalizacja (Standardowo)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { price, title, sellerId, userId } = await req.json();

    // 2. Pobieramy ID konta Stripe sprzedawcy (tego, kto ma dostać kasę)
    const { data: sellerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', sellerId)
      .single();

    const sellerStripeId = sellerProfile?.stripe_account_id;

    if (!sellerStripeId) {
      return NextResponse.json({ error: 'Seller is not connected to Stripe' }, { status: 400 });
    }

    // 3. Obliczamy prowizję (np. 10%)
    // Stripe operuje na groszach/centach, więc mnożymy * 100
    const priceInCents = Math.round(price * 100); 
    const applicationFee = Math.round(priceInCents * 0.10); // 10% dla Printis

    // 4. Tworzymy sesję płatności
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'blik', 'p24'], // Polskie metody + karty
      line_items: [
        {
          price_data: {
            currency: 'pln', // Lub 'eur'
            product_data: {
              name: title,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      // --- TU DZIEJE SIĘ MAGIA CONNECT ---
      payment_intent_data: {
        application_fee_amount: applicationFee, // Tyle bierzesz Ty
        transfer_data: {
          destination: sellerStripeId, // Tyle idzie do Sprzedawcy (Reszta)
        },
      },
      // -----------------------------------
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}