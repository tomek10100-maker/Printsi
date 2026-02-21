import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

// Initialize Supabase with Service Role Key
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
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    console.error(`Webhook Signature Error: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`Payment successful: ${session.id}`);

    try {
      // Get userId from metadata
      const userId = session.metadata?.userId;
      
      // Create record in orders table
      let newOrderId: string | null = null;
      if (userId) {
         const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            buyer_id: userId,
            total_amount: session.amount_total ? session.amount_total / 100 : 0, 
            status: 'paid',
            // FIX: Bypass TypeScript strict checking for shipping_details
            shipping_details: (session as any).shipping_details || session.customer_details,
            stripe_session_id: session.id
          })
          .select()
          .single();
          
          if (orderError) throw orderError;
          newOrderId = newOrder.id;
          console.log(`Created new order ID: ${newOrderId}`);
      } else {
          console.warn('Missing userId in metadata, skipping order creation.');
      }

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

        if (offerId) {
            console.log(`Updating database: Removing ${quantityBought} items from ID: ${offerId}`);
            
            // 1. Decrease stock
            const { error: stockError } = await supabase.rpc('decrement_stock', {
                row_id: offerId,
                quantity_amt: quantityBought
            });

            if (stockError) console.error('Supabase SQL Error:', stockError);
            else console.log('Stock updated successfully.');

            // 2. Add records to order_items
            if (newOrderId && userId && sellerId) {
                const { error: itemError } = await supabase
                .from('order_items')
                .insert({
                    order_id: newOrderId,
                    offer_id: offerId,
                    buyer_id: userId,
                    seller_id: sellerId,
                    quantity: quantityBought,
                    price_at_purchase: item.amount_total ? (item.amount_total / 100) / quantityBought : 0 
                });

                if (itemError) console.error('Error adding order_item:', itemError);
            }
        } else {
            console.warn('Product without offer_id (might be shipping cost?)');
        }
      }
    } catch (err) {
      console.error('Error processing order:', err);
      return new NextResponse('Internal Error', { status: 500 });
    }
  }

  return new NextResponse('OK', { status: 200 });
}