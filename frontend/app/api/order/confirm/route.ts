import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/order/confirm
 * Called after a successful payment (balance or Stripe).
 * Creates chat threads and sends confirmation messages for each order item.
 *
 * Body: { orderId: string, userId: string }
 */
export async function POST(req: Request) {
    try {
        const { orderId, userId } = await req.json();

        if (!orderId || !userId) {
            return NextResponse.json({ success: false, error: 'Missing orderId or userId' }, { status: 400 });
        }

        // 1. Fetch all order items for this order
        const { data: orderItems, error: itemsErr } = await supabase
            .from('order_items')
            .select('offer_id, seller_id, quantity, price_at_purchase')
            .eq('order_id', orderId);

        if (itemsErr || !orderItems?.length) {
            console.error('❌ Could not fetch order items:', itemsErr);
            return NextResponse.json({ success: false, error: 'Order items not found' }, { status: 404 });
        }

        // 2. Fetch offer details (title, is_custom, parent_offer_id) for each item
        const offerIds = orderItems.map(i => i.offer_id);
        const { data: offers } = await supabase
            .from('offers')
            .select('id, title, is_custom, parent_offer_id')
            .in('id', offerIds);

        const offerMap: Record<string, any> = {};
        (offers || []).forEach(o => { offerMap[o.id] = o; });

        const results: string[] = [];

        for (const item of orderItems) {
            const offer = offerMap[item.offer_id] || {};
            const isCustom = offer.is_custom;
            const parentOfferId = offer.parent_offer_id;
            const title = offer.title || 'your item';
            const chatOfferId = (isCustom && parentOfferId) ? parentOfferId : item.offer_id;
            const sellerId = item.seller_id;

            if (!sellerId) continue;

            // 3. Find or create the chat thread
            const { data: existingChat } = await supabase
                .from('chats')
                .select('id')
                .eq('buyer_id', userId)
                .eq('seller_id', sellerId)
                .eq('offer_id', chatOfferId)
                .maybeSingle();

            let chatId = existingChat?.id;

            if (!chatId) {
                const { data: newChat, error: chatErr } = await supabase
                    .from('chats')
                    .insert({
                        buyer_id: userId,
                        seller_id: sellerId,
                        offer_id: chatOfferId,
                        order_id: orderId,
                    })
                    .select('id')
                    .single();

                if (chatErr) {
                    console.error('❌ Failed to create chat:', chatErr);
                    results.push(`chat_fail:${item.offer_id}`);
                    continue;
                }
                chatId = newChat.id;
                results.push(`chat_created:${chatId}`);
            } else {
                // Update existing chat to link to this order
                await supabase
                    .from('chats')
                    .update({ order_id: orderId })
                    .eq('id', chatId);
                results.push(`chat_updated:${chatId}`);
            }

            // 4. Post order confirmation messages to the chat
            // ── System message (shown as buyer message)
            await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: userId,
                content: `🛍️ Order placed! I just purchased **${item.quantity}x ${title}**. Looking forward to receiving it! 🎉`,
            });

            // ── Seller automated confirmation reply
            await supabase.from('messages').insert({
                chat_id: chatId,
                sender_id: sellerId,
                content: `✅ Thank you for your order! I've received your purchase of **${item.quantity}x ${title}**. I'll prepare it for shipping as soon as possible and will keep you updated here. 📦`,
            });

            // 5. Notify the seller
            await supabase.from('notifications').insert({
                user_id: sellerId,
                title: '🎉 New sale!',
                message: `You sold ${item.quantity}x "${title}" for €${(item.price_at_purchase * item.quantity).toFixed(2)}. Funds added to your Printsi balance.`,
                type: 'sale',
                is_read: false,
            });

            // 6. Decrement stock
            const { error: stockErr } = await supabase.rpc('decrement_stock', {
                row_id: item.offer_id,
                quantity_amt: item.quantity,
            });
            if (stockErr) {
                console.error(`❌ Stock update failed for offer ${item.offer_id}:`, stockErr);
            }

            // Also decrement parent offer stock for custom orders
            if (isCustom && parentOfferId) {
                await supabase.rpc('decrement_stock', {
                    row_id: parentOfferId,
                    quantity_amt: item.quantity,
                });
            }
        }

        console.log('✅ Order confirmed, chats created:', results);
        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('❌ Order confirm error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
