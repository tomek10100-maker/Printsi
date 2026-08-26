import { NextResponse } from 'next/server';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';
import { filterOptionsByDisabledCouriers } from '@/app/lib/shippingRates';

// Maps Furgonetka service names → ShippingOption IDs used in checkout
const SERVICE_MAP: Record<string, { id: string; carrier: string; service: string; icon: string; deliveryDays: string; description: string; isPickup: boolean }> = {
  dhl:                { id: 'dhl_domestic',       carrier: 'Furgonetka.pl', service: 'Furgonetka Courier', icon: '📦', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  dhl_pop:            { id: 'dhl_pop',            carrier: 'Furgonetka.pl', service: 'Furgonetka Point / Box', icon: '📦', deliveryDays: '1-2', description: 'Parcel locker / Pickup point', isPickup: true },
  dpd:                { id: 'dpd_domestic',       carrier: 'DPD',    service: 'DPD Classic',         icon: '🔴', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  dpd_pickup:         { id: 'dpd_pickup',         carrier: 'DPD',    service: 'DPD Pickup Station',  icon: '🔴', deliveryDays: '1-2', description: 'Parcel locker / Pickup point', isPickup: true },
  dpd_international:  { id: 'dpd_international',  carrier: 'DPD',    service: 'DPD International',   icon: '🔴', deliveryDays: '3-5', description: 'Door-to-door delivery', isPickup: false },
  inpost:             { id: 'inpost_paczkomat',   carrier: 'InPost', service: 'Paczkomat',           icon: '🟢', deliveryDays: '1-2', description: 'Parcel locker pickup', isPickup: true },
  orlen:              { id: 'orlen_paczka',       carrier: 'Orlen',  service: 'Orlen Paczka',        icon: '🟠', deliveryDays: '1-3', description: 'Parcel locker / Pickup point', isPickup: true },
  ups:                { id: 'ups_domestic',       carrier: 'UPS',    service: 'UPS Standard',        icon: '🟤', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  gls:                { id: 'gls_domestic',       carrier: 'GLS',    service: 'GLS ParcelShop',      icon: '🔵', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  fedex:              { id: 'fedex_domestic',     carrier: 'FedEx',  service: 'FedEx Economy',       icon: '🟣', deliveryDays: '1-3', description: 'Door-to-door delivery', isPickup: false },
  poczta:             { id: 'poczta_polska',      carrier: 'Poczta', service: 'Poczta Polska',       icon: '⚪', deliveryDays: '2-4', description: 'Door-to-door delivery', isPickup: false },
};

export async function POST(req: Request) {
  try {
    const {
      widthCm, heightCm, lengthCm, weightGrams,
      fromCountry, toCountry, fromZip, toZip, toCity,
      selectedPointCode, plnToEurRate, disabledCouriers
    } = await req.json();

    if (!widthCm || !heightCm || !lengthCm || !weightGrams) {
      return NextResponse.json({ success: false, error: 'Missing parcel dimensions' }, { status: 400 });
    }

    const targetCountry = (toCountry || 'PL').toUpperCase();
    const rawPostcode = (toZip || '').trim();

    // Format postcode according to country rules
    const digitsOnly = rawPostcode.replace(/\D/g, '');
    let formattedPostcode = rawPostcode;

    if (targetCountry === 'PL') {
      formattedPostcode = digitsOnly.length === 5 ? `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}` : '02-222';
    } else if (['FR', 'IT', 'DE', 'ES'].includes(targetCountry)) {
      formattedPostcode = digitsOnly.length >= 5 ? digitsOnly.slice(0, 5) : (digitsOnly.padStart(5, '0') || '75001');
    } else if (targetCountry === 'AT') {
      formattedPostcode = digitsOnly.length >= 4 ? digitsOnly.slice(0, 4) : (digitsOnly.padStart(4, '0') || '1010');
    } else if (targetCountry === 'CZ' || targetCountry === 'SK') {
      formattedPostcode = digitsOnly.length >= 5 ? digitsOnly.slice(0, 5) : (digitsOnly.padStart(5, '0') || '11000');
    }

    const safeWeightKg = Math.min(31, Math.max(1, Math.ceil(weightGrams / 1000)));
    const safeWidth = Math.min(60, Math.max(15, Math.round(widthCm || 15)));
    const safeHeight = Math.min(60, Math.max(11, Math.round(heightCm || 11)));
    const safeDepth = Math.min(60, Math.max(5, Math.round(lengthCm || 5)));

    const payload: any = {
      pickup: {
        name: 'Sender',
        street: 'Borkowska 1',
        postcode: fromZip || '02-222',
        city: 'Warszawa',
        country_code: fromCountry || 'PL',
        phone: '500600700',
        email: 'sender@printis.store',
      },
      receiver: {
        name: 'Recipient',
        street: 'Przykładowa 1',
        postcode: formattedPostcode,
        city: toCity && toCity.length >= 2 ? toCity : 'City',
        country_code: targetCountry,
        phone: '600700800',
        email: 'recipient@printis.store',
      },
      parcels: [
        {
          width: safeWidth,
          height: safeHeight,
          depth: safeDepth,
          weight: safeWeightKg,
          type: 'package',
        },
      ],
    };

    if (selectedPointCode) {
      payload.receiver.point = selectedPointCode;
    }

    console.log('[Furgonetka Calculate Route] Live quote request:', JSON.stringify(payload, null, 2));
    const result = await furgonetkaClient.calculateShipping(payload);

    let services: any[] = [];
    if (Array.isArray(result)) {
      services = result;
    } else if (Array.isArray(result?.services_prices)) {
      services = result.services_prices;
    } else if (Array.isArray(result?.offers)) {
      services = result.offers;
    } else if (Array.isArray(result?.services)) {
      services = result.services;
    }

    const plnToEur: number = (typeof plnToEurRate === 'number' && plnToEurRate > 0) ? plnToEurRate : 4.25;

    const options = services
      .filter((s: any) => (s.available !== false) && (!s.errors || s.errors.length === 0))
      .map((s: any) => {
        const sKey = (s.service || s.courier || s.service_name || '').toLowerCase();
        const meta = SERVICE_MAP[sKey] || {
          id: `${sKey}_quote`,
          carrier: sKey.toUpperCase() || 'Courier',
          service: s.service || 'Courier Delivery',
          icon: '📦',
          deliveryDays: '1-5',
          description: 'Delivery',
          isPickup: false,
        };

        const pricePln: number = 
          s.pricing?.account_price_gross ?? 
          s.pricing?.price_gross_account ?? 
          s.pricing?.account_price ?? 
          s.pricing?.price_account ?? 
          s.pricing?.price_gross ?? 
          s.pricing?.price ?? 
          s.price?.gross ??
          s.price_gross ??
          s.price ?? 0;

        return {
          ...meta,
          pricePln: Math.round(pricePln * 100) / 100,
          priceEur: Math.round((pricePln / plnToEur) * 100) / 100,
          serviceId: s.service_id ?? null,
        };
      })
      .filter((o: any) => o.pricePln > 0)
      .sort((a: any, b: any) => a.pricePln - b.pricePln);

    let finalOptions: any[] = options;
    if (Array.isArray(disabledCouriers) && disabledCouriers.length > 0) {
      finalOptions = filterOptionsByDisabledCouriers(options as any, disabledCouriers) as any[];
    }

    return NextResponse.json({ success: true, options: finalOptions });
  } catch (err: any) {
    console.error('[Furgonetka Calculate] Error:', err?.message || err);
    return NextResponse.json({ success: false, error: null, options: [] }, { status: 200 });
  }
}
