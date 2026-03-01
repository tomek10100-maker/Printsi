import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, items, shipping, shippingCostEur } = await req.json();

    if (!items || items.length === 0 || !userId) {
      return NextResponse.json({ success: false, error: 'Invalid checkout data' }, { status: 400 });
    }

    // 1. Calculate cart total & grand total (in EUR)
    const cartTotalEur = items.reduce(
      (total: number, item: any) => total + (item.price * item.quantity), 0
    );
    const orderTotalEur = cartTotalEur + (shippingCostEur || 0);

    // 2. Calculate real balance from database (security – never trust the client)
    const { data: sales } = await supabase
      .from('order_items')
      .select('price_at_purchase, quantity')
      .eq('seller_id', userId);

    const totalEarned = sales?.reduce(
      (acc, s) => acc + (s.price_at_purchase * (s.quantity || 1)), 0
    ) || 0;

    const { data: prevOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('buyer_id', userId);

    const totalSpent = prevOrders?.reduce(
      (acc, o) => acc + Number(o.total_amount), 0
    ) || 0;

    const userBalance = Math.max(0, totalEarned - totalSpent);

    // 3. Check if user can afford the order
    if (userBalance < orderTotalEur) {
      return NextResponse.json({
        success: false,
        error: `Insufficient Printsi Balance. You have €${userBalance.toFixed(2)} but need €${orderTotalEur.toFixed(2)}`
      }, { status: 400 });
    }

    // 4. Create the order record
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: orderTotalEur,
        status: 'paid',
        shipping_address: shipping || null,
        stripe_payment_intent_id: `balance_${Date.now()}`,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    console.log(`✅ Balance order created: ${newOrder.id}`);

    // 5. Save detailed shipping info
    if (shipping && (shipping.address || shipping.fullName)) {
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

    // 6. Insert order items
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      offer_id: item.id,
      seller_id: item.seller_id,
      quantity: item.quantity,
      price_at_purchase: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // 7. Trigger chat creation + stock deduction + seller notifications
    //    via the shared /api/order/confirm endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const confirmRes = await fetch(`${baseUrl}/api/order/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: newOrder.id, userId }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmData.success) {
      console.error('⚠️ Order confirm step had issues:', confirmData);
    }

    console.log('🎉 Balance checkout complete!');
    return NextResponse.json({ success: true, orderId: newOrder.id });

  } catch (error: any) {
    console.error('❌ Balance Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}