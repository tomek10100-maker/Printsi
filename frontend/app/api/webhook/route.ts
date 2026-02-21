import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

// Initialize Supabase with Service Role Key (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.text();

  const headersList = await headers();
  const signature = headersList.get('stripe-signature') as string;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET in .env.local');
    return new NextResponse('Missing Webhook Secret', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error(`Webhook Signature Error: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`✅ Payment successful: ${session.id}`);

    try {
      const userId = session.metadata?.userId;

      if (!userId) {
        console.warn('⚠️ Missing userId in metadata, skipping order creation.');
        return new NextResponse('OK', { status: 200 });
      }

      // --- 1. Create the order ---
      // FIX: Use correct column names matching the Supabase schema
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: userId,
          total_amount: session.amount_total ? session.amount_total / 100 : 0,
          status: 'paid',
          shipping_address: (session as any).shipping_details || session.customer_details || null,
          stripe_payment_intent_id: session.payment_intent as string || session.id,
        })
        .select()
        .single();

      if (orderError) {
        console.error('❌ Error creating order:', orderError);
        throw orderError;
      }

      const newOrderId = newOrder.id;
      console.log(`✅ Created new order ID: ${newOrderId}`);

      // --- 2. Retrieve line items from Stripe ---
      const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
        session.id,
        { expand: ['line_items.data.price.product'] }
      );

      const lineItems = sessionWithLineItems.line_items?.data || [];

      for (const item of lineItems) {
        const product = item.price?.product as Stripe.Product;
        const quantityBought = item.quantity || 1;
        const offerId = product.metadata?.offer_id;
        const sellerId = product.metadata?.seller_id;

        if (!offerId) {
          console.warn('⚠️ Product without offer_id, skipping...');
          continue;
        }

        console.log(`🔄 Processing offer ID: ${offerId}, qty: ${quantityBought}`);

        // --- 3. Decrease stock ---
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          row_id: offerId,       // UUID
          quantity_amt: quantityBought,
        });

        if (stockError) {
          console.error('❌ Stock update error:', stockError);
        } else {
          console.log('✅ Stock updated.');
        }

        // --- 4. Insert order_item ---
        // FIX: Removed buyer_id - column does not exist in order_items table
        if (sellerId) {
          const { error: itemError } = await supabase
            .from('order_items')
            .insert({
              order_id: newOrderId,
              offer_id: offerId,
              seller_id: sellerId,
              quantity: quantityBought,
              price_at_purchase: item.amount_total
                ? (item.amount_total / 100) / quantityBought
                : 0,
            });

          if (itemError) {
            console.error('❌ Error inserting order_item:', itemError);
          } else {
            console.log(`✅ order_item inserted for offer: ${offerId}`);
          }
        } else {
          console.warn('⚠️ Missing seller_id, skipping order_item insert.');
        }
      }

      console.log('🎉 Order processing complete!');
    } catch (err) {
      console.error('❌ Fatal error processing order:', err);
      return new NextResponse('Internal Error', { status: 500 });
    }
  }

  return new NextResponse('OK', { status: 200 });
}