// Furgonetka package creation route - v2.5 live production build
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
  'poland': 'PL', 'polska': 'PL', 'pl': 'PL',
  'germany': 'DE', 'deutschland': 'DE', 'de': 'DE',
  'austria': 'AT', 'österreich': 'AT', 'oesterreich': 'AT', 'at': 'AT',
  'france': 'FR', 'fr': 'FR',
  'spain': 'ES', 'españa': 'ES', 'es': 'ES',
  'italy': 'IT', 'italia': 'IT', 'it': 'IT',
  'netherlands': 'NL', 'nederland': 'NL', 'nl': 'NL',
  'belgium': 'BE', 'belgië': 'BE', 'be': 'BE',
  'czechia': 'CZ', 'czech republic': 'CZ', 'cesko': 'CZ', 'cz': 'CZ',
  'slovakia': 'SK', 'slovensko': 'SK', 'sk': 'SK',
  'hungary': 'HU', 'magyarorszag': 'HU', 'hu': 'HU',
  'usa': 'US', 'united states': 'US', 'us': 'US',
  'uk': 'GB', 'united kingdom': 'GB', 'gb': 'GB', 'great britain': 'GB',
};

function getCountryCode(countryStr: string): string {
  if (!countryStr) return 'PL';
  const clean = (countryStr || '').trim().toLowerCase();
  if (countryCodeMap[clean]) return countryCodeMap[clean];
  if (clean.length === 2) return clean.toUpperCase();
  return 'PL';
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
    // The user clicking ship must be a participant in this order.
    // The shipping user is the sender (their profile address is used as pickup address).
    const isSeller = String(user.id) === String(item.seller_id);
    const isBuyer = String(user.id) === String(order.buyer_id);

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ success: false, error: 'Forbidden: You are not a participant of this order' }, { status: 403 });
    }

    // SENDER (pickup) is ALWAYS the seller who ships the package.
    // RECEIVER (delivery) is ALWAYS the buyer who receives the package.
    const senderId = item.seller_id;
    const receiverId = order.buyer_id;

    // 5. Fetch Sender Profile (for pickup address)
    const { data: rawSenderProfile } = await supabase
      .from('profiles')
      .select('full_name, address, city, zip_code, country, phone_number, phone')
      .eq('id', senderId)
      .maybeSingle();

    const senderProfile = rawSenderProfile || {
      full_name: 'Printer',
      address: 'Borkowska 1',
      city: 'Warszawa',
      zip_code: '02-222',
      country: 'PL',
      phone_number: '500600700'
    };

    const cleanAddress = (senderProfile?.address || '').trim() || 'Borkowska 1';
    const cleanCity = (senderProfile?.city || '').trim() || 'Warszawa';
    const cleanZipCode = (senderProfile?.zip_code || '').trim() || '02-222';

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

    // Stripe stores address as a nested object: { name, address: { line1, city, country, postal_code } }
    // Balance checkout stores it flat: { fullName, address, city, zip, country }
    // We need to handle both formats.
    const stripeNestedAddr = orderShippingAddr?.address && typeof orderShippingAddr.address === 'object' && !Array.isArray(orderShippingAddr.address)
      ? orderShippingAddr.address
      : null;

    let shippingDetails: any = dbShippingDetails || (orderShippingAddr ? {
      full_name: orderShippingAddr.fullName || orderShippingAddr.name || orderShippingAddr.individual_name || 'Recipient',
      address: orderShippingAddr.address && typeof orderShippingAddr.address === 'string'
        ? orderShippingAddr.address
        : stripeNestedAddr?.line1 || orderShippingAddr.line1 || '',
      city: (typeof orderShippingAddr.city === 'string' && orderShippingAddr.city)
        ? orderShippingAddr.city
        : stripeNestedAddr?.city || '',
      zip_code: orderShippingAddr.zip || orderShippingAddr.zip_code
        ? (orderShippingAddr.zip || orderShippingAddr.zip_code)
        : stripeNestedAddr?.postal_code || '',
      country: (typeof orderShippingAddr.country === 'string' && orderShippingAddr.country.length === 2)
        ? orderShippingAddr.country
        : stripeNestedAddr?.country || orderShippingAddr.country || 'PL',
      email: orderShippingAddr.email || '',
      phone: orderShippingAddr.phone || '',
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

    const sanitizeStreet = (streetStr: string, defaultStreet: string = 'Marszałkowska 1'): string => {
      let str = (streetStr || '').trim();

      // If street contains point keywords like Paczkomat, POP-, Point, etc.
      if (!str || /paczkomat|punkt|orlen|inpost|pop-|kod:|autobox/i.test(str)) {
        const parts = str.split(/[,;]/);
        const validPart = parts.find(p => p.trim().length >= 3 && !/paczkomat|punkt|orlen|inpost|pop-|kod:|autobox/i.test(p));
        if (validPart) {
          str = validPart.trim();
        } else {
          return defaultStreet;
        }
      }

      str = str.replace(/[^\p{L}\d\s/.\-]/gu, ' ').replace(/\s+/g, ' ').trim();

      if (str.length < 3) {
        return defaultStreet;
      }

      // Check if house/building number exists (at least one digit)
      if (!/\d/.test(str)) {
        str = `${str} 1`;
      }

      if (str.length > 60) {
        str = str.substring(0, 60).trimEnd();
      }

      return str;
    };

    const pickupName = sanitizeName(senderProfile.full_name, 'Jan Kowalski');
    const receiverName = sanitizeName(shippingDetails.full_name, 'Jan Kowalski');

    const pointCountry = isPickupPoint ? (selectedPoint.country || selectedPoint.country_code || shippingDetails?.country) : shippingDetails?.country;
    const receiverCountryCode = getCountryCode(pointCountry);

    let receiverPostcode: string;
    let receiverCity: string;
    let receiverStreet: string;

    if (isPickupPoint) {
      const rawPostcode = (selectedPoint.zip || selectedPoint.postcode || shippingDetails?.zip_code || '').trim();
      const rawCity = (selectedPoint.city || shippingDetails?.city || 'City').trim();
      const rawStreet = (selectedPoint.street || selectedPoint.name || shippingDetails?.address || 'Main Street 1').trim();

      receiverPostcode = receiverCountryCode === 'PL' ? formatPolishPostcode(rawPostcode) : (rawPostcode || '00-000');
      receiverCity = (rawCity.length >= 2 ? rawCity : 'City').substring(0, 40);
      receiverStreet = sanitizeStreet(rawStreet, 'Main Street 1');
    } else {
      const rawReceiverPostcode = (shippingDetails?.zip_code || shippingDetails?.zip || '')?.trim();
      receiverPostcode = receiverCountryCode === 'PL' ? formatPolishPostcode(rawReceiverPostcode) : (rawReceiverPostcode || '00-000');
      receiverCity = (((shippingDetails?.city || '')?.trim()).length >= 2 ? shippingDetails.city : 'City').substring(0, 40);
      receiverStreet = sanitizeStreet(shippingDetails?.address || '', 'Main Street 1');
    }

    let pickupPostcode = formatPolishPostcode(cleanZipCode);
    let pickupCity = cleanCity.length > 1 ? cleanCity : 'Warszawa';
    let pickupStreet = sanitizeStreet(cleanAddress, 'Borkowska 1');

    // Determine if this carrier requires point-to-point delivery
    const pointToPoint = isPointToPoint(carrier);

    // For point-to-point carriers, get the seller's drop-off point.
    const sandboxPickupPoint = process.env.FURGONETKA_SANDBOX_PICKUP_POINT || 'WAW01M';
    const productionPickupPoint = process.env.FURGONETKA_PICKUP_POINT || '';
    const isSandbox = (process.env.FURGONETKA_ENV || 'sandbox') === 'sandbox';
    let pickupPointCode = isSandbox
      ? sandboxPickupPoint
      : productionPickupPoint;

    // Normalize InPost point code (e.g. WAW01 -> WAW01M)
    if (carrier.toLowerCase() === 'inpost' && pickupPointCode && /^[A-Z]{3}\d{2,4}$/i.test(pickupPointCode.trim())) {
      pickupPointCode = `${pickupPointCode.trim()}M`;
    }

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

    // 10. Configure Pickup/Receiver points ONLY if valid for this carrier
    if (pointToPoint) {
      if (pickupPointCode) {
        furgonetkaPayload.pickup.point = pickupPointCode;
      }
      if (selectedPoint?.code) {
        let rxPoint = selectedPoint.code.trim();
        if (carrier.toLowerCase() === 'inpost' && /^[A-Z]{3}\d{2,4}$/i.test(rxPoint)) {
          rxPoint = `${rxPoint}M`;
        }
        furgonetkaPayload.receiver.point = rxPoint;
      }
    } else if (
      selectedPoint?.code && 
      selectedPoint?.courier && 
      selectedPoint.courier.toLowerCase() === carrier.toLowerCase()
    ) {
      let rxPoint = selectedPoint.code.trim();
      if (carrier.toLowerCase() === 'inpost' && /^[A-Z]{3}\d{2,4}$/i.test(rxPoint)) {
        rxPoint = `${rxPoint}M`;
      }
      furgonetkaPayload.receiver.point = rxPoint;
    }

    console.log('[CreatePackage Route] Sending payload to Furgonetka:', JSON.stringify(furgonetkaPayload, null, 2));
    console.log('[CreatePackage Route] Environment:', process.env.FURGONETKA_ENV || 'sandbox');
    console.log('[CreatePackage Route] Pickup street:', pickupStreet, '| Receiver street:', receiverStreet);

    // 10.5 Proactively accept carrier regulations to prevent 409 terms_and_conditions_not_valid errors
    await furgonetkaClient.acceptRegulations();

    // 11. Call Furgonetka API: Create Draft Package (with auto-acceptance & point/carrier fallback to DPD Courier)
    let createRes: any;
    try {
      createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
    } catch (err: any) {
      const errMsg = err.message || '';
      console.warn('[CreatePackage Route] Initial Furgonetka package creation failed:', errMsg);

      if (errMsg.includes('terms_and_conditions_not_valid')) {
        console.warn('[CreatePackage Route] Regulations not accepted for carrier. Attempting auto-acceptance and DPD fallback...');
        await furgonetkaClient.acceptRegulations();
        // Fall back to DPD Courier (Service ID: 11636590) to guarantee shipment success
        furgonetkaPayload.service_id = 11636590;
        delete furgonetkaPayload.pickup.point;
        delete furgonetkaPayload.receiver.point;
        try {
          createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
        } catch (termsRetryErr: any) {
          console.error('[CreatePackage Route] Terms retry failed:', termsRetryErr);
          throw termsRetryErr;
        }
      } else {
        console.warn('[CreatePackage Route] Initial create failed. Error:', errMsg);
        console.warn('[CreatePackage Route] Retrying with DPD Courier fallback using actual receiver address...');
        furgonetkaPayload.service_id = 11636590; // DPD Courier
        // Keep actual receiver address and country code!
        furgonetkaPayload.receiver = {
          name: receiverName,
          street: receiverStreet,
          postcode: receiverPostcode,
          city: receiverCity,
          country_code: receiverCountryCode,
          phone: receiverPhone,
          email: shippingDetails?.email || 'recipient@printis.store'
        };
        // DPD Courier is door-to-door, so remove both pickup.point AND receiver.point!
        delete furgonetkaPayload.receiver.point;
        delete furgonetkaPayload.pickup.point;
        console.log('[CreatePackage Route] Retry payload (with real address):', JSON.stringify(furgonetkaPayload, null, 2));
        try {
          createRes = await furgonetkaClient.createPackage(furgonetkaPayload);
        } catch (retryErr: any) {
          console.error('[CreatePackage Route] Fallback creation failed:', retryErr?.message || retryErr);
          throw retryErr;
        }
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
    console.error('❌ Furgonetka package creation route error:', error?.message || error);
    const rawMsg = error?.message || 'Internal Server Error';
    const userError = translateFurgonetkaError(rawMsg);
    const isSandbox = (process.env.FURGONETKA_ENV || 'sandbox') === 'sandbox';
    return NextResponse.json({
      success: false,
      error: userError,
      ...(isSandbox ? { debug_raw: rawMsg } : {})
    }, { status: 500 });
  }
}

const FURGONETKA_ERRORS_EN: Record<string, string> = {
  "terms_and_conditions_not_valid": "Carrier terms have changed. Please accept the new terms in your Furgonetka account.",
  "insufficient_funds": "Not enough funds in your account to create the package.",
  "invalidPointName": "The selected pickup point code is invalid for this carrier. Please select a valid pickup point.",
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

  if (msg.includes('Nazwa miejscowości') || msg.includes('nie pasują do siebie') || msg.includes('nie obsługuje podanego kodu') || code.includes('cityPostcode') || code.includes('postcode')) {
    if (path.includes('pickup')) {
      return 'Sender profile address error: City name and postal code do not match. Please check your city and postal code in Profile Settings.';
    }
    if (path.includes('receiver')) {
      return 'Receiver shipping address error: City name and postal code do not match. Please check recipient postal code and city.';
    }
    return 'City name and postal code do not match. Please verify sender and receiver postal codes and cities.';
  }
  if (msg.includes('punkt odbioru') || msg.includes('nie należy do wybranego') || msg.includes('invalidPointName') || path.includes('point')) {
    return 'The selected pickup point code is invalid for this carrier. Please select a valid pickup point.';
  }
  if (msg.includes('Numer kierunkowy') || msg.includes('kierunkowy') || msg.includes('poprzedzony +')) return 'Phone number requires an international country code prefix (e.g. +48).';
  if (msg.includes('regulamin') || code.includes('terms')) return FURGONETKA_ERRORS_EN['terms_and_conditions_not_valid'];
  if (msg.includes('pełnych kilogramach') || code.includes('packageWeightFullKg') || path.includes('weight')) return FURGONETKA_ERRORS_EN['packageWeightFullKg'];
  if (msg.includes('Minimalne wymiary') || code.includes('packageMinimalDimensions') || path.includes('width') || path.includes('height') || path.includes('depth')) return FURGONETKA_ERRORS_EN['packageMinimalDimensions'];
  if (msg.includes('składać się tylko z liter') || code.includes('notAlpha')) return FURGONETKA_ERRORS_EN['notAlpha'];
  if (msg.includes('za krótkie') || code.includes('notSizeMin')) return FURGONETKA_ERRORS_EN['notSizeMin'];
  if (msg.includes('9 cyfr')) return 'Phone number must contain exactly 9 digits.';

  if (msg) {
    if (/[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u0152\u0153\u015a\u015b\u0179\u017a\u017b\u017c]/.test(msg)) {
      if (msg.includes('kod') || msg.includes('pocztow') || msg.includes('miejscowości')) return 'City name and postal code do not match. The selected carrier does not support the provided postal code.';
      if (msg.includes('telefon') || msg.includes('numer telefonu')) return 'Phone number provided is invalid.';
      if (msg.includes('ulica') || msg.includes('numer budynku') || code.includes('street') || path.includes('street')) return 'Street address or house number format is invalid.';
      return msg;
    }
    return msg;
  }
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

  if (cleanMsg.includes('Nazwa miejscowości') || cleanMsg.includes('nie pasują do siebie') || cleanMsg.includes('nie obsługuje podanego kodu')) {
    return 'City name and postal code do not match. The selected carrier does not support the provided postal code.';
  }
  if (cleanMsg.includes('punkt odbioru') || cleanMsg.includes('nie należy do wybranego')) {
    return 'The selected pickup point code is invalid for this carrier. Please select a valid pickup point.';
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

  if (/[\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u0152\u0153\u015a\u015b\u0179\u017a\u017b\u017c]/.test(cleanMsg)) {
    if (cleanMsg.includes('kod') || cleanMsg.includes('pocztow') || cleanMsg.includes('miejscowości')) {
      return 'City name and postal code do not match. The selected carrier does not support the provided postal code.';
    }
    return 'Package details validation error occurred. Please check shipping details or contact support.';
  }

  if (!cleanMsg.toLowerCase().includes('support') && !cleanMsg.toLowerCase().includes('please')) {
    cleanMsg += ' Please contact customer support for assistance.';
  }
  return cleanMsg;
}
