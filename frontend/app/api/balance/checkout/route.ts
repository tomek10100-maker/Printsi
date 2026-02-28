import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, items, shipping } = await req.json();

    if (!items || items.length === 0 || !userId) {
      return NextResponse.json({ success: false, error: 'Invalid checkout data' }, { status: 400 });
    }

    // 1. Calculate cart total (in EUR)
    const cartTotalEur = items.reduce(
      (total: number, item: any) => total + (item.price * item.quantity), 0
    );

    // 2. Calculate real balance from database (security check - never trust the client)
    const { data: sales } = await supabase
      .from('order_items')
      .select('price_at_purchase, quantity')
      .eq('seller_id', userId);

    const totalEarned = sales?.reduce(
      (acc, s) => acc + (s.price_at_purchase * (s.quantity || 1)), 0
    ) || 0;

    const { data: orders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('buyer_id', userId);

    const totalSpent = orders?.reduce(
      (acc, o) => acc + Number(o.total_amount), 0
    ) || 0;

    // Balance can NEVER go below 0
    const userBalance = Math.max(0, totalEarned - totalSpent);

    // 3. Check if user can afford the order
    if (userBalance < cartTotalEur) {
      return NextResponse.json({
        success: false,
        error: `Insufficient Printsi Balance. You have €${userBalance.toFixed(2)} but need €${cartTotalEur.toFixed(2)}`
      }, { status: 400 });
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: cartTotalEur,
        status: 'paid',
        shipping_address: shipping || null,                        // Możesz to z czasem usunąć, zostawiam dla bezpieczeństwa
        stripe_payment_intent_id: `balance_${Date.now()}`,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    console.log(`✅ Balance order created: ${newOrder.id}`);

    // 4.5 Insert detailed shipping info
    if (shipping) {
      const { error: shippingError } = await supabase
        .from('order_shipping_details')
        .insert({
          order_id: newOrder.id,
          full_name: shipping.fullName || '',
          email: shipping.email || '',
          address: shipping.address || '',
          city: shipping.city || '',
          zip_code: shipping.zip || '',
          country: shipping.country || '',
        });

      if (shippingError) {
        console.error('❌ Failed to save shipping details:', shippingError);
      }
    }

    // 5. Insert order items — FIX: removed buyer_id (doesn't exist in order_items table)
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      offer_id: item.id,
      seller_id: item.seller_id, // FIX: was item.user_id (undefined!)
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // 6. Decrement stock & notify each seller
    for (const item of items) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        row_id: item.id,
        quantity_amt: item.quantity,
      });
      if (stockError) {
        console.error(`❌ Stock update failed for offer ${item.id}:`, stockError);
      } else {
        console.log(`✅ Stock updated for offer: ${item.id}`);
      }

      // Notify the seller
      if (item.seller_id) {
        const earned = item.price * item.quantity;
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: item.seller_id, // FIX: was item.user_id
            title: '🎉 You made a sale!',
            message: `Your product "${item.title}" (x${item.quantity}) was purchased for ${earned.toFixed(2)} EUR. Funds added to your Printsi balance.`,
            type: 'sale',
            is_read: false,
          });

        if (notifError) {
          console.error(`❌ Notification error for seller ${item.seller_id}:`, notifError);
        } else {
          console.log(`✅ Notification sent to seller: ${item.seller_id}`);
        }

        // --- 8. Create or Update Chat between Buyer & Seller ---
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('buyer_id', userId)
          .eq('seller_id', item.seller_id)
          .eq('offer_id', item.id)
          .single();

        let chatId = existingChat?.id;

        if (!chatId) {
          const { data: newChat, error: chatError } = await supabase
            .from('chats')
            .insert({
              buyer_id: userId,
              seller_id: item.seller_id,
              offer_id: item.id,
              order_id: newOrder.id,
            })
            .select('id')
            .single();

          if (!chatError) chatId = newChat.id;
        }

        if (chatId) {
          // Buyer initial message
          await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: userId,
            content: `📦 Hey! I just bought ${item.quantity}x of ${item.title}. Looking forward to it!`,
          });
          // Seller automated reply
          await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: item.seller_id,
            content: `✅ Hello! I received your order for ${item.quantity} items. I am preparing the shipping label and will send it soon.`,
          });
        }
      }
    }

    console.log('🎉 Balance checkout complete!');
    return NextResponse.json({ success: true, orderId: newOrder.id });

  } catch (error: any) {
    console.error('❌ Balance Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}