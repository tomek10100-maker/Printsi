import { createClient } from '@supabase/supabase-js';
import { sendDigitalFileEmail } from './sendDigitalFileEmail';
import { sendEmail, EmailTemplates } from './emailService';
import { sendOutOfStockEmail, sendLowFilamentWarning } from './sendNotificationEmail';
import { furgonetkaClient } from './furgonetkaClient';
import { calculateParcel, parseDimensionString } from './shippingRates';
import { parseWeightToGrams } from './dhlRates';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč', SEK: 'kr', NOK: 'kr', DKK: 'kr', CHF: 'Fr',
};

async function convertFromEur(amountEur: number, toCurrency: string): Promise<string> {
  const FALLBACK_RATES: Record<string, number> = {
    PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96,
  };
  try {
    if (toCurrency === 'EUR') return `€${amountEur.toFixed(2)}`;
    let rate = FALLBACK_RATES[toCurrency] || 1;
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
      if (res.ok) {
        const json = await res.json();
        if (json.rates?.[toCurrency]) rate = json.rates[toCurrency];
      }
    } catch { console.warn('⚠️ Exchange API failed, using fallback rate for', toCurrency); }
    const converted = Math.ceil(amountEur * rate * 100) / 100;
    if (toCurrency === 'PLN') return `${converted.toFixed(2)} zł`;
    const symbol = CURRENCY_SYMBOLS[toCurrency] || toCurrency + ' ';
    return `${symbol}${converted.toFixed(2)}`;
  } catch {
    return `€${amountEur.toFixed(2)}`;
  }
}

async function getSellerCurrency(sellerId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('currency').eq('id', sellerId).single();
  return data?.currency || 'EUR';
}

async function decrementFilamentStock(layers: { filament_id?: string; grams?: string | number }[], quantity: number): Promise<string[]> {
  const affectedFilamentIds: string[] = [];
  if (!layers || layers.length === 0) return affectedFilamentIds;
  for (const layer of layers) {
    if (!layer.filament_id || !layer.grams) continue;
    const gramsPerPiece = parseFloat(String(layer.grams));
    if (isNaN(gramsPerPiece) || gramsPerPiece <= 0) continue;
    const totalGrams = gramsPerPiece * quantity;
    const { error } = await supabase.rpc('decrement_filament_stock', {
      filament_id: layer.filament_id,
      grams_used: totalGrams,
    });
    if (error) console.error(`❌ Filament stock error for ${layer.filament_id}:`, error);
    else {
      console.log(`✅ Filament ${layer.filament_id} -${totalGrams}g (qty ${quantity} × ${gramsPerPiece}g)`);
      affectedFilamentIds.push(layer.filament_id);
    }
  }
  return affectedFilamentIds;
}

/**
 * After filament stock is deducted, recalculate the stock of ALL offers
 * by the same seller that use any of the affected filament IDs.
 * This ensures that if two products share the same filament,
 * selling one can make the other go sold out.
 */
async function recalculateOffersStockForFilaments(sellerId: string, affectedFilamentIds: string[]) {
  if (!affectedFilamentIds.length) return;

  // 1. Get ALL filaments for this seller to ensure we have stock info for every required layer
  const { data: allFilaments, error: filErr } = await supabase
    .from('filaments')
    .select('id, stock_grams')
    .eq('user_id', sellerId);

  if (filErr || !allFilaments) {
    console.error('❌ Could not fetch filaments for recalculation:', filErr);
    return;
  }

  const filamentStockMap: Record<string, number> = {};
  allFilaments.forEach(f => { filamentStockMap[f.id] = f.stock_grams ?? 0; });

  // 2. Find all offers by this seller that have color_variants using these filaments
  const { data: offers, error: offErr } = await supabase
    .from('offers')
    .select('id, color_variants, stock')
    .eq('user_id', sellerId)
    .not('color_variants', 'is', null);

  if (offErr || !offers) {
    console.error('❌ Could not fetch offers for recalculation:', offErr);
    return;
  }

  for (const offer of offers) {
    const variants: any[] = offer.color_variants || [];
    let totalOfferNewStock = 0;
    let offerNeedsUpdate = false;

    // We only update the offer IF at least one of its variants uses one of the AFFECTED filaments.
    // (Optimization to avoid updating every single product every time).
    let anyVariantUsesAffected = false;

    const updatedVariants = variants.map(variant => {
      const layers: any[] = variant.layers || [];
      if (layers.length === 0) {
        totalOfferNewStock += (parseInt(variant.stock) || 0);
        return variant;
      }

      let variantUsesAffected = false;
      let variantMaxPieces = Infinity;
      let usesFilamentTracking = false;

      for (const layer of layers) {
        if (!layer.filament_id || !layer.grams) continue;
        const g = parseFloat(String(layer.grams));
        if (isNaN(g) || g <= 0) continue;

        usesFilamentTracking = true;
        if (affectedFilamentIds.includes(layer.filament_id)) {
          variantUsesAffected = true;
          anyVariantUsesAffected = true;
        }

        // IMPORTANT: We check stock for EVERY layer, not just affected ones
        const remaining = filamentStockMap[layer.filament_id] ?? 0;
        variantMaxPieces = Math.min(variantMaxPieces, Math.floor(remaining / g));
      }

      if (variantUsesAffected && variant.stockTracking !== 'manual') {
        const newVarStock = Math.max(0, variantMaxPieces === Infinity ? 0 : variantMaxPieces);
        totalOfferNewStock += newVarStock;
        offerNeedsUpdate = true;
        return { ...variant, stock: newVarStock };
      } else {
        totalOfferNewStock += (parseInt(variant.stock) || 0);
        return variant;
      }
    });

    if (anyVariantUsesAffected && offerNeedsUpdate) {
      const { error: updateErr } = await supabase
        .from('offers')
        .update({ stock: totalOfferNewStock, color_variants: updatedVariants })
        .eq('id', offer.id);

      if (updateErr) console.error(`❌ Stock recalc failed for offer ${offer.id}: ${updateErr.message}`);
      else console.log(`🔄 Offer ${offer.id} stock recalculated → ${totalOfferNewStock}`);
    }
  }
}


async function decrementOfferStock(offerId: string, quantity: number, variantName?: string) {
  try {
    // 1. Decrement top-level stock
    await supabase.rpc('decrement_stock', { row_id: offerId, quantity_amt: quantity });

    // 2. Fetch offer to update color_variants stock
    const { data: offer } = await supabase
      .from('offers')
      .select('id, stock, color_variants')
      .eq('id', offerId)
      .single();

    if (offer && Array.isArray(offer.color_variants) && offer.color_variants.length > 0) {
      let updated = false;

      const updatedVariants = offer.color_variants.map((v: any) => {
        const isMatch = variantName
          ? (v.label === variantName || v.variantId === variantName || v.color_name === variantName)
          : true;

        if (isMatch && !updated) {
          updated = true;
          const currentVarStock = parseInt(String(v.stock ?? 0)) || 0;
          return { ...v, stock: Math.max(0, currentVarStock - quantity) };
        }
        return v;
      });

      if (!updated && offer.color_variants.length > 0) {
        const first = updatedVariants[0];
        const currentVarStock = parseInt(String(first.stock ?? 0)) || 0;
        updatedVariants[0] = { ...first, stock: Math.max(0, currentVarStock - quantity) };
      }

      const newTotalStock = updatedVariants.reduce((sum: number, v: any) => {
        return sum + (parseInt(String(v.stock ?? 0)) || 0);
      }, 0);

      await supabase
        .from('offers')
        .update({
          color_variants: updatedVariants,
          stock: newTotalStock
        })
        .eq('id', offerId);

      console.log(`📉 Offer ${offerId} variant stock decremented by ${quantity} → new stock: ${newTotalStock}`);
    }
  } catch (err) {
    console.error(`❌ Failed to decrement offer stock for ${offerId}:`, err);
  }
}

/**
 * Automatically creates a Furgonetka shipment for a physical order item right after payment.
 * The seller will see the shipment in Furgonetka "Zamówione" (Ordered) tab and just needs to
 * print the label. Non-fatal: any error is logged but does NOT block the order.
 */
async function autoCreateFurgonetkaShipment(
  orderId: string,
  orderItemId: string,
  sellerId: string,
  buyerId: string,
  chatId: string
): Promise<void> {
  try {
    console.log(`[AutoShipment] Creating Furgonetka shipment for order_item=${orderItemId}`);

    // --- Fetch all required data in parallel ---
    const [
      itemRes,
      orderRes,
      senderRes,
      shippingRes,
    ] = await Promise.all([
      supabase
        .from('order_items')
        .select('*, offers(title, dimensions, weight, category)')
        .eq('id', orderItemId)
        .single(),
      supabase.from('orders').select('*').eq('id', orderId).single(),
      supabase
        .from('profiles')
        .select('full_name, address, city, zip_code, country, phone_number, phone')
        .eq('id', sellerId)
        .maybeSingle(),
      supabase
        .from('order_shipping_details')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle(),
    ]);

    if (itemRes.error || !itemRes.data) {
      console.error('[AutoShipment] Could not fetch order item:', itemRes.error);
      return;
    }
    if (orderRes.error || !orderRes.data) {
      console.error('[AutoShipment] Could not fetch order:', orderRes.error);
      return;
    }

    const item = itemRes.data;
    const order = orderRes.data;
    const offer = item.offers as any;

    // Skip digital and job items — no physical shipment needed
    if (offer?.category === 'digital' || offer?.category === 'job') {
      console.log('[AutoShipment] Skipping digital/job item — no physical shipment needed.');
      return;
    }

    // Skip if already shipped
    if (item.status === 'shipped' || item.furgonetka_package_id) {
      console.log('[AutoShipment] Item already shipped, skipping.');
      return;
    }

    // --- Sender (seller) profile ---
    const senderProfile = senderRes.data || {
      full_name: 'Printer', address: 'Borkowska 1', city: 'Warszawa',
      zip_code: '02-222', country: 'PL', phone_number: '500600700', phone: ''
    };

    // --- Receiver details ---
    const orderShippingAddr = order.shipping_address as any;
    const selectedPoint = orderShippingAddr?.selected_point;
    const isPickupPoint = !!selectedPoint?.code;

    let shippingDetails: any = shippingRes.data;
    if (!shippingDetails && orderShippingAddr) {
      const stripeNestedAddr = orderShippingAddr?.address && typeof orderShippingAddr.address === 'object'
        ? orderShippingAddr.address : null;
      shippingDetails = {
        full_name: orderShippingAddr.fullName || orderShippingAddr.name || 'Recipient',
        address: typeof orderShippingAddr.address === 'string'
          ? orderShippingAddr.address : stripeNestedAddr?.line1 || '',
        city: orderShippingAddr.city || stripeNestedAddr?.city || '',
        zip_code: orderShippingAddr.zip || orderShippingAddr.zip_code || stripeNestedAddr?.postal_code || '',
        country: orderShippingAddr.country || stripeNestedAddr?.country || 'PL',
        email: orderShippingAddr.email || '',
        phone: orderShippingAddr.phone || '',
      };
    }
    if (!shippingDetails) {
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('full_name, address, city, zip_code, country, phone, phone_number')
        .eq('id', buyerId).single();
      shippingDetails = {
        full_name: buyerProfile?.full_name || 'Recipient',
        address: buyerProfile?.address || '',
        city: buyerProfile?.city || '',
        zip_code: buyerProfile?.zip_code || '',
        country: buyerProfile?.country || 'PL',
        email: '', phone: buyerProfile?.phone || buyerProfile?.phone_number || '',
      };
    }

    // --- Carrier ---
    let carrier = (
      selectedPoint?.courier || selectedPoint?.service ||
      orderShippingAddr?.carrier || orderShippingAddr?.shippingLabel || 'dpd'
    ).toLowerCase();
    if (carrier.includes('inpost') || carrier.includes('paczkomat')) carrier = 'inpost';
    else if (carrier.includes('orlen')) carrier = 'orlen';
    else if (carrier.includes('dhl')) carrier = 'dhl';
    else if (carrier.includes('ups')) carrier = 'ups';
    else if (carrier.includes('gls')) carrier = 'gls';
    else carrier = 'dpd';

    const SERVICE_MAP: Record<string, number> = {
      dpd: 11636590, ups: 11636592, gls: 11636593, poczta: 11636594,
      inpost: 11636595, orlen: 11636596, dhl: 11636597,
    };
    const serviceId = SERVICE_MAP[carrier] || 11636590;
    const isPointToPoint = ['inpost', 'orlen', 'dhl'].includes(carrier) || !!selectedPoint?.code;

    // --- Parcel size ---
    const rawWeight = parseWeightToGrams(offer?.weight);
    const weightGrams = (typeof rawWeight === 'number' && rawWeight >= 100 ? rawWeight : 500) * (item.quantity || 1);
    const parsedDims = parseDimensionString(offer?.dimensions);
    const parcel = calculateParcel(parsedDims, weightGrams);
    const safeWeightKg = Math.min(31, Math.max(1, Math.ceil(weightGrams / 1000)));
    const safeWidth  = Math.min(60, Math.max(15, Math.round(parcel.widthCm || 15)));
    const safeHeight = Math.min(60, Math.max(11, Math.round(parcel.heightCm || 11)));
    const safeDepth  = Math.min(60, Math.max(5,  Math.round(parcel.lengthCm || 5)));

    // --- Phone / name helpers (same logic as create-package route) ---
    const sanitizePhone = (phone: string, country = 'PL', def = '600700800') => {
      const raw = (phone || '').trim();
      const digits = raw.replace(/\D/g, '');
      const prefixes: Record<string, string> = {
        PL:'+48',FR:'+33',DE:'+49',ES:'+34',IT:'+39',AT:'+43',CZ:'+420',SK:'+421',GB:'+44'
      };
      const prefix = prefixes[country.toUpperCase()] || '+48';
      if (raw.startsWith('+') && digits.length >= 9) return `+${digits}`;
      if (digits.length >= 9) return `${prefix}${digits.slice(-9)}`;
      return `${prefix}${def}`;
    };

    const sanitizeName = (name: string, def = 'Jan Kowalski') => {
      const clean = (name || '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
      const parts = clean.split(' ').filter(p => p.length >= 2);
      if (parts.length === 0) return def;
      if (parts.length === 1) return `${parts[0]} Kowalski`;
      return parts.join(' ');
    };

    const sanitizeStreet = (s: string, def = 'Marszalkowska 1') => {
      let str = (s || '').trim();
      if (!str) return def;
      str = str.replace(/[^\p{L}\d\s/.\-]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (str.length < 2) return def;
      if (!/\d/.test(str)) str = `${str} 1`;
      return str.substring(0, 60);
    };

    const sanitizeCity = (c: string, def = 'Warszawa') => {
      let clean = (c || '').trim()
        .replace(/\s*\(\d+[-\s]?\d*\)/g, '')
        .replace(/\b\d{2}[-\s]?\d{3}\b|\b\d{4,5}\b/g, '')
        .replace(/[^\p{L}\s.\-]/gu, '').replace(/\s+/g, ' ').trim();
      return clean.length >= 2 ? clean.substring(0, 40) : def;
    };

    const fmtZip = (zip: string, cc: string): string => {
      const d = (zip || '').replace(/\D/g, '');
      if (cc === 'PL' && d.length === 5) return `${d.slice(0,2)}-${d.slice(2)}`;
      if (cc === 'AT') return d.length >= 4 ? d.slice(0,4) : (d.padStart(4,'0') || '1010');
      if (['DE','FR','ES','IT','CZ','SK'].includes(cc)) return d.length >= 5 ? d.slice(0,5) : '00000';
      return d || zip || '00000';
    };

    const rcvrCountryCode = (shippingDetails.country || 'PL').toUpperCase().slice(0,2);

    // Pickup (sender) address
    const pickupPayload = {
      name: sanitizeName(senderProfile.full_name),
      street: sanitizeStreet(senderProfile.address),
      postcode: fmtZip(senderProfile.zip_code, 'PL'),
      city: sanitizeCity(senderProfile.city),
      country_code: 'PL',
      phone: sanitizePhone(senderProfile.phone_number || senderProfile.phone, 'PL', '500600700'),
      email: 'seller@printis.store',
    } as any;

    // Receiver address
    let rcvrStreet: string, rcvrCity: string, rcvrPostcode: string;
    if (isPickupPoint && selectedPoint) {
      const pName = (selectedPoint.name || '').replace(/^[A-Z0-9_-]+\s*-\s*/i, '').trim();
      const parts = pName.split(',').map((s: string) => s.trim()).filter(Boolean);
      rcvrStreet   = sanitizeStreet(selectedPoint.street || (parts[0] || ''), 'Main Street 1');
      rcvrCity     = sanitizeCity(selectedPoint.city || shippingDetails.city, 'City');
      const rawZip = selectedPoint.zip || selectedPoint.postcode || shippingDetails.zip_code || '';
      rcvrPostcode = fmtZip(rawZip, rcvrCountryCode);
    } else {
      rcvrStreet   = sanitizeStreet(shippingDetails.address, 'Main Street 1');
      rcvrCity     = sanitizeCity(shippingDetails.city, 'City');
      rcvrPostcode = fmtZip(shippingDetails.zip_code || '', rcvrCountryCode);
    }

    const receiverPayload = {
      name: sanitizeName(shippingDetails.full_name),
      street: rcvrStreet,
      postcode: rcvrPostcode,
      city: rcvrCity,
      country_code: rcvrCountryCode,
      phone: sanitizePhone(shippingDetails.phone, rcvrCountryCode, '600700800'),
      email: shippingDetails.email || 'buyer@printis.store',
    } as any;

    // Point-to-point codes
    const isSandbox = (process.env.FURGONETKA_ENV || 'sandbox') === 'sandbox';
    const pickupPointCode = isSandbox
      ? (process.env.FURGONETKA_SANDBOX_PICKUP_POINT || 'WAW01M')
      : (process.env.FURGONETKA_PICKUP_POINT || '');

    if (isPointToPoint && pickupPointCode) pickupPayload.point = pickupPointCode;
    if (isPointToPoint && selectedPoint?.code) receiverPayload.point = selectedPoint.code;

    const furgoPayload = {
      pickup: pickupPayload,
      receiver: receiverPayload,
      parcels: [{ width: safeWidth, height: safeHeight, depth: safeDepth, weight: safeWeightKg, type: 'package' as const }],
      service_id: serviceId,
    };

    console.log('[AutoShipment] Furgonetka payload:', JSON.stringify(furgoPayload, null, 2));

    // --- Accept regulations, create + order package ---
    await furgonetkaClient.acceptRegulations();

    let packageId: string | number | null = null;
    try {
      const createRes = await furgonetkaClient.createPackage(furgoPayload);
      packageId = createRes?.package_id;
    } catch (createErr: any) {
      console.warn('[AutoShipment] Package creation failed, trying DPD fallback:', createErr?.message);
      try {
        const fallbackPayload = { ...furgoPayload, service_id: 11636590 };
        delete (fallbackPayload.pickup as any).point;
        delete (fallbackPayload.receiver as any).point;
        const fallbackRes = await furgonetkaClient.createPackage(fallbackPayload);
        packageId = fallbackRes?.package_id;
      } catch (fallErr: any) {
        console.error('[AutoShipment] DPD fallback also failed:', fallErr?.message);
        return; // Non-fatal — order is still created, seller ships manually
      }
    }

    if (!packageId) {
      console.error('[AutoShipment] No package_id returned from Furgonetka.');
      return;
    }

    // Order (confirm) the package
    try {
      await furgonetkaClient.orderPackage(packageId);
    } catch (orderErr: any) {
      // Balance issues in sandbox are OK — draft still created
      if (orderErr.message?.includes('saldo') || orderErr.message?.includes('balance')) {
        console.warn('[AutoShipment] Furgonetka balance insufficient (sandbox?) — package created as draft:', packageId);
      } else {
        console.error('[AutoShipment] orderPackage failed:', orderErr?.message);
        return;
      }
    }

    // Get tracking number
    let trackingNumber = String(packageId);
    try {
      const details = await furgonetkaClient.getPackageDetails(packageId);
      trackingNumber = details?.parcels?.[0]?.package_no || details?.pickup_number || String(packageId);
    } catch (_) { /* non-fatal */ }

    // Update order_item in DB
    await supabase
      .from('order_items')
      .update({
        status: 'shipped',
        tracking_code: trackingNumber,
        furgonetka_package_id: String(packageId),
        label_url: `/api/furgonetka/label/${packageId}`,
      })
      .eq('id', orderItemId);

    // Post system message to chat
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: sellerId,
      content: `Shipment automatically booked via Furgonetka (${carrier.toUpperCase()}). Tracking: ${trackingNumber}. Print label at /api/furgonetka/label/${packageId}`,
      message_type: 'status_shipped',
    });

    console.log(`[AutoShipment] ✅ Furgonetka package created: ${packageId}, tracking: ${trackingNumber}`);
  } catch (err: any) {
    // Completely non-fatal — order goes through even if auto-shipment fails
    console.error('[AutoShipment] ❌ Non-fatal auto-shipment error:', err?.message || err);
  }
}

/**
 * Core order processing: creates chats, sends messages, notifications, decrements stock.
 * Called after a confirmed payment (balance or Stripe).
 */
export async function processOrder(orderId: string, userId: string) {
  console.log(`🔄 processOrder: orderId=${orderId}, userId=${userId}`);

  // 1. Fetch all order items (including variant_layers - the specific filament composition of what was bought)
  const { data: orderItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, offer_id, seller_id, quantity, price_at_purchase, variant_layers, variant_name')
    .eq('order_id', orderId);


  if (itemsErr || !orderItems?.length) {
    console.error('❌ Could not fetch order items:', itemsErr);
    return { success: false, error: 'Order items not found' };
  }

  console.log(`📦 Found ${orderItems.length} order item(s)`);

  // 2. Fetch offer details
  const offerIds = orderItems.map(i => i.offer_id);
  const { data: initialOffers } = await supabase
    .from('offers')
    .select('id, title, is_custom, parent_offer_id, color_variants, category, file_url')
    .in('id', offerIds);

  const offerMap: Record<string, any> = {};
  (initialOffers || []).forEach(o => { offerMap[o.id] = o; });

  // Fetch parent offers for custom items to ensure we have filament data for deduction
  const neededParentIds = (initialOffers || [])
    .filter(o => o.is_custom && o.parent_offer_id && !offerMap[o.parent_offer_id])
    .map(o => o.parent_offer_id);

  if (neededParentIds.length > 0) {
    const { data: parents } = await supabase
      .from('offers')
      .select('id, color_variants, file_url, category')
      .in('id', neededParentIds);
    (parents || []).forEach(p => { offerMap[p.id] = p; });
  }


  // Fetch buyer info
  const { data: buyerShipping } = await supabase
    .from('order_shipping_details')
    .select('email, full_name')
    .eq('order_id', orderId)
    .maybeSingle();

  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  // Get buyer email safely - non-fatal if it fails
  let buyerEmail = buyerShipping?.email || '';
  const buyerName = buyerShipping?.full_name || buyerProfile?.full_name || 'Customer';
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(userId);
    if (authData?.user?.email && !buyerEmail) buyerEmail = authData.user.email;
  } catch (authErr) {
    console.warn('⚠️ Could not get buyer auth email (non-fatal):', authErr);
  }

  const results: string[] = [];

  for (const item of orderItems) {
    const offer = offerMap[item.offer_id] || {};
    const isCustom = offer.is_custom;
    const parentOfferId = offer.parent_offer_id;
    const title = offer.title || 'your item';
    const chatOfferId = (isCustom && parentOfferId) ? parentOfferId : item.offer_id;
    const sellerId = item.seller_id;

    if (!sellerId) { console.warn('⚠️ No sellerId for item', item.offer_id); continue; }

    // 3. Create / find chat thread
    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('buyer_id', userId)
      .eq('seller_id', sellerId)
      .eq('offer_id', chatOfferId)
      .is('order_id', null)
      .maybeSingle();

    let chatId = existingChat?.id;

    if (!chatId) {
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({ buyer_id: userId, seller_id: sellerId, offer_id: chatOfferId, order_id: orderId })
        .select('id')
        .single();

      if (chatErr) {
        console.error('❌ Failed to create chat:', chatErr);
        results.push(`chat_fail:${item.offer_id}`);
        continue;
      }
      chatId = newChat.id;
      console.log(`💬 Chat created: ${chatId}`);
      results.push(`chat_created:${chatId}`);
    } else {
      await supabase.from('chats').update({ order_id: orderId }).eq('id', chatId);
      results.push(`chat_updated:${chatId}`);
    }

    // Mark any pending proposal in this chat as accepted upon successful payment confirmation
    const { data: propMsgs } = await supabase
      .from('messages')
      .select('id, content')
      .eq('chat_id', chatId)
      .like('content', '[PROPOSAL]%');

    if (propMsgs) {
      for (const pMsg of propMsgs) {
        try {
          const pData = JSON.parse(pMsg.content.substring(10));
          if (pData.status !== 'accepted') {
            pData.status = 'accepted';
            await supabase
              .from('messages')
              .update({ content: `[PROPOSAL]${JSON.stringify(pData)}` })
              .eq('id', pMsg.id);
            console.log(`✅ Proposal message ${pMsg.id} updated to accepted upon payment confirmation.`);
          }
        } catch (e) {
          console.error('Failed to update proposal message status on payment:', e);
        }
      }
    }

    // 4. System message: order confirmed
    const msgOrder = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content: offer.category === 'job'
        ? `🖨️ Print job confirmed! Payment for ${item.quantity}x "${title}" has been received. The 3D file will be sent to the printer's email shortly.`
        : `New order: ${item.quantity}x "${title}" has been purchased successfully.`,
      message_type: 'system',
    });
    if (msgOrder.error) console.error('❌ Order message failed:', msgOrder.error);

    // Set to 'shipped' for digital (allows buyer to confirm/dispute), else remind about 4 days limit
    if (offer.category === 'digital') {
      await supabase.from('order_items').update({ status: 'shipped' }).eq('id', item.id);
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: `Digital file delivered automatically to your email. Please check it and confirm everything is correct!`,
        message_type: 'status_shipped',
      });
    } else if (offer.category === 'job') {
      // ── PRINT ON DEMAND FLOW ──
      // 1. Send the 3D file to the PRINTER (seller in order_items)
      const parentOffer = offer.parent_offer_id ? offerMap[offer.parent_offer_id] : null;
      const fileUrl = parentOffer?.file_url || offer.file_url;

      if (fileUrl) {
        try {
          // Get the printer's (seller's) email
          const { data: printerAuth } = await supabase.auth.admin.getUserById(sellerId);
          const printerEmail = printerAuth?.user?.email;
          const { data: printerProfile } = await supabase.from('profiles').select('full_name').eq('id', sellerId).single();
          const printerName = printerProfile?.full_name || 'Printer';

          if (printerEmail) {
            await sendDigitalFileEmail({
              buyerEmail: printerEmail,
              buyerName: printerName,
              productTitle: `Print Job: ${title}`,
              fileUrl,
              orderId,
            });
            console.log(`✅ 3D file sent to printer ${printerEmail} for job: ${title}`);
          }
        } catch (emailErr) {
          console.error(`❌ Could not send 3D file to printer:`, emailErr);
        }
      }

      // 2. Mark the original job listing as fulfilled (stock → 0)
      const jobListingId = offer.parent_offer_id || item.offer_id;
      await supabase.from('offers').update({ stock: 0 }).eq('id', jobListingId);
      console.log(`📦 Job listing ${jobListingId} marked as fulfilled (stock → 0)`);

      // 3. System messages explaining next steps
      // Set 3-day shipping deadline for print jobs
      const shipByDeadlineJob = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await supabase.from('order_items').update({ ship_by_deadline: shipByDeadlineJob.toISOString() }).eq('id', item.id);
      const deadlineLabelJob = shipByDeadlineJob.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({ type: 'order_confirmed', ship_by_deadline: shipByDeadlineJob.toISOString(), deadline_label: deadlineLabelJob }),
        message_type: 'status_order_confirmed',
      });
    } else {
      // Set 3-day shipping deadline for physical items
      const shipByDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await supabase.from('order_items').update({ ship_by_deadline: shipByDeadline.toISOString() }).eq('id', item.id);
      const deadlineStr = shipByDeadline.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userId,
        content: JSON.stringify({ type: 'order_confirmed', ship_by_deadline: shipByDeadline.toISOString(), deadline_label: deadlineStr }),
        message_type: 'status_order_confirmed',
      });

      // Auto-create Furgonetka shipment so it appears in "Zamówione" tab immediately after payment.
      // Runs asynchronously — errors are non-fatal and do not block the order.
      autoCreateFurgonetkaShipment(orderId, item.id, sellerId, userId, chatId).catch(e =>
        console.error('[processOrder] autoCreateFurgonetkaShipment background error:', e)
      );
    }

    // 5. Notify seller
    try {
      const sellerCurrency = await getSellerCurrency(sellerId);
      const earnedEur = item.price_at_purchase * item.quantity;
      const formattedAmount = await convertFromEur(earnedEur, sellerCurrency);
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: sellerId,
        title: '🎉 New sale!',
        message: offer.category === 'digital' 
          ? `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds will be added to your balance once the buyer confirms delivery.`
          : `You sold ${item.quantity}x "${title}" for ${formattedAmount}. Funds added to Pending Balance.`,
        type: 'sale',
        is_read: false,
      });
      if (notifErr) console.error('❌ Seller notification failed:', notifErr);
    } catch (notifErr) {
      console.error('❌ Seller notification threw:', notifErr);
    }

    // 6. Decrement offer stock (Physical items only)
    if (offer.category !== 'digital') {
      await decrementOfferStock(item.offer_id, item.quantity, item.variant_name);
      if (isCustom && parentOfferId) {
        await decrementOfferStock(parentOfferId, item.quantity, item.variant_name);
      }
    }

    // Check if offer is now out of stock and notify seller
    try {
      const { data: updatedOffer } = await supabase
        .from('offers')
        .select('stock, title')
        .eq('id', item.offer_id)
        .single();

      if (updatedOffer && updatedOffer.stock <= 0 && !offer.is_custom) {
        await sendOutOfStockEmail(sellerId, updatedOffer.title || title);
      }
    } catch (stockCheckErr) {
      console.error('⚠️ Stock check email failed (non-fatal):', stockCheckErr);
    }

    // 7. Decrement filament stock using the EXACT layers of the purchased variant
    // variant_layers is stored in order_items at checkout time (specific to which color was bought)
    let layersToUse: { filament_id: string; grams: string | number }[] = item.variant_layers || [];

    // Fallback: if no variant_layers saved (older order or custom offer), try offer's color_variants
    if (layersToUse.length === 0) {
      layersToUse = (offer.color_variants && offer.color_variants[0]?.layers) || [];
    }

    // Last fallback: try parent offer layers (for custom/negotiated offers)
    if (layersToUse.length === 0 && offer.is_custom && offer.parent_offer_id) {
      const parentOffer = offerMap[offer.parent_offer_id];
      if (parentOffer?.color_variants && parentOffer.color_variants[0]?.layers) {
        layersToUse = parentOffer.color_variants[0].layers;
      }
    }

    if (layersToUse.length > 0) {
      console.log(`🎨 Deducting filament for variant: ${item.variant_name || 'default'}, layers: ${layersToUse.length}`);
      const affectedFilamentIds = await decrementFilamentStock(layersToUse, item.quantity);
      // Recalculate stock for ALL offers by this seller using same filaments → updates marketplace instantly
      if (affectedFilamentIds.length > 0) {
        await recalculateOffersStockForFilaments(sellerId, affectedFilamentIds);

        // Check if any affected filament dropped to 75g or below → send low filament warning
        try {
          const { data: lowFilaments } = await supabase
            .from('filaments')
            .select('id, color_name, color_hex, stock_grams, color')
            .in('id', affectedFilamentIds)
            .lte('stock_grams', 100);

          if (lowFilaments && lowFilaments.length > 0) {
            for (const fil of lowFilaments) {
              const displayName = fil.color_name || fil.color || 'Unknown Filament';
              await sendLowFilamentWarning(sellerId, displayName, fil.stock_grams ?? 0);
            }
          }
        } catch (lowFilErr) {
          console.error('⚠️ Low filament check failed (non-fatal):', lowFilErr);
        }
      }
    } else {
      console.warn(`⚠️ No filament layers found for offer ${item.offer_id} (variant: ${item.variant_name || 'none'}) - skipping filament deduction`);
    }

  }

  // 8. Send digital file emails
  const digitalItems = orderItems.filter(item => {
    const offer = offerMap[item.offer_id];
    return offer?.category === 'digital' && offer?.file_url;
  });

  if (digitalItems.length > 0 && buyerEmail) {
    for (const item of digitalItems) {
      const offer = offerMap[item.offer_id];
      try {
        await sendDigitalFileEmail({
          buyerEmail,
          buyerName,
          productTitle: offer.title || 'Your 3D File',
          fileUrl: offer.file_url,
          orderId,
        });
      } catch (emailErr) {
        console.error(`❌ Could not send file email for offer ${item.offer_id}:`, emailErr);
      }
    }
  }

  console.log('✅ processOrder database work complete, now sending summary emails...');

  // 9. Send Order Confirmation Email to Buyer (Single comprehensive email)
  if (buyerEmail) {
    try {
      // Calculate total price for the email (assuming EUR for now or base price)
      const totalEur = orderItems.reduce((acc, item) => acc + (item.price_at_purchase * item.quantity), 0);
      const buyerItems = orderItems.map(item => {
        const off = offerMap[item.offer_id] || {};
        return {
          title: off.title || 'Product',
          quantity: item.quantity,
          price: item.price_at_purchase
        };
      });

      await sendEmail({
        to: buyerEmail,
        subject: `🛍️ Order Confirmed - Printis #${orderId.slice(0, 8)}`,
        html: EmailTemplates.orderConfirmation(
          buyerName,
          orderId,
          buyerItems,
          `€${totalEur.toFixed(2)}`
        )
      });
    } catch (err) {
      console.error('❌ Failed to send buyer order confirmation email:', err);
    }
  }

  // 10. Send Sale Notification Emails to Sellers
  // De-duplicate: custom offers + their parent might both be in order, send only once per seller
  const uniqueSellerIds = Array.from(new Set(orderItems.map(i => i.seller_id)));
  // Track which offer IDs have already sent a sale email (to avoid double for custom+parent)
  const emailedOfferIds = new Set<string>();

  for (const sId of uniqueSellerIds) {
    if (!sId) continue;
    try {
      const { data: sellerProf } = await supabase.from('profiles').select('full_name, email_notifs').eq('id', sId).single();
      
      // If sellers don't have emails in profiles, we fetch from auth.admin
      const { data: authUser } = await supabase.auth.admin.getUserById(sId);
      const sellerEmail = authUser?.user?.email;

      if (sellerEmail) {
        const sellerItems = orderItems.filter(i => i.seller_id === sId);
        const sellerName = sellerProf?.full_name || 'Seller';
        
        for (const item of sellerItems) {
          const off = offerMap[item.offer_id] || {};

          // Skip if this is a custom offer and the parent was already emailed
          // (prevents seller from getting 2 "you made a sale" emails for 1 transaction)
          const emailKey = off.is_custom && off.parent_offer_id
            ? `${sId}:${off.parent_offer_id}`
            : `${sId}:${item.offer_id}`;
          if (emailedOfferIds.has(emailKey)) {
            console.log(`⏭️ Skipping duplicate sale email for ${emailKey}`);
            continue;
          }
          emailedOfferIds.add(emailKey);

          const sellerCurrency = await getSellerCurrency(sId);
          const earnedEur = item.price_at_purchase * item.quantity;
          const formattedAmount = await convertFromEur(earnedEur, sellerCurrency);

          // Use parent offer title when it's a custom/negotiated offer
          const displayTitle = (off.is_custom && off.parent_offer_id && offerMap[off.parent_offer_id]?.title)
            ? offerMap[off.parent_offer_id].title
            : (off.title || 'Your Product');

          await sendEmail({
            to: sellerEmail,
            subject: `🎉 New Sale on Printis: ${displayTitle}`,
            html: EmailTemplates.saleNotification(
              sellerName,
              buyerName,
              displayTitle,
              formattedAmount
            )
          });
        }
      }
    } catch (err) {
      console.error(`❌ Failed to send seller notification for ${sId}:`, err);
    }
  }

  console.log('✅ processOrder complete, results:', results);
  return { success: true, results };
}
