import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inicjalizacja Stripe z Twoim kluczem tajnym
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { items, email, selectedCurrency, exchangeRate, userId } = await req.json();

    // Walidacja koszyka
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 1. Mapowanie przedmiotów z koszyka na format Stripe
    const line_items = items.map((item: any) => {
      // Obliczamy cenę w wybranej walucie i zamieniamy na grosze/centy (Stripe wymaga integer)
      const unitAmount = Math.round(item.price * exchangeRate * 100);

      return {
        price_data: {
          currency: (selectedCurrency || 'eur').toLowerCase(),
          product_data: {
            name: item.title,
            images: item.image_url ? [item.image_url] : [],
            metadata: {
              offer_id: item.id,
              seller_id: item.user_id // Przechowujemy ID sprzedawcy dla Webhooka
            }
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });

    // 2. Przygotowanie uproszczonych danych przedmiotów do metadata
    // Stripe ma limit 500 znaków na pole w metadata, więc wysyłamy tylko niezbędne ID
    const simplifiedItems = items.map((i: any) => ({
      id: i.id,
      user_id: i.user_id,
      quantity: i.quantity,
      price: i.price // Cena bazowa w EUR
    }));

    // 3. Tworzenie sesji Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'blik', 'p24'],
      customer_email: email,
      line_items: line_items,
      // METADATA - To dzięki temu Webhook wie, co zapisać w bazie po płatności
      metadata: {
        userId: userId,
        items: JSON.stringify(simplifiedItems).substring(0, 500) // Zabezpieczenie limitu znaków
      },
      // Adresy powrotne (upewnij się, że NEXT_PUBLIC_APP_URL jest w .env)
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cart`,
    });

    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}