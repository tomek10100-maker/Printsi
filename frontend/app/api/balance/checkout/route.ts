import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processOrder } from '../../../lib/processOrder';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, items, shipping, shippingCostEur, selectedPoint } = await req.json();

    if (!items || items.length === 0 || !userId) {
      return NextResponse.json({ success: false, error: 'Invalid checkout data' }, { status: 400 });
    }

    const hasOwnItem = items.some((i: any) => i.seller_id === userId);
    if (hasOwnItem) {
      return NextResponse.json({ success: false, error: 'You cannot purchase your own listing.' }, { status: 400 });
    }

    // 1. Calculate cart total & grand total (in EUR)
    const cartTotalEur = items.reduce(
      (total: number, item: any) => total + (item.price * item.quantity), 0
    );
    const orderTotalEur = cartTotalEur + (shippingCostEur || 0);

    // 2. Calculate real balance from database (security – never trust the client)
    const { data: sales, error: salesError } = await supabase
      .from('order_items')
      .select('price_at_purchase, quantity, status')
      .eq('seller_id', userId);

    let totalEarned = 0;
    if (!salesError && sales) {
      sales.forEach(s => {
        if (s.status !== 'cancelled' && s.status !== 'refunded') {
          totalEarned += s.price_at_purchase * (s.quantity || 1);
        }
      });
    }

    const { data: prevOrders } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('buyer_id', userId)
      .like('stripe_payment_intent_id', 'balance_%');

    const totalSpent = prevOrders?.reduce(
      (acc, o) => acc + Number(o.total_amount), 0
    ) || 0;

    const { data: payoutsData } = await supabase
      .from('payouts')
      .select('amount')
      .eq('user_id', userId)
      .in('status', ['pending', 'completed']);

    const totalPayouts = payoutsData?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    const userBalance = Math.max(0, totalEarned - totalSpent - totalPayouts);

    // 3. Check if user can afford the order (allow minor float rounding epsilon)
    if (userBalance + 0.01 < orderTotalEur) {
      return NextResponse.json({
        success: false,
        error: `Insufficient Printis Balance. You have €${userBalance.toFixed(2)} but need €${orderTotalEur.toFixed(2)}`
      }, { status: 400 });
    }

    // 4. Create the order record
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: orderTotalEur,
        shipping_cost_eur: Number(shippingCostEur) || 0,
        status: 'paid',
        shipping_address: {
          ...(shipping || {}),
          selected_point: selectedPoint || null
        },
        stripe_payment_intent_id: `balance_${Date.now()}`,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    console.log(`Balance order created: ${newOrder.id}`);

    // 5. Save detailed shipping info
    if (shipping) {
      // Shipping form was filled out — save it directly
      const { error: shippingError } = await supabase
        .from('order_shipping_details')
        .insert({
          order_id: newOrder.id,
          full_name: shipping.fullName || '',
          email: shipping.email || '',
          phone: shipping.phone || '',
          address: selectedPoint
            ? `${selectedPoint.name || selectedPoint.code}, ${selectedPoint.street || shipping.address || ''}`
            : shipping.address || '',
          city: shipping.city || '',
          zip_code: shipping.zip || '',
          country: shipping.country || '',
        });
      if (shippingError) {
        console.error('Failed to save shipping details:', shippingError);
      }
    } else {
      // No shipping form submitted (e.g. old cart item without category field)
      // Fall back to buyer's profile address so Furgonetka can still ship
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

    // 6. Insert order items (z informacjami o wariancie do zmniejszania filamentu)
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
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // 7. Trigger chat creation + stock deduction + seller notifications
    console.log('Processing order post-payment logic...');
    let chatId: string | null = null;
    
    // Process order asynchronously with 2.5s fast timeout for chat creation
    const processPromise = processOrder(newOrder.id, userId);

    try {
      const confirmResult: any = await Promise.race([
        processPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]);
      if (confirmResult?.results) {
        const chatResult = confirmResult.results.find((r: string) => r.startsWith('chat_created:') || r.startsWith('chat_updated:'));
        if (chatResult) {
          chatId = chatResult.split(':')[1];
        }
      }
    } catch (raceErr) {
      console.log('[Balance Checkout] processOrder running asynchronously in background...');
      processPromise.catch(pErr => console.error('[Balance Checkout Background] Error:', pErr));
    }

    // Fallback: fetch chat directly if not returned yet
    if (!chatId) {
      const firstSellerId = items[0]?.seller_id;
      if (firstSellerId) {
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('buyer_id', userId)
          .eq('seller_id', firstSellerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingChat) chatId = existingChat.id;
      }
    }

    console.log('Balance checkout complete!');
    return NextResponse.json({ success: true, orderId: newOrder.id, chatId });
  } catch (error: any) {
    console.error('Balance Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}