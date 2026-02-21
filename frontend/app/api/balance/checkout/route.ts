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

    // 4. Create the order — FIX: use correct column names matching Supabase schema
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: cartTotalEur,
        status: 'paid',
        shipping_address: shipping || null,                        // FIX: was shipping_details
        stripe_payment_intent_id: `balance_${Date.now()}`,         // FIX: was stripe_session_id
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    console.log(`✅ Balance order created: ${newOrder.id}`);

    // 5. Insert order items — FIX: removed buyer_id (doesn't exist in order_items table)
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      offer_id: item.id,
      seller_id: item.user_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // 6. Decrement stock for each item
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
    }

    console.log('🎉 Balance checkout complete!');
    return NextResponse.json({ success: true, orderId: newOrder.id });

  } catch (error: any) {
    console.error('❌ Balance Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}