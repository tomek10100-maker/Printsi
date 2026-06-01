import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '../../../lib/stripe';
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
            let chatId: string | null = null;
            try {
              const confirmResult = await processOrder(existing.id, userId);
              const chatResult = confirmResult.results?.find((r: string) => r.startsWith('chat_created:') || r.startsWith('chat_updated:'));
              if (chatResult) {
                chatId = chatResult.split(':')[1];
              }
            } catch (e) {
              console.error('⚠️ processOrder error on existing order:', e);
            }
            return NextResponse.json({ success: true, orderId: existing.id, alreadyExisted: true, chatId });
        }

        // Retrieve Stripe checkout session to get metadata and shipping info
        let session;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        } catch (stripeErr: any) {
            console.error('⚠️ Failed to retrieve Stripe session:', stripeErr);
        }

        const selectedPointStr = session?.metadata?.selected_point;
        let selectedPoint = null;
        if (selectedPointStr) {
            try {
                selectedPoint = JSON.parse(selectedPointStr);
            } catch (e) {
                console.error('Error parsing selectedPoint from metadata:', e);
            }
        }

        const shippingCustomStr = session?.metadata?.shipping_custom;
        let shippingCustom = null;
        if (shippingCustomStr) {
            try {
                shippingCustom = JSON.parse(shippingCustomStr);
            } catch (e) {
                console.error('Error parsing shippingCustom from metadata:', e);
            }
        }

        const shippingDetails = session ? ((session as any).shipping_details || session.customer_details) : null;
        const shippingAddress = {
            ...(shippingDetails || {}),
            ...(shippingCustom || {}),
            selected_point: selectedPoint || null
        };

        const orderAmount = session?.amount_total ? session.amount_total / 100 : (Number(totalEur) || 0);

        // 1. Create order
        const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
                buyer_id: userId,
                total_amount: orderAmount,
                status: 'paid',
                stripe_payment_intent_id: sessionId,
                shipping_cost_eur: Number(shippingCostEur) || 0,
                shipping_address: shippingAddress,
            })
            .select()
            .single();

        if (orderError || !newOrder) {
            throw new Error(`Failed to create order: ${orderError?.message}`);
        }

        console.log(`✅ Stripe order created: ${newOrder.id}`);

        // 1.5 Create the shipping details in order_shipping_details
        if (shippingDetails || shippingCustom) {
            const addressObj = shippingDetails?.address || {};
            
            const fullName = shippingCustom?.name || shippingDetails?.name || '';
            const email = shippingCustom?.email || session?.customer_details?.email || '';
            const phone = shippingCustom?.phone || shippingDetails?.phone || '';
            const addressLine = shippingCustom?.address?.line1 || shippingCustom?.address || addressObj.line1 || '';
            const city = shippingCustom?.address?.city || shippingCustom?.city || addressObj.city || '';
            const zipCode = shippingCustom?.address?.postal_code || shippingCustom?.zip || addressObj.postal_code || '';
            const country = shippingCustom?.address?.country || shippingCustom?.country || addressObj.country || '';

            const { error: shippingError } = await supabase
                .from('order_shipping_details')
                .insert({
                    order_id: newOrder.id,
                    full_name: fullName,
                    email: email,
                    phone: phone,
                    address: selectedPoint
                        ? `${selectedPoint.name || selectedPoint.code}, ${selectedPoint.street || addressLine}`
                        : addressLine,
                    city: city,
                    zip_code: zipCode,
                    country: country,
                });

            if (shippingError) {
                console.error('❌ Failed to save shipping details in /api/stripe/order:', shippingError);
            } else {
                console.log(`✅ Shipping details created for order: ${newOrder.id}`);
            }
        } else {
            // Fall back to buyer's profile address
            const { data: buyerProfile } = await supabase
                .from('profiles')
                .select('full_name, address, city, zip_code, country, phone, phone_number')
                .eq('id', userId)
                .single();
            if (buyerProfile) {
                const { error: shippingError } = await supabase
                    .from('order_shipping_details')
                    .insert({
                        order_id: newOrder.id,
                        full_name: buyerProfile.full_name || '',
                        email: '',
                        phone: buyerProfile.phone || buyerProfile.phone_number || '',
                        address: buyerProfile.address || '',
                        city: buyerProfile.city || '',
                        zip_code: buyerProfile.zip_code || '',
                        country: buyerProfile.country || 'PL',
                    });
                if (shippingError) {
                    console.error('Failed to save fallback shipping details:', shippingError);
                }
            }
        }

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
        let chatId: string | null = null;
        try {
          const confirmResult = await processOrder(newOrder.id, userId);
          if (!confirmResult.success) {
            console.error('⚠️ Order confirm step issues:', confirmResult);
          } else {
            const chatResult = confirmResult.results?.find((r: string) => r.startsWith('chat_created:') || r.startsWith('chat_updated:'));
            if (chatResult) {
              chatId = chatResult.split(':')[1];
            }
          }
        } catch (confirmErr) {
          console.error('⚠️ Order confirm threw error:', confirmErr);
        }

        return NextResponse.json({ success: true, orderId: newOrder.id, chatId });

    } catch (error: any) {
        console.error('❌ Stripe order creation error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
