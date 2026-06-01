import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';
import { calculateParcel, parseDimensionString } from '@/app/lib/shippingRates';
import { parseWeightToGrams } from '@/app/lib/dhlRates';
import { sendTrackingAddedEmails } from '@/app/lib/sendNotificationEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const countryCodeMap: Record<string, string> = {
  'poland': 'PL',
  'polska': 'PL',
  'germany': 'DE',
  'deutschland': 'DE',
  'france': 'FR',
  'usa': 'US',
  'united states': 'US',
};

function getCountryCode(countryStr: string): string {
  const clean = (countryStr || '').trim().toLowerCase();
  return countryCodeMap[clean] || (clean.length === 2 ? clean.toUpperCase() : 'PL');
}

function getServiceId(carrier: string): number {
  const isSandbox = process.env.FURGONETKA_ENV !== 'production';
  const cleanCarrier = (carrier || 'dpd').trim().toLowerCase();

  if (isSandbox) {
    const sandboxMap: Record<string, number> = {
      'dpd': 11636590,
      'ups': 11636592,
      'inpost': 11636595,
      'orlen': 11636596,
      'dhl': 11636597,
      'fedex': 11636591,
      'poczta': 11636594,
      'gls': 11636593,
    };
    return sandboxMap[cleanCarrier] || 11636590;
  } else {
    const productionMap: Record<string, number> = {
      'dhl': 2,
      'dpd': 3,
      'gls': 4,
      'ups': 6,
      'inpost': 8,
      'poczta': 11,
      'fedex': 15,
      'orlen': 20,
    };
    return productionMap[cleanCarrier] || 3;
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { itemId, chatId } = await req.json();
    if (!itemId || !chatId) {
      return NextResponse.json({ success: false, error: 'Item ID and Chat ID are required' }, { status: 400 });
    }

    // 2. Fetch Order Item details
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('*, offers(title, dimensions, weight, category)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: 'Order item not found' }, { status: 404 });
    }

    const offer = item.offers as any;
    const isJob = offer?.category === 'job';

    // 3. Fetch Parent Order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', item.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Parent order not found' }, { status: 404 });
    }

    // 4. Verify Authorization/Roles
    const senderId = isJob ? order.buyer_id : item.seller_id;
    const receiverId = isJob ? item.seller_id : order.buyer_id;

    if (String(user.id) !== String(senderId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: You are not the sender of this order' }, { status: 403 });
    }

    // 5. Fetch Sender Profile (for pickup address)
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('full_name, address, city, zip_code, country, phone_number')
      .eq('id', senderId)
      .single();

    if (senderError || !senderProfile) {
      return NextResponse.json({ success: false, error: 'Sender profile address details not found' }, { status: 404 });
    }

    if (!senderProfile.address || !senderProfile.city || !senderProfile.zip_code) {
      return NextResponse.json({
        success: false,
        error: 'Please fill in your address, city, and zip code in your profile before shipping.',
        code: 'SENDER_ADDRESS_MISSING'
      }, { status: 400 });
    }

    // 6. Fetch Receiver Shipping Details
    const { data: shippingDetails, error: shippingError } = await supabase
      .from('order_shipping_details')
      .select('*')
      .eq('order_id', item.order_id)
      .maybeSingle();

    if (shippingError || !shippingDetails) {
      return NextResponse.json({ success: false, error: 'Recipient shipping address details not found' }, { status: 404 });
    }

    // 7. Parse Shipping Address / Selected Points
    const shippingAddrJson = order.shipping_address as any;
    const selectedPoint = shippingAddrJson?.selected_point;

    // 8. Determine Carrier / Service ID
    let carrier = 'dpd';
    if (selectedPoint?.courier) {
      carrier = selectedPoint.courier;
    }
    const serviceId = getServiceId(carrier);

    // 9. Calculate Parcel Dimensions and Weight
    const weightGrams = parseWeightToGrams(offer?.weight) || 500;
    const parsedDims = parseDimensionString(offer?.dimensions);
    const parcel = calculateParcel(parsedDims, weightGrams * item.quantity);

    // 10. Format Furgonetka POST /packages payload
    const pickupPhone = (senderProfile.phone_number || '500600700').replace(/[^\d+]/g, '');
    const receiverPhone = (shippingDetails.phone || '600700800').replace(/[^\d+]/g, '');

    const furgonetkaPayload: any = {
      pickup: {
        name: senderProfile.full_name || 'Sender',
        street: senderProfile.address,
        postcode: senderProfile.zip_code,
        city: senderProfile.city,
        country_code: getCountryCode(senderProfile.country),
        phone: pickupPhone,
        email: user.email || 'sender@printis.store'
      },
      receiver: {
        name: shippingDetails.full_name || 'Recipient',
        street: selectedPoint
          ? selectedPoint.street || shippingDetails.address
          : shippingDetails.address,
        postcode: shippingDetails.zip_code,
        city: shippingDetails.city,
        country_code: getCountryCode(shippingDetails.country),
        phone: receiverPhone,
        email: shippingDetails.email || 'recipient@printis.store'
      },
      parcels: [
        {
          width: parcel.widthCm,
          height: parcel.heightCm,
          depth: parcel.lengthCm, // depth is used as length
          weight: Math.max(0.1, parcel.weightGrams / 1000), // weight in kg
          type: 'package'
        }
      ],
      service_id: serviceId
    };

    // If point is selected, add it to receiver
    if (selectedPoint?.code) {
      furgonetkaPayload.receiver.point = selectedPoint.code;
    }

    console.log('[CreatePackage Route] Sending payload to Furgonetka:', JSON.stringify(furgonetkaPayload, null, 2));

    // 11. Call Furgonetka API: Create Draft Package
    const createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
    if (!createRes || !createRes.package_id) {
      throw new Error(`Failed to create package draft: ${JSON.stringify(createRes)}`);
    }

    const packageId = createRes.package_id;
    console.log(`[CreatePackage Route] Created Furgonetka draft package ID: ${packageId}`);

    // 12. Call Furgonetka API: Confirm/Order Package
    const orderRes = await furgonetkaClient.orderPackage(packageId);
    console.log(`[CreatePackage Route] Confirmed Furgonetka package successfully:`, orderRes);

    // Retrieve details to get the final waybill / tracking code
    const packageDetails = await furgonetkaClient.getPackageDetails(packageId);
    const trackingNumber = packageDetails?.parcels?.[0]?.package_no || packageDetails?.pickup_number || packageId.toString();

    // 13. Update Database
    const { error: updateError } = await supabase
      .from('order_items')
      .update({
        status: 'shipped',
        tracking_code: trackingNumber,
        furgonetka_package_id: String(packageId),
        label_url: `/api/furgonetka/label/${packageId}`
      })
      .eq('id', itemId);

    if (updateError) {
      throw new Error(`Package created on Furgonetka (${packageId}) but failed to update database: ${updateError.message}`);
    }

    // 14. Insert System Message in Chat
    const labelUrl = `/api/furgonetka/label/${packageId}`;
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content: `The seller has shipped the package via Furgonetka (${carrier.toUpperCase()}). Tracking number: ${trackingNumber}. You can download the shipping label below.`,
      message_type: 'status_shipped'
    });

    // 15. Trigger emails
    try {
      await sendTrackingAddedEmails(
        order.buyer_id,
        item.seller_id,
        offer?.title || 'Your Order',
        trackingNumber,
        shippingDetails.email,
        shippingDetails.full_name
      );
    } catch (emailErr) {
      console.error('[CreatePackage Route] Non-fatal notification email failure:', emailErr);
    }

    return NextResponse.json({
      success: true,
      packageId,
      trackingNumber,
      labelUrl
    });

  } catch (error: any) {
    console.error('❌ Furgonetka package creation route error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
