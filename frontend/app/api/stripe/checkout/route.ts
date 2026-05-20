import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import type Stripe from 'stripe';
import { getSiteUrl } from '@/app/lib/getSiteUrl';

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
      selectedPoint
    } = await req.json();

    // 1. Validation for standard checkout
    if (!isTopup && (!items || items.length === 0)) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const currency = (selectedCurrency || 'eur').toLowerCase();
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (isTopup) {
      // 2. Handle Wallet Top-up
      // The amount is already in the user-selected currency from the UI.
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
      // 3. Handle Standard Cart items
      items.forEach((item: any) => {
        const unitAmount = Math.round(item.price * exchangeRate * 100);
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: item.name || item.title,
              images: item.image_url ? [item.image_url] : [],
              metadata: {
                offer_id: item.id,
                seller_id: item.seller_id,
              },
            },
            unit_amount: unitAmount,
          },
          quantity: item.quantity,
        });
      });

      // 4. Add DHL shipping
      if (shippingCostEur && shippingCostEur > 0) {
        const shippingAmount = Math.round(shippingCostEur * exchangeRate * 100);
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: shippingLabel || 'DHL Shipping',
              description: 'Door-to-door delivery via DHL Parcel Connect',
            },
            unit_amount: shippingAmount,
          },
          quantity: 1,
        });
      }
    }

    // 5. Payment Methods
    const payment_method_types: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];
    if (currency === 'pln') {
      payment_method_types.push('blik', 'p24');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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