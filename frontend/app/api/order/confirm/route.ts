import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Currency symbols map
const CURRENCY_SYMBOLS: Record<string, string> = {
    EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr', CHF: 'Fr',
};

// Fetch exchange rates (EUR base) and convert amount
async function convertFromEur(amountEur: number, toCurrency: string): Promise<string> {
    const FALLBACK_RATES: Record<string, number> = {
        PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96,
    };
    try {
        if (toCurrency === 'EUR') return `€${amountEur.toFixed(2)}`;
        let rate = FALLBACK_RATES[toCurrency] || 1;
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
            if (res.ok) {
                const json = await res.json();
                if (json.rates?.[toCurrency]) rate = json.rates[toCurrency];
            }
        } catch { console.warn('⚠️ Exchange API failed, using fallback rate for', toCurrency); }
        const converted = Math.ceil(amountEur * rate * 100) / 100;
        const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + ' ';
        if (toCurrency === 'PLN') return `${converted.toFixed(2)} zł`;
        return `${symbol}${converted.toFixed(2)}`;
    } catch (err) {
        console.error('❌ convertFromEur error:', err);
        return `€${amountEur.toFixed(2)}`;
    }
}

// Fetch seller's preferred currency from profile
async function getSellerCurrency(sellerId: string): Promise<string> {
    const { data, error } = await supabase.from('profiles').select('currency').eq('id', sellerId).single();
    console.log(`💱 Seller ${sellerId} currency:`, data?.currency, error?.message || '');
    return data?.currency || 'EUR';
}

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

            // 5. Notify the seller with amount in their preferred currency
            const sellerCurrency = await getSellerCurrency(sellerId);
            const earnedEur = item.price_at_purchase * item.quantity;
            const formattedAmount = await convertFromEur(earnedEur, sellerCurrency);
            console.log(`💰 Seller notif: €${earnedEur} -> ${formattedAmount} (${sellerCurrency})`);
            await supabase.from('notifications').insert({
                user_id: sellerId,
                title: '🎉 New sale!',
                message: `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds added to your Printsi balance.`,
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
