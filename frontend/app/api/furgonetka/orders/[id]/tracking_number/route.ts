import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from '../../../../../lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleTrackingUpdate(req, resolvedParams.id);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleTrackingUpdate(req, resolvedParams.id);
}

async function handleTrackingUpdate(req: Request, orderId: string) {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = tokenParam || authHeader.replace('Bearer ', '').trim();

    if (providedToken !== FURGONETKA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    console.log(`📦 Furgonetka Tracking Update for order ${orderId}:`, payload);

    const trackingCode = (payload.tracking_number || payload.number || payload.waybill || '').toString();
    const courier = (payload.courier || payload.service || 'DHL').toString();

    if (trackingCode) {
      // 1. Update status and tracking code in database
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ 
          status: 'shipped',
          tracking_code: trackingCode 
        })
        .eq('order_id', orderId);

      if (updateError) {
        console.error('Error updating order status:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log(`✅ Order ${orderId} marked as shipped with tracking ${trackingCode}`);

      // 2. Fetch order info for emails (buyer email and seller email)
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_shipping_details (full_name, email),
          order_items (
            id,
            offers (title),
            seller_id,
            profiles:seller_id (full_name, email)
          )
        `)
        .eq('id', orderId)
        .single();

      if (!fetchError && order) {
        const shipping = order.order_shipping_details?.[0];
        const firstItem = order.order_items?.[0];
        const sellerProfile = (firstItem?.profiles as any)?.[0] || (firstItem?.profiles as any);
        const productTitle = (firstItem?.offers as any)?.[0]?.title || (firstItem?.offers as any)?.title || 'Your 3D Print';

        // 3. Send Email to Buyer
        if (shipping?.email) {
          try {
            await sendEmail({
              to: shipping.email,
              subject: `📦 Your package is on the way! (${productTitle})`,
              html: EmailTemplates.trackingAddedBuyer(
                shipping.full_name || 'Customer',
                productTitle,
                trackingCode
              )
            });
          } catch (e) { console.error('Buyer email error:', e); }
        }

        // 4. Send Email to Seller
        if (sellerProfile?.email) {
          try {
            await sendEmail({
              to: sellerProfile.email,
              subject: `🚚 Tracking added to your sale: ${productTitle}`,
              html: EmailTemplates.trackingAddedSeller(
                sellerProfile.full_name || 'Seller',
                productTitle,
                trackingCode
              )
            });
          } catch (e) { console.error('Seller email error:', e); }
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Furgonetka tracking update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
