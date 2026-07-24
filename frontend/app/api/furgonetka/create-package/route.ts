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

/** Carriers that use point-to-point delivery (require pickup.point + receiver.point) */
const POINT_TO_POINT_CARRIERS = new Set(['inpost', 'orlen']);

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

function isPointToPoint(carrier: string): boolean {
  return POINT_TO_POINT_CARRIERS.has((carrier || '').trim().toLowerCase());
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

    // Check if package was already created to prevent duplicate shipments on multi-click
    if (item.status === 'shipped' || item.furgonetka_package_id) {
      console.log(`[CreatePackage Route] Package already created for item ${itemId}. Returning existing package info.`);
      return NextResponse.json({
        success: true,
        packageId: item.furgonetka_package_id,
        trackingNumber: item.tracking_code,
        labelUrl: item.label_url || `/api/furgonetka/label/${item.furgonetka_package_id}`,
        message: 'Package already created.'
      });
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
    // Helper function to sanitize phone numbers for Furgonetka (requires + prefix and country code e.g. +48500600700)
    const sanitizePhone = (phone: string, defaultPhone: string): string => {
      const raw = (phone || '').trim();
      if (raw.startsWith('+') && raw.replace(/\D/g, '').length >= 9) {
        return `+${raw.replace(/\D/g, '')}`;
      }
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 9) {
        const last9 = digits.slice(-9);
        return `+48${last9}`;
      }
      return `+48${defaultPhone}`;
    };

    // Helper function to sanitize names for Furgonetka (only letters and spaces, at least 2 words, each word >= 2 letters)
    const sanitizeName = (name: string, defaultName: string = 'Jan Kowalski'): string => {
      let clean = (name || '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
      if (!clean || clean.length < 3) return defaultName;
      const parts = clean.split(' ').filter(p => p.length >= 2);
      if (parts.length === 0) return defaultName;
      if (parts.length === 1) {
        return `${parts[0]} Kowalski`;
      }
      return parts.join(' ');
    };

    const pickupPhone = sanitizePhone(senderProfile.phone_number || (senderProfile as any).phone, '500600700');
    const receiverPhone = sanitizePhone(shippingDetails.phone, '600700800');

    const formatPolishPostcode = (zip: string): string => {
      // Strip ALL dashes/spaces before reformatting to avoid double-dash or missing-dash issues
      const clean = (zip || '').trim().replace(/[-\s]/g, '');
      if (/^\d{5}$/.test(clean)) {
        return `${clean.substring(0, 2)}-${clean.substring(2)}`;
      }
      return '02-222'; // Default fallback
    };

    const pickupName = sanitizeName(senderProfile.full_name, 'Jan Kowalski');
    const receiverName = sanitizeName(shippingDetails.full_name, 'Jan Kowalski');

    const receiverCountryCode = getCountryCode(shippingDetails.country);

    let receiverPostcode: string;
    let receiverCity: string;
    let receiverStreet: string;

    if (isPickupPoint) {
      // For paczkomat/pickup point shipments, the point code is what matters.
      // Address fields are irrelevant but Furgonetka still requires them - use safe fallbacks.
      receiverPostcode = formatPolishPostcode(
        selectedPoint.zip || selectedPoint.postcode || shippingDetails.zip_code || '02-222'
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
      pickupPostcode = '02-222';
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

    // Determine if this carrier requires point-to-point delivery
    const pointToPoint = isPointToPoint(carrier);

    // For point-to-point carriers, get the seller's drop-off point.
    // Use env var for the default pickup point (e.g. a nearby InPost/Orlen machine).
    // In sandbox, use a known test point code.
    const sandboxPickupPoint = process.env.FURGONETKA_SANDBOX_PICKUP_POINT || 'WAW01';
    const productionPickupPoint = process.env.FURGONETKA_PICKUP_POINT || '';
    const pickupPointCode = process.env.FURGONETKA_ENV === 'sandbox'
      ? sandboxPickupPoint
      : productionPickupPoint;

    // For point-to-point, validate we have a pickup point code
    if (pointToPoint && !pickupPointCode) {
      return NextResponse.json({
        success: false,
        error: 'Seller pickup point (FURGONETKA_PICKUP_POINT) is not configured. Please set it in your environment variables.',
        code: 'PICKUP_POINT_MISSING'
      }, { status: 400 });
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
          width: Math.max(15, Math.round(parcel.widthCm || 15)),
          height: Math.max(11, Math.round(parcel.heightCm || 11)),
          depth: Math.max(5, Math.round(parcel.lengthCm || 5)), // depth is used as length
          weight: Math.max(1, Math.ceil((parcel.weightGrams || 500) / 1000)), // weight in full integer kg
          type: 'package'
        }
      ],
      service_id: serviceId
    };

    // For point-to-point carriers (InPost, Orlen): set both pickup.point and receiver.point
    if (pointToPoint) {
      furgonetkaPayload.pickup.point = pickupPointCode;
      if (selectedPoint?.code) {
        furgonetkaPayload.receiver.point = selectedPoint.code;
      }
    } else if (selectedPoint?.code && selectedPoint?.courier && selectedPoint.courier.toLowerCase() === carrier.toLowerCase()) {
      // Pickup service matching carrier — add receiver.point
      furgonetkaPayload.receiver.point = selectedPoint.code;
    }

    console.log('[CreatePackage Route] Sending payload to Furgonetka:', JSON.stringify(furgonetkaPayload, null, 2));

    // 10.5 Proactively accept carrier regulations to prevent 409 terms_and_conditions_not_valid errors
    await furgonetkaClient.acceptRegulations();

    // 11. Call Furgonetka API: Create Draft Package (with auto-acceptance & point fallback)
    let createRes: any;
    try {
      createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
    } catch (err: any) {
      if (err.message && err.message.includes('terms_and_conditions_not_valid')) {
        console.warn('[CreatePackage Route] Regulations not accepted. Attempting auto-acceptance...');
        await furgonetkaClient.acceptRegulations();
        createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
      } else if (err.message && (err.message.includes('invalidPointName') || err.message.includes('poprawny punkt'))) {
        console.warn('[CreatePackage Route] Invalid point code. Retrying without point code restriction...');
        if (furgonetkaPayload.receiver) delete furgonetkaPayload.receiver.point;
        if (furgonetkaPayload.pickup) delete furgonetkaPayload.pickup.point;
        createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
      } else {
        throw err;
      }
    }

    if (!createRes || !createRes.package_id) {
      throw new Error(`Failed to create package draft: ${JSON.stringify(createRes)}`);
    }

    const packageId = createRes.package_id;
    console.log(`[CreatePackage Route] Created Furgonetka draft package ID: ${packageId}`);

    // 12. Call Furgonetka API: Confirm/Order Package (with auto-acceptance retry for terms)
    let orderRes: any;
    try {
      orderRes = await furgonetkaClient.orderPackage(packageId);
    } catch (err: any) {
      if (err.message && err.message.includes('terms_and_conditions_not_valid')) {
        console.warn('[CreatePackage Route] Regulations not accepted during ordering. Attempting auto-acceptance...');
        await furgonetkaClient.acceptRegulations();
        orderRes = await furgonetkaClient.orderPackage(packageId);
      } else {
        throw err;
      }
    }
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
    const userError = translateFurgonetkaError(error.message || 'Internal Server Error');
    return NextResponse.json({
      success: false,
      error: userError
    }, { status: 500 });
  }
}

const FURGONETKA_ERRORS_EN: Record<string, string> = {
  "terms_and_conditions_not_valid": "Carrier terms have changed. Please accept the new terms in your Furgonetka account.",
  "insufficient_funds": "Not enough funds in your account to create the package.",
  "invalidPointName": "The selected pickup point code is invalid for this carrier. Please contact customer support for assistance.",
  "packageWeightFullKg": "Package weight must be specified in full integer kilograms. Please contact customer support if you need help.",
  "packageMinimalDimensions": "Parcel dimensions must be at least 15 x 11 x 5 cm.",
  "notAlpha": "Name contains invalid characters. Please use letters only.",
  "notSizeMin": "Name or address details provided are too short.",
  "carrierConnectionError": "Carrier service connection timeout. Please try again in a few moments.",
  "packageAlreadyOrdered": "This package has already been ordered.",
  "packageNotFound": "Package not found in Furgonetka database.",
  "unauthorized": "Furgonetka account authorization failed.",
  "SENDER_ADDRESS_MISSING": "Please fill in your address, city, and zip code in your profile before shipping.",
  "RECEIVER_ADDRESS_MISSING": "Receiver address, city, or zip code is missing. Please check shipping details.",
  "PICKUP_POINT_MISSING": "Seller pickup point is not configured.",
};

function translateSingleError(e: any): string {
  const code = e?.code || '';
  const msg = e?.message || '';
  const path = e?.path || '';

  if (code && FURGONETKA_ERRORS_EN[code]) return FURGONETKA_ERRORS_EN[code];

  if (msg.includes('Numer kierunkowy') || msg.includes('kierunkowy') || msg.includes('poprzedzony +')) return 'Phone number requires an international country code prefix (e.g. +48).';
  if (msg.includes('regulamin') || code.includes('terms')) return FURGONETKA_ERRORS_EN['terms_and_conditions_not_valid'];
  if (msg.includes('poprawny punkt') || code.includes('invalidPointName') || path.includes('point')) return FURGONETKA_ERRORS_EN['invalidPointName'];
  if (msg.includes('pełnych kilogramach') || code.includes('packageWeightFullKg') || path.includes('weight')) return FURGONETKA_ERRORS_EN['packageWeightFullKg'];
  if (msg.includes('Minimalne wymiary') || code.includes('packageMinimalDimensions') || path.includes('width') || path.includes('height') || path.includes('depth')) return FURGONETKA_ERRORS_EN['packageMinimalDimensions'];
  if (msg.includes('składać się tylko z liter') || code.includes('notAlpha')) return FURGONETKA_ERRORS_EN['notAlpha'];
  if (msg.includes('za krótkie') || code.includes('notSizeMin')) return FURGONETKA_ERRORS_EN['notSizeMin'];
  if (msg.includes('9 cyfr')) return 'Phone number must contain exactly 9 digits.';

  if (msg) return msg;
  return 'Package details validation error occurred. Please contact customer support for assistance.';
}

function translateFurgonetkaError(message: string): string {
  let cleanMsg = message || '';

  // 1. Try to match exact error code from JSON errors array if present
  try {
    const jsonMatch = cleanMsg.match(/\{"errors":\s*(\[[\s\S]*?\])\}/);
    if (jsonMatch && jsonMatch[1]) {
      const errList = JSON.parse(jsonMatch[1]);
      if (Array.isArray(errList) && errList.length > 0) {
        const translatedList = Array.from(new Set(errList.map(translateSingleError)));
        return translatedList.join(' ');
      }
    }
  } catch (_) {}

  // 2. Keyword fallback matching
  for (const [code, translation] of Object.entries(FURGONETKA_ERRORS_EN)) {
    if (cleanMsg.includes(code)) {
      return translation;
    }
  }

  if (cleanMsg.includes('Numer kierunkowy') || cleanMsg.includes('kierunkowy') || cleanMsg.includes('poprzedzony +')) return 'Phone number requires an international country code prefix (e.g. +48).';
  if (cleanMsg.includes('regulamin')) return FURGONETKA_ERRORS_EN['terms_and_conditions_not_valid'];
  if (cleanMsg.includes('składać się tylko z liter')) return FURGONETKA_ERRORS_EN['notAlpha'];
  if (cleanMsg.includes('za krótkie')) return FURGONETKA_ERRORS_EN['notSizeMin'];
  if (cleanMsg.includes('9 cyfr')) return 'Phone number must contain exactly 9 digits.';
  if (cleanMsg.includes('pełnych kilogramach')) return FURGONETKA_ERRORS_EN['packageWeightFullKg'];
  if (cleanMsg.includes('Minimalne wymiary')) return FURGONETKA_ERRORS_EN['packageMinimalDimensions'];
  if (cleanMsg.includes('poprawny punkt')) return FURGONETKA_ERRORS_EN['invalidPointName'];

  // Strip raw JSON error string prefix if present
  cleanMsg = cleanMsg.replace(/^Furgonetka API error: \d+ [^.]+\. Details:\s*/i, '').trim();
  if (!cleanMsg.toLowerCase().includes('support') && !cleanMsg.toLowerCase().includes('please')) {
    cleanMsg += ' Please contact customer support for assistance.';
  }
  return cleanMsg;
}
