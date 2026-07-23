import { NextResponse } from 'next/server';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';

// Maps Furgonetka service names → ShippingOption IDs used in checkout
const SERVICE_MAP: Record<string, { id: string; carrier: string; service: string; icon: string; deliveryDays: string; description: string; isPickup: boolean }> = {
  dhl:      { id: 'dhl_domestic',       carrier: 'DHL',    service: 'DHL Parcel',         icon: '🟡', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  dhl_pop:  { id: 'dhl_pop',            carrier: 'DHL',    service: 'DHL POP / Box',       icon: '🟡', deliveryDays: '1-2', description: 'Parcel locker / Pickup point', isPickup: true },
  dpd:      { id: 'dpd_domestic',       carrier: 'DPD',    service: 'DPD Classic',         icon: '🔴', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  dpd_pickup: { id: 'dpd_pickup',       carrier: 'DPD',    service: 'DPD Pickup Station',  icon: '🔴', deliveryDays: '1-2', description: 'Parcel locker / Pickup point', isPickup: true },
  inpost:   { id: 'inpost_paczkomat',   carrier: 'InPost', service: 'Paczkomat',           icon: '🟢', deliveryDays: '1-2', description: 'Parcel locker pickup', isPickup: true },
  orlen:    { id: 'orlen_paczka',       carrier: 'Orlen',  service: 'Orlen Paczka',        icon: '🟠', deliveryDays: '1-3', description: 'Parcel locker / Pickup point', isPickup: true },
  ups:      { id: 'ups_domestic',       carrier: 'UPS',    service: 'UPS Standard',        icon: '🟤', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  gls:      { id: 'gls_domestic',       carrier: 'GLS',    service: 'GLS ParcelShop',      icon: '🔵', deliveryDays: '1-2', description: 'Door-to-door delivery', isPickup: false },
  fedex:    { id: 'fedex_domestic',     carrier: 'FedEx',  service: 'FedEx Economy',       icon: '🟣', deliveryDays: '1-3', description: 'Door-to-door delivery', isPickup: false },
  poczta:   { id: 'poczta_polska',      carrier: 'Poczta', service: 'Poczta Polska',       icon: '⚪', deliveryDays: '2-4', description: 'Door-to-door delivery', isPickup: false },
};

export async function POST(req: Request) {
  try {
    const { widthCm, heightCm, lengthCm, weightGrams, fromCountry, toCountry, fromZip, toZip, plnToEurRate } = await req.json();

    if (!widthCm || !heightCm || !lengthCm || !weightGrams) {
      return NextResponse.json({ success: false, error: 'Missing parcel dimensions' }, { status: 400 });
    }

    const payload = {
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
        postcode: toZip || '02-222',
        city: 'Warszawa',
        country_code: toCountry || 'PL',
        phone: '600700800',
        email: 'recipient@printis.store',
      },
      parcels: [
        {
          width: Math.round(widthCm),
          height: Math.round(heightCm),
          depth: Math.round(lengthCm),
          weight: Math.max(0.1, weightGrams / 1000),
          type: 'package',
        },
      ],
    };

    const result = await furgonetkaClient.calculateShipping(payload);

    // Furgonetka returns either `services_prices` or `offers` depending on API version
    const services: any[] = result?.services_prices || result?.offers || [];

    // Use live rate from client, fall back to a reasonable default
    const plnToEur: number = (typeof plnToEurRate === 'number' && plnToEurRate > 0) ? plnToEurRate : 4.25;

    const options = services
      .filter((s: any) => s.available && (!s.errors || s.errors.length === 0))
      .map((s: any) => {
        const meta = SERVICE_MAP[s.service] || {
          id: `${s.service}_generic`,
          carrier: s.service?.toUpperCase() || 'Unknown',
          service: s.service || 'Unknown',
          icon: '📦',
          deliveryDays: '1-5',
          description: 'Delivery',
          isPickup: false,
        };

        // Prioritize account_price_gross (the actual price charged to the account with discounts / sandbox rates)
        const pricePln: number = 
          s.pricing?.account_price_gross ?? 
          s.pricing?.price_gross_account ?? 
          s.pricing?.account_price ?? 
          s.pricing?.price_account ?? 
          s.pricing?.price_gross ?? 
          s.pricing?.price ?? 
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

    return NextResponse.json({ success: true, options });
  } catch (err: any) {
    console.error('[Furgonetka Calculate] Error:', err?.message || err);
    // Return empty options so checkout falls back to static prices gracefully
    return NextResponse.json({ success: false, error: err?.message || 'Failed to calculate shipping', options: [] }, { status: 500 });
  }
}
