import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = tokenParam || authHeader.replace('Bearer ', '').trim();

    if (providedToken !== FURGONETKA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch orders that are paid and awaiting shipping
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        status,
        shipping_address,
        order_shipping_details (
          full_name,
          email,
          phone,
          address,
          city,
          zip_code,
          country
        ),
        order_items (
          id,
          quantity,
          price_at_purchase,
          offers (
            title
          )
        )
      `)
      .in('status', ['paid_awaiting_transfer', 'processing'])
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Format orders for Furgonetka
    const formattedOrders = orders?.map(order => {
      const shipping = order.order_shipping_details?.[0] || {};
      const [firstName, ...lastNameParts] = (shipping.full_name || 'Customer').split(' ');
      const lastName = lastNameParts.join(' ') || '';

      const shippingAddrJson = order.shipping_address as any;
      const selectedPoint = shippingAddrJson?.selected_point;

      return {
        order_id: order.id,
        status: order.status,
        date_add: order.created_at,
        total_amount: order.total_amount,
        currency: 'EUR', // Or get from order if available
        customer: {
          firstname: firstName,
          lastname: lastName,
          email: shipping.email || '',
          phone: shipping.phone || ''
        },
        delivery_address: {
          name: shipping.full_name || '',
          company: '',
          street: shipping.address || '',
          city: shipping.city || '',
          postcode: shipping.zip_code || '',
          country_code: shipping.country || 'PL'
        },
        // If there's a selected point (like Paczkomat), add it here for Furgonetka order import mapping
        ...(selectedPoint ? {
          pickup_point: selectedPoint.code,
          pickup_point_name: selectedPoint.name,
          service: selectedPoint.courier || 'inpost'
        } : {}),
        products: order.order_items?.map((item: any) => ({
          product_id: item.id,
          name: item.offers?.title || 'Produkt',
          quantity: item.quantity,
          price: item.price_at_purchase
        })) || []
      };
    }) || [];

    // Furgonetka API expects JSON array of orders
    return NextResponse.json(formattedOrders);

  } catch (error: any) {
    console.error('Furgonetka orders fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
