import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processOrder } from '../../../lib/processOrder';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stripe/order
 * Called from the success page after a Stripe redirect.
 * Creates the order + order_items in the database, then calls /api/order/confirm
 * to create chats and send notifications.
 *
 * Body: { userId, items, sessionId, totalEur, shippingCostEur }
 */
export async function POST(req: Request) {
    try {
        const { userId, items, sessionId, totalEur, shippingCostEur } = await req.json();

        if (!userId || !items?.length || !sessionId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // Check if this session was already processed (idempotency)
        const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', sessionId)
            .maybeSingle();

        if (existing) {
            console.log('ℹ️ Order already exists for session:', sessionId);
            // Still trigger confirm in case chats weren't created
        try {
          await processOrder(existing.id, userId);
        } catch (e) {
          console.error('⚠️ processOrder error on existing order:', e);
        }
        return NextResponse.json({ success: true, orderId: existing.id, alreadyExisted: true });
        }

        // 1. Create order
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                buyer_id: userId,
                total_amount: Number(totalEur) || 0,
                status: 'paid',
                stripe_payment_intent_id: sessionId,
            })
            .select()
            .single();

        if (orderError || !newOrder) {
            throw new Error(`Failed to create order: ${orderError?.message}`);
        }

        console.log(`✅ Stripe order created: ${newOrder.id}`);

        // 2. Insert order items
        const orderItemsToInsert = items.map((item: any) => ({
            order_id: newOrder.id,
            offer_id: item.id,
            seller_id: item.seller_id,
            quantity: item.quantity,
            price_at_purchase: item.price,
            variant_name: item.variant_name || null,
            variant_color_hex: item.variant_color || null,
            variant_layers: item.variant_layers || null,
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItemsToInsert);

        if (itemsError) {
            console.error('❌ Failed to create order items:', itemsError);
            // Don't throw – order is created, items might partially fail
        }

        // 3. Trigger chat creation + stock + notifications
        try {
          const confirmResult = await processOrder(newOrder.id, userId);
          if (!confirmResult.success) {
            console.error('⚠️ Order confirm step issues:', confirmResult);
          }
        } catch (confirmErr) {
          console.error('⚠️ Order confirm threw error:', confirmErr);
        }

        return NextResponse.json({ success: true, orderId: newOrder.id });

    } catch (error: any) {
        console.error('❌ Stripe order creation error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
