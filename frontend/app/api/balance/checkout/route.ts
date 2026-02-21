import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Używamy klucza SERVICE_ROLE, aby bezpiecznie dodawać rekordy do bazy
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // WAŻNE: Upewnij się, że masz ten klucz w pliku .env.local
);

export async function POST(req: Request) {
  try {
    const { items, email, shipping } = await req.json();

    if (!items || items.length === 0 || !email) {
      return NextResponse.json({ success: false, error: 'Invalid checkout data' }, { status: 400 });
    }

    // 1. Odszukaj użytkownika w bazie Supabase na podstawie e-maila
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    const user = users?.users.find(u => u.email === email);

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 });
    }

    const userId = user.id;

    // 2. Oblicz sumę zamówienia (w EUR)
    const cartTotalEur = items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

    // 3. Sprawdź prawdziwe saldo użytkownika (żeby zabezpieczyć przed oszustwem)
    const { data: sales } = await supabase.from('order_items').select('price_at_purchase, quantity').eq('seller_id', userId);
    const totalEarned = sales?.reduce((acc, sale) => acc + (sale.price_at_purchase * (sale.quantity || 1)), 0) || 0;
    
    const { data: orders } = await supabase.from('orders').select('total_amount').eq('buyer_id', userId);
    const totalSpent = orders?.reduce((acc, order) => acc + order.total_amount, 0) || 0;

    const userBalance = totalEarned - totalSpent;

    // 4. Upewnij się, że użytkownika stać na zamówienie
    if (userBalance < cartTotalEur) {
      return NextResponse.json({ success: false, error: 'Insufficient Printsi Balance' }, { status: 400 });
    }

    // 5. Dodaj główne zamówienie do tabeli 'orders'
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: userId,
        total_amount: cartTotalEur,
        status: 'paid', // Oznaczamy od razu jako zapłacone, bo ściągamy z salda
        shipping_details: shipping,
        stripe_session_id: `balance_${Date.now()}` // Identyfikator płatności saldem
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      throw new Error(`Failed to create order: ${orderError?.message}`);
    }

    // 6. Dodaj poszczególne przedmioty do tabeli 'order_items'
    const orderItemsToInsert = items.map((item: any) => ({
      order_id: newOrder.id,
      offer_id: item.id,
      buyer_id: userId,
      seller_id: item.user_id, // Zakładam, że w koszyku trzymasz user_id sprzedawcy
      quantity: item.quantity,
      price_at_purchase: item.price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // Pomyślne zakończenie
    return NextResponse.json({ success: true, orderId: newOrder.id });

  } catch (error: any) {
    console.error('Balance Checkout Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}