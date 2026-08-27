import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import type Stripe from 'stripe';
import { getSiteUrl } from '@/app/lib/getSiteUrl';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const {
      items,
      email,
      selectedCurrency,
      exchangeRate,
      userId,
      shippingCostEur,
      shippingLabel,
      shipping,
      isTopup,
      topupAmount,
      selectedPoint,
      grandTotalEur,   // <-- exact total pre-calculated by checkout UI
    } = await req.json();

    // 1. Validation for standard checkout
    if (!isTopup && (!items || items.length === 0)) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!isTopup && items && items.length > 0 && userId) {
      const hasOwnItem = items.some((i: any) => i.seller_id === userId);
      if (hasOwnItem) {
        return NextResponse.json({ error: 'You cannot purchase your own listing.' }, { status: 400 });
      }
    }

    const currency = (selectedCurrency || 'eur').toLowerCase();
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (isTopup) {
      // 2. Handle Wallet Top-up
      const amount = Math.round(Number(topupAmount) * 100);
      line_items.push({
        price_data: {
          currency,
          product_data: {
            name: 'Printis Wallet Top-up',
            description: `Refilling digital balance for faster 3D marketplace transactions.`,
            images: ['https://raw.githubusercontent.com/lucide-react/lucide/main/icons/wallet.png'],
          },
          unit_amount: amount,
        },
        quantity: 1,
      });
    } else {
      // 3. Standard checkout — recalculate prices server-side from Supabase database
      // to ensure buyer cannot manipulate prices via HTTP request payload.
      const offerIds = items.map((i: any) => i.id);
      const { data: dbOffers } = await supabaseAdmin
        .from('offers')
        .select('id, price, user_id, title')
        .in('id', offerIds);

      const offerMap = new Map(dbOffers?.map((o: any) => [o.id, o]) || []);
      let itemsSubtotalEur = 0;
      for (const item of items) {
        const dbOffer = offerMap.get(item.id);
        const realPrice = dbOffer ? Number(dbOffer.price) : Number(item.price || 0);
        itemsSubtotalEur += realPrice * (Number(item.quantity) || 1);
      }

      const validatedShippingEur = Math.max(0, Number(shippingCostEur) || 0);
      const feeBaseEur = itemsSubtotalEur + validatedShippingEur;
      const isForeign = currency !== 'eur';
      const feesEur = feeBaseEur * (0.01 + 0.025 + (isForeign ? 0.015 : 0));
      const serverCalculatedTotalEur = feeBaseEur + feesEur;
      const safeExchangeRate = Number(exchangeRate) || 1;
      const totalInSmallestUnit = Math.max(50, Math.round(serverCalculatedTotalEur * safeExchangeRate * 100));

      // Build a human-readable order summary label
      const itemNames = items.map((i: any) => `${i.quantity}× ${i.name || i.title}`).join(', ');
      const summaryLabel = `Printis Order${itemNames.length <= 80 ? ': ' + itemNames : ''}`;

      line_items.push({
        price_data: {
          currency,
          product_data: {
            name: summaryLabel,
            description: [
              shippingLabel ? `Shipping: ${shippingLabel}` : null,
              'Includes Printis platform fees',
            ].filter(Boolean).join(' · '),
          },
          unit_amount: totalInSmallestUnit,
        },
        quantity: 1,
      });
    }

    // 4. Payment Methods
    const payment_method_types: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
    if (currency === 'pln') {
      payment_method_types.push('blik', 'p24');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'en',
      payment_method_types: payment_method_types,
      customer_email: email,
      line_items,
      metadata: {
        userId: userId,
        type: isTopup ? 'topup' : 'order',
        topup_amount: isTopup ? topupAmount.toString() : '0',
        topup_rate: isTopup ? exchangeRate.toString() : '1',
        items: isTopup ? '[]' : JSON.stringify(items.map((i: any) => ({ id: i.id, q: i.quantity }))).substring(0, 500),
        selected_point: selectedPoint ? JSON.stringify(selectedPoint) : '',
        shipping_custom: shipping ? JSON.stringify(shipping) : '',
      },
      success_url: `${getSiteUrl()}/success?session_id={CHECKOUT_SESSION_ID}&type=${isTopup ? 'topup' : 'order'}`,
      cancel_url: `${getSiteUrl()}/${isTopup ? 'profile/billing' : 'cart'}`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}