import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from '@/app/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

export async function POST(req: Request) {
  try {
    // 1. Authorization Check
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = authHeader.replace('Bearer ', '').trim();
    
    if (providedToken !== FURGONETKA_SECRET) {
      console.warn('[Furgonetka Webhook] Unauthorized request received:', { providedToken });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await req.json();
    console.log('📦 Furgonetka Webhook Received:', JSON.stringify(payload, null, 2));

    const packageId = payload.package_id || payload.id;
    const state = payload.state || payload.status;
    const trackingNumber = payload.tracking_number || payload.waybill || payload.number;

    if (!packageId) {
      console.warn('[Furgonetka Webhook] Missing package_id in webhook payload');
      return NextResponse.json({ success: true, message: 'Missing package_id, skipped' });
    }

    // 3. Find order item by Furgonetka package ID
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('*, offers(title, category)')
      .eq('furgonetka_package_id', String(packageId))
      .maybeSingle();

    if (itemError || !item) {
      console.warn(`[Furgonetka Webhook] Package ID ${packageId} not linked to any order item in Printsi.`);
      return NextResponse.json({ success: true, message: 'Package not found in records, acknowledged' });
    }

    // 4. Fetch Order, Buyer and Seller profiles
    const { data: order } = await supabase
      .from('orders')
      .select('buyer_id')
      .eq('id', item.order_id)
      .single();

    const { data: chatData } = await supabase
      .from('chats')
      .select('id, buyer_id, seller_id')
      .eq('order_id', item.order_id)
      .eq('offer_id', item.offer_id)
      .maybeSingle();

    const { data: shipping } = await supabase
      .from('order_shipping_details')
      .select('full_name, email')
      .eq('order_id', item.order_id)
      .maybeSingle();

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', item.seller_id)
      .maybeSingle();

    const buyerName = shipping?.full_name || 'Customer';
    const sellerName = sellerProfile?.full_name || 'Seller';
    const productTitle = item.offers?.title || 'Your Order';
    const activeTracking = trackingNumber || item.tracking_code || packageId.toString();

    // 5. Map Furgonetka status & trigger updates
    let messageContent = '';
    let messageType = 'system';
    let newStatus: string | null = null;
    let emailPromise: Promise<any> | null = null;

    switch (state) {
      case 'in_transit':
      case 'shipped':
        newStatus = 'shipped';
        messageContent = `The package is in transit. Tracking number: ${activeTracking}`;
        messageType = 'status_shipped';
        
        // Notify buyer if not already shipped
        if (item.status !== 'shipped' && shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `🚚 Your package is in transit! (${productTitle})`,
            html: EmailTemplates.trackingAddedBuyer(buyerName, productTitle, activeTracking)
          });
        }
        break;

      case 'out_for_delivery':
        newStatus = 'shipped'; // Keep state as shipped
        messageContent = `🚚 The package is out for delivery today!`;
        messageType = 'status_shipped';
        
        if (shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `🚚 Delivery today! (${productTitle})`,
            html: EmailTemplates.packageOutForDelivery(buyerName, productTitle, activeTracking)
          });
        }
        break;

      case 'delivered':
        newStatus = 'delivered';
        messageContent = `📬 The package has been delivered by the courier.`;
        messageType = 'status_delivered';
        
        if (sellerProfile?.email) {
          emailPromise = sendEmail({
            to: sellerProfile.email,
            subject: `📬 Package delivered: ${productTitle}`,
            html: EmailTemplates.orderDelivered(sellerName, buyerName, productTitle)
          });
        }
        break;

      case 'failed_attempt':
        newStatus = 'shipped'; // Keep state as shipped
        messageContent = `⚠️ Delivery attempt failed. The courier was unable to deliver the package.`;
        messageType = 'system';
        
        if (shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `⚠️ Delivery attempt failed: ${productTitle}`,
            html: EmailTemplates.packageDeliveryFailed(buyerName, productTitle)
          });
        }
        break;

      case 'returned':
        newStatus = 'shipped'; // Keep state as shipped
        messageContent = `🔄 The package has been returned to the sender.`;
        messageType = 'system';
        
        if (sellerProfile?.email) {
          emailPromise = sendEmail({
            to: sellerProfile.email,
            subject: `🔄 Package returned to sender: ${productTitle}`,
            html: EmailTemplates.packageReturned(sellerName, productTitle)
          });
        }
        break;

      default:
        console.log(`[Furgonetka Webhook] Unmapped state: ${state}, doing nothing.`);
        break;
    }

    // 6. Persist changes to database
    if (newStatus && item.status !== newStatus) {
      const { error: dbError } = await supabase
        .from('order_items')
        .update({ status: newStatus })
        .eq('id', item.id);
      if (dbError) throw dbError;
      console.log(`[Furgonetka Webhook] Updated item ${item.id} status to: ${newStatus}`);
    }

    // Insert Chat message
    if (chatData?.id && messageContent) {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatData.id,
          sender_id: item.seller_id, // Send from seller side to appear on the right side of the chat flow
          content: messageContent,
          message_type: messageType
        });
      if (msgError) throw msgError;
      console.log(`[Furgonetka Webhook] Inserted system message into chat ${chatData.id}`);
    }

    // Await email asynchronously to avoid blocking webhook response
    if (emailPromise) {
      emailPromise.catch(err => console.error('[Furgonetka Webhook] Non-fatal notification email failed:', err));
    }

    return NextResponse.json({ success: true, message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Furgonetka Webhook Handler Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
