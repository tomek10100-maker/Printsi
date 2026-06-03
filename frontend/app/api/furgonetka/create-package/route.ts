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
  const cleanCarrier = (carrier || 'dpd').trim().toLowerCase();
  const map: Record<string, number> = {
    'dpd': 11636590,
    'ups': 11636592,
    'inpost': 11636595,
    'orlen': 11636596,
    'dhl': 11636597,
    'fedex': 11636591,
    'poczta': 11636594,
    'gls': 11636593,
  };
  return map[cleanCarrier] || 11636590;
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

    const cleanAddress = (senderProfile.address || '').trim();
    const cleanCity = (senderProfile.city || '').trim();
    const cleanZipCode = (senderProfile.zip_code || '').trim();

    if (!cleanAddress || !cleanCity || !cleanZipCode) {
      return NextResponse.json({
        success: false,
        error: 'Please fill in your address, city, and zip code in your profile before shipping.',
        code: 'SENDER_ADDRESS_MISSING'
      }, { status: 400 });
    }

    // 6. Parse selected point (paczkomat/pickup point) from order
    const orderShippingAddr = order.shipping_address as any;
    const selectedPoint = orderShippingAddr?.selected_point;
    const isPickupPoint = !!selectedPoint?.code;

    // 7. Fetch Receiver Shipping Details
    const { data: dbShippingDetails } = await supabase
      .from('order_shipping_details')
      .select('*')
      .eq('order_id', item.order_id)
      .maybeSingle();

    let shippingDetails: any = dbShippingDetails || (orderShippingAddr && (orderShippingAddr.fullName || orderShippingAddr.address || orderShippingAddr.phone) ? {
      full_name: orderShippingAddr.fullName || orderShippingAddr.name || 'Recipient',
      address: orderShippingAddr.address || orderShippingAddr.address?.line1 || orderShippingAddr.line1 || '',
      city: orderShippingAddr.city || orderShippingAddr.address?.city || '',
      zip_code: orderShippingAddr.zip || orderShippingAddr.zip_code || orderShippingAddr.address?.postal_code || '',
      country: orderShippingAddr.country || orderShippingAddr.address?.country || 'PL',
      email: orderShippingAddr.email || orderShippingAddr.customer_details?.email || '',
      phone: orderShippingAddr.phone || orderShippingAddr.customer_details?.phone || ''
    } : null);

    if (!shippingDetails) {
      // For pickup points (paczkomat) we only need phone - no home address required.
      // For door-to-door the seller fills in the address via a separate form.
      // Fetch whatever info we have from buyer profile (name, phone).
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name, address, city, zip_code, country, phone, phone_number')
        .eq('id', receiverId)
        .single();

      shippingDetails = {
        full_name: buyerProfile?.full_name || 'Recipient',
        address: buyerProfile?.address || '',
        city: buyerProfile?.city || '',
        zip_code: buyerProfile?.zip_code || '',
        country: buyerProfile?.country || 'PL',
        email: '',
        phone: buyerProfile?.phone || buyerProfile?.phone_number || '',
      };
    }


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

    // Format pickup and receiver name to contain at least 2 words
    const formatFullname = (name: string, defaultName: string): string => {
      const clean = (name || '').trim();
      if (!clean) return defaultName;
      const parts = clean.split(/\s+/);
      if (parts.length < 2) {
        return `${clean} ${defaultName.split(' ')[1] || 'User'}`;
      }
      return clean;
    };

    const formatPolishPostcode = (zip: string): string => {
      // Strip ALL dashes/spaces before reformatting to avoid double-dash or missing-dash issues
      const clean = (zip || '').trim().replace(/[-\s]/g, '');
      if (/^\d{5}$/.test(clean)) {
        return `${clean.substring(0, 2)}-${clean.substring(2)}`;
      }
      return '00-001'; // Default fallback
    };

    const pickupName = formatFullname(senderProfile.full_name, 'Sender Name');
    const receiverName = formatFullname(shippingDetails.full_name, 'Recipient Name');

    const receiverCountryCode = getCountryCode(shippingDetails.country);

    let receiverPostcode: string;
    let receiverCity: string;
    let receiverStreet: string;

    if (isPickupPoint) {
      // For paczkomat/pickup point shipments, the point code is what matters.
      // Address fields are irrelevant but Furgonetka still requires them - use safe fallbacks.
      receiverPostcode = formatPolishPostcode(
        selectedPoint.zip || selectedPoint.postcode || shippingDetails.zip_code || '00-001'
      );
      receiverCity = (selectedPoint.city || shippingDetails.city || 'Warszawa').substring(0, 40);
      receiverStreet = 'Przykładowa 1';
    } else {
      const rawReceiverPostcode = (shippingDetails.zip_code || shippingDetails.zip || '')?.trim();
      receiverPostcode = receiverCountryCode === 'PL' ? formatPolishPostcode(rawReceiverPostcode) : rawReceiverPostcode;
      receiverCity = (shippingDetails.city || '')?.trim();
      receiverStreet = (shippingDetails.address || '')?.trim();

      if (receiverStreet && !/\d/.test(receiverStreet)) {
        receiverStreet = `${receiverStreet} 1`;
      }

      // Furgonetka/DHL limit: street max 60 characters
      if (receiverStreet && receiverStreet.length > 60) {
        receiverStreet = receiverStreet.substring(0, 60).trimEnd();
      }

      if (!receiverPostcode || !receiverCity || !receiverStreet) {
        return NextResponse.json({
          success: false,
          error: 'Receiver address, city, or zip code is missing. Please check shipping details.',
          code: 'RECEIVER_ADDRESS_MISSING'
        }, { status: 400 });
      }
    }

    let pickupPostcode = formatPolishPostcode(cleanZipCode);
    let pickupCity = cleanCity.length > 1 ? cleanCity : 'Warszawa';
    let pickupStreet = cleanAddress.length > 2 ? cleanAddress : 'Borkowska 1';

    // In sandbox, force a 100% valid Polish sender address to avoid any postal code / city mismatches or missing building number errors
    if (process.env.FURGONETKA_ENV === 'sandbox') {
      pickupPostcode = '00-001';
      pickupCity = 'Warszawa';
      pickupStreet = 'Borkowska 1';
      if (receiverStreet && pickupStreet.toLowerCase() === receiverStreet.toLowerCase()) {
        pickupStreet = 'Borkowska 2';
      }
    } else {
      if (pickupStreet && !/\d/.test(pickupStreet)) {
        pickupStreet = `${pickupStreet} 1`;
      }
    }

    // Furgonetka/DHL limit: street max 60 characters
    if (pickupStreet && pickupStreet.length > 60) {
      pickupStreet = pickupStreet.substring(0, 60).trimEnd();
    }

    const furgonetkaPayload: any = {
      pickup: {
        name: pickupName,
        street: pickupStreet,
        postcode: pickupPostcode,
        city: pickupCity,
        country_code: 'PL', // Pickup must always be in Poland for Furgonetka
        phone: pickupPhone,
        email: user.email || 'sender@printis.store'
      },
      receiver: {
        name: receiverName,
        street: receiverStreet,
        postcode: receiverPostcode,
        city: receiverCity,
        country_code: receiverCountryCode,
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

    // If point is selected, add it to receiver (skip in sandbox to avoid "invalid point" errors)
    if (selectedPoint?.code && process.env.FURGONETKA_ENV !== 'sandbox') {
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
