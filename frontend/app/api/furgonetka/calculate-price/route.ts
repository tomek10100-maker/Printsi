import { NextResponse } from 'next/server';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';
import { parseDimensionString, calculateParcel } from '@/app/lib/shippingRates';
import { parseWeightToGrams } from '@/app/lib/dhlRates';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { carrier, countryCode, postcode, city, street, weightGrams, dimensions, serviceId } = body;

    const targetCountry = (countryCode || 'PL').toUpperCase();
    const rawPostcode = (postcode || '').trim();

    // Calculate weight & dimensions
    const rawWeight = typeof weightGrams === 'number' ? weightGrams : parseWeightToGrams(weightGrams);
    const validWeightGrams = rawWeight >= 100 ? rawWeight : 500;
    const parsedDims = parseDimensionString(dimensions);
    const parcel = calculateParcel(parsedDims, validWeightGrams);

    const safeWeightKg = Math.min(31, Math.max(1, Math.ceil(validWeightGrams / 1000)));
    const safeWidth = Math.min(60, Math.max(15, Math.round(parcel.widthCm || 15)));
    const safeHeight = Math.min(60, Math.max(11, Math.round(parcel.heightCm || 11)));
    const safeDepth = Math.min(60, Math.max(5, Math.round(parcel.lengthCm || 5)));

    // Format postcode according to country rules
    const digitsOnly = rawPostcode.replace(/\D/g, '');
    let formattedPostcode = rawPostcode;

    if (targetCountry === 'PL') {
      formattedPostcode = digitsOnly.length === 5 ? `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2)}` : '02-222';
    } else if (targetCountry === 'FR' || targetCountry === 'IT' || targetCountry === 'DE' || targetCountry === 'ES') {
      formattedPostcode = digitsOnly.length >= 5 ? digitsOnly.slice(0, 5) : (digitsOnly.padStart(5, '0') || '75001');
    } else if (targetCountry === 'AT') {
      formattedPostcode = digitsOnly.length >= 4 ? digitsOnly.slice(0, 4) : (digitsOnly.padStart(4, '0') || '1010');
    } else if (targetCountry === 'CZ' || targetCountry === 'SK') {
      formattedPostcode = digitsOnly.length >= 5 ? digitsOnly.slice(0, 5) : (digitsOnly.padStart(5, '0') || '11000');
    }

    const payload = {
      pickup: {
        name: 'Jan Kowalski',
        street: 'Borkowska 1',
        postcode: '02-222',
        city: 'Warszawa',
        country_code: 'PL',
        phone: '+48500600700',
        email: 'sender@printis.store'
      },
      receiver: {
        name: 'Recipient',
        street: street && street.length >= 3 ? street : 'Main Street 1',
        postcode: formattedPostcode,
        city: city && city.length >= 2 ? city : 'City',
        country_code: targetCountry,
        phone: '+48600700800',
        email: 'recipient@printis.store'
      },
      parcels: [
        {
          width: safeWidth,
          height: safeHeight,
          depth: safeDepth,
          weight: safeWeightKg,
          type: 'package'
        }
      ]
    };

    console.log('[CalculatePrice Route] Requesting live calculation from Furgonetka:', JSON.stringify(payload, null, 2));
    const quoteRes = await furgonetkaClient.calculateShipping(payload);

    console.log('[CalculatePrice Route] Furgonetka response:', JSON.stringify(quoteRes, null, 2));

    if (!quoteRes) {
      return NextResponse.json({ success: false, error: 'No response from Furgonetka quote API' }, { status: 400 });
    }

    // Process pricing quotes
    let services: any[] = [];
    if (Array.isArray(quoteRes)) {
      services = quoteRes;
    } else if (Array.isArray(quoteRes?.services)) {
      services = quoteRes.services;
    } else if (Array.isArray(quoteRes?.data)) {
      services = quoteRes.data;
    } else if (quoteRes?.service_id || quoteRes?.price) {
      services = [quoteRes];
    }

    // Match carrier name (e.g. 'dpd', 'inpost', 'dhl', 'orlen') or service_id
    const targetCarrierLower = (carrier || '').toLowerCase();
    const matchedService = services.find((s: any) => {
      const sName = (s.service_name || s.courier || s.name || s.service || '').toLowerCase();
      if (serviceId && Number(s.service_id) === Number(serviceId)) return true;
      if (targetCarrierLower && sName.includes(targetCarrierLower)) return true;
      return false;
    }) || services[0];

    if (!matchedService) {
      return NextResponse.json({
        success: false,
        error: `No live shipping quote found for carrier: ${carrier}`,
        rawRes: quoteRes
      }, { status: 404 });
    }

    // Extract gross price
    const grossPrice = Number(
      matchedService.price?.gross ||
      matchedService.gross_price ||
      matchedService.price_gross ||
      matchedService.gross ||
      matchedService.price ||
      0
    );

    const netPrice = Number(matchedService.price?.net || matchedService.net_price || grossPrice);

    return NextResponse.json({
      success: true,
      carrier: targetCarrierLower || matchedService.courier || 'carrier',
      serviceId: matchedService.service_id,
      grossPrice: grossPrice > 0 ? grossPrice : null,
      netPrice: netPrice > 0 ? netPrice : null,
      currency: 'PLN',
      allServices: services.map((s: any) => ({
        service_id: s.service_id,
        courier: s.courier || s.service_name || s.name,
        grossPrice: Number(s.price?.gross || s.gross_price || s.price || 0)
      }))
    });

  } catch (err: any) {
    console.error('❌ [CalculatePrice Route] Error:', err?.message || err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to calculate shipping price'
    }, { status: 500 });
  }
}
