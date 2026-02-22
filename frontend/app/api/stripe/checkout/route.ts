import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

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
    } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const currency = (selectedCurrency || 'eur').toLowerCase();

    // 1. Map cart items to Stripe line items
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => {
      const unitAmount = Math.round(item.price * exchangeRate * 100);
      return {
        price_data: {
          currency,
          product_data: {
            name: item.title,
            images: item.image_url ? [item.image_url] : [],
            metadata: {
              offer_id: item.id,
              seller_id: item.seller_id, // FIX: use seller_id not user_id
            },
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });

    // 2. Add DHL shipping as a separate line item
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

    // 3. Simplified items metadata (for webhook reference)
    const simplifiedItems = items.map((i: any) => ({
      id: i.id,
      seller_id: i.seller_id,
      quantity: i.quantity,
      price: i.price,
    }));

    // 4. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'blik', 'p24'],
      customer_email: email,
      line_items,
      metadata: {
        userId: userId,
        items: JSON.stringify(simplifiedItems).substring(0, 500),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cart`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}