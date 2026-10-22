import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_TOKENS = [
  process.env.FURGONETKA_WEBHOOK_SECRET,
  'printsi2026',
  'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123',
].filter(Boolean);

export async function fetchFurgonetkaOrders(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = tokenParam || authHeader.replace('Bearer ', '').trim();

    if (!VALID_TOKENS.includes(providedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch orders that are paid and awaiting shipping
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        shipping_cost_eur,
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
            title,
            weight
          )
        )
      `)
      .in('status', ['paid', 'paid_awaiting_transfer', 'processing'])
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Format orders for Furgonetka (supports both Wzór API e-commerce 1.0.0 and custom shop schemas)
    const formattedOrders = orders?.map(order => {
      const shipping = order.order_shipping_details?.[0] || {};
      const shippingAddrJson = (order.shipping_address as any) || {};
      const selectedPoint = shippingAddrJson?.selected_point;

      let city = shipping.city || shippingAddrJson?.address?.city || selectedPoint?.city || '';
      let postcode = shipping.zip_code || shippingAddrJson?.address?.postal_code || selectedPoint?.zip || selectedPoint?.postcode || '';
      let street = (shipping.address || shippingAddrJson?.address?.line1 || selectedPoint?.street || selectedPoint?.name || '').replace(/,\s*\[object Object\]/g, '').trim();

      // If city or postcode is missing, attempt to extract from point name (e.g. "MURÁNSKA DLHÁ LÚKA 111, 05-001 MURÁNSKA DLHÁ LÚKA")
      if ((!city || !postcode) && selectedPoint?.name) {
        const match = selectedPoint.name.match(/(\d{2}[-\s]?\d{3})\s+([^,]+)/);
        if (match) {
          if (!postcode) postcode = match[1].trim();
          if (!city) city = match[2].trim();
        }
      }

      const fullName = (shipping.full_name || shippingAddrJson?.name || 'Customer').trim();
      const [firstName, ...lastNameParts] = fullName.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      const email = shipping.email || shippingAddrJson?.email || '';
      const phone = shipping.phone || shippingAddrJson?.phone || '';
      const countryCode = shipping.country || shippingAddrJson?.address?.country || 'PL';

      const courierService = selectedPoint?.courier || (selectedPoint ? 'inpost' : 'dpd');
      const pointCode = selectedPoint?.code || '';

      const products = order.order_items?.map((item: any) => ({
        id: String(item.id),
        product_id: String(item.id),
        name: item.offers?.title || 'Produkt 3D',
        quantity: Number(item.quantity) || 1,
        price: Number(item.price_at_purchase) || 0,
        weight: Number(item.offers?.weight) ? Number(item.offers.weight) / 1000 : 0.5
      })) || [];

      return {
        // E-commerce API (1.0.0) format:
        cartId: String(order.id),
        datetimeOrder: order.created_at,
        service: courierService,
        point: pointCode,
        codAmount: 0,
        comment: '',
        payment: {
          paid: true,
          method: 'online',
          amount: Number(order.total_amount) || 0
        },
        shipping: {
          method: courierService,
          cost: Number(order.shipping_cost_eur || 0)
        },
        shippingAddress: {
          firstname: firstName,
          lastname: lastName,
          name: fullName,
          company: '',
          street: street,
          building: '',
          apartment: '',
          postcode: postcode,
          city: city,
          country: countryCode,
          phone: phone,
          email: email
        },
        // Backward-compatibility keys for alternative / legacy custom shop parsers:
        id: String(order.id),
        order_id: String(order.id),
        status: order.status,
        date_add: order.created_at,
        total_amount: Number(order.total_amount) || 0,
        currency: 'EUR',
        customer: {
          firstname: firstName,
          lastname: lastName,
          name: fullName,
          email: email,
          phone: phone
        },
        delivery_address: {
          name: fullName,
          company: '',
          street: street,
          city: city,
          postcode: postcode,
          country_code: countryCode,
          phone: phone,
          email: email
        },
        pickup_point: pointCode,
        pickup_point_name: selectedPoint?.name || '',
        products
      };
    }) || [];

    // Furgonetka API expects JSON array of orders
    return NextResponse.json(formattedOrders);

  } catch (error: any) {
    console.error('Furgonetka orders fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return fetchFurgonetkaOrders(req);
}
