import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from '@/app/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

// 1. Handle ping/GET verification from Furgonetka webhook settings validation
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Furgonetka webhook endpoint active' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    // If Furgonetka sends empty POST test ping during URL validation
    if (!bodyText || bodyText.trim() === '') {
      return NextResponse.json({ status: 'ok', message: 'Validation ping received' }, { status: 200 });
    }

    // 1. Authorization Check (if secret is set & header is provided)
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = authHeader.replace('Bearer ', '').trim();

    if (FURGONETKA_SECRET && authHeader && providedToken !== FURGONETKA_SECRET) {
      console.warn('[Furgonetka Webhook] Unauthorized request received:', { providedToken });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      console.warn('[Furgonetka Webhook] Non-JSON test payload received:', bodyText);
      return NextResponse.json({ status: 'ok', message: 'Non-JSON payload acknowledged' }, { status: 200 });
    }

    console.log('📦 Furgonetka Webhook Received:', JSON.stringify(payload, null, 2));

    const packageId = payload.package_id || payload.id;
    const state = payload.state || payload.status;
    const trackingNumber = payload.tracking_number || payload.waybill || payload.number;

    if (!packageId) {
      console.warn('[Furgonetka Webhook] Missing package_id in webhook payload (test ping)');
      return NextResponse.json({ success: true, message: 'Missing package_id, acknowledged test ping' }, { status: 200 });
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
    const estimatedDelivery = payload.estimated_delivery_date || payload.eta || null;
    let messageContent = '';
    let messageType = 'system';
    let newStatus: string | null = null;
    let emailPromise: Promise<any> | null = null;

    // Always persist tracking number and carrier if we have them
    const trackingUpdates: Record<string, any> = {};
    if (trackingNumber && !item.tracking_number) {
      trackingUpdates.tracking_number = trackingNumber;
    }
    const carrierName = payload.carrier || payload.service || payload.courier || null;
    if (carrierName && !item.carrier) {
      trackingUpdates.carrier = carrierName;
    }
    if (estimatedDelivery) {
      trackingUpdates.estimated_delivery_date = estimatedDelivery;
    }

    switch (state) {
      case 'in_transit':
      case 'shipped':
        newStatus = 'shipped';
        messageType = 'status_tracking';
        messageContent = JSON.stringify({
          type: 'tracking_update',
          event: 'in_transit',
          carrier: carrierName || 'Courier',
          tracking_number: activeTracking,
          estimated_delivery: estimatedDelivery,
          location: payload.location || payload.description || null,
        });

        // Notify buyer if not already shipped
        if (item.status !== 'shipped' && shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `🚚 Your package is on its way! (${productTitle})`,
            html: EmailTemplates.trackingAddedBuyer(buyerName, productTitle, activeTracking)
          });
        }
        break;

      case 'out_for_delivery':
        newStatus = 'shipped'; // Keep state as shipped
        messageType = 'status_tracking';
        messageContent = JSON.stringify({
          type: 'tracking_update',
          event: 'out_for_delivery',
          carrier: carrierName || 'Courier',
          tracking_number: activeTracking,
          estimated_delivery: null,
          location: payload.location || null,
        });

        if (shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `📦 Delivery today! (${productTitle})`,
            html: EmailTemplates.packageOutForDelivery(buyerName, productTitle, activeTracking)
          });
        }
        break;

      case 'delivered': {
        newStatus = 'delivered';
        const deliveredAt = new Date();
        const confirmDeadline = new Date(deliveredAt.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
        trackingUpdates.delivered_at = deliveredAt.toISOString();
        trackingUpdates.buyer_confirm_deadline = confirmDeadline.toISOString();
        messageType = 'status_delivered';
        messageContent = JSON.stringify({
          type: 'delivered',
          carrier: carrierName || 'Courier',
          tracking_number: activeTracking,
          delivered_at: deliveredAt.toISOString(),
          confirm_deadline: confirmDeadline.toISOString(),
        });

        // FIX: email goes to BUYER (not seller) — prompts them to confirm receipt
        if (shipping?.email) {
          emailPromise = sendEmail({
            to: shipping.email,
            subject: `✅ Your package has been delivered! (${productTitle})`,
            html: EmailTemplates.orderDelivered(buyerName, sellerName, productTitle)
          });
        }
        break;
      }

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

    // 6. Persist status + tracking fields to database
    const dbUpdate: Record<string, any> = { ...trackingUpdates };
    if (newStatus && item.status !== newStatus) {
      dbUpdate.status = newStatus;
    }
    if (Object.keys(dbUpdate).length > 0) {
      const { error: dbError } = await supabase
        .from('order_items')
        .update(dbUpdate)
        .eq('id', item.id);
      if (dbError) throw dbError;
      console.log(`[Furgonetka Webhook] Updated item ${item.id}:`, dbUpdate);
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
