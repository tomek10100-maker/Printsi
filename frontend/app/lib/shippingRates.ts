// ============================================================
// Printis Shipping Calculator — Vinted Carrier Matrix
// Calculates parcel size from print dimensions + 5cm buffer
// Returns multiple carrier options with prices based on
// destination country carrier availability
// ============================================================

export interface ShippingOption {
  id: string;
  carrier: string;
  service: string;
  icon: string;
  pricePln: number;
  priceEur: number;
  deliveryDays: string;
  description: string;
}

export interface ParcelDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightGrams: number;
}

/**
 * Parse dimension string from DB (e.g. "Width: 120 mm, Height: 80 mm, Depth: 50 mm")
 * Returns [width, height, depth] in mm
 */
export function parseDimensionString(dimStr: string | null | undefined): [number, number, number] | null {
  if (!dimStr) return null;
  const nums: number[] = [];
  const matches = dimStr.matchAll(/[\d.]+(?:\s*mm)?/g);
  for (const m of matches) {
    const n = parseFloat(m[0]);
    if (!isNaN(n)) nums.push(n);
  }
  if (nums.length < 3) return null;
  // sort descending so we always get [longest, medium, shortest]
  nums.sort((a, b) => b - a);
  return [nums[0], nums[1], nums[2]];
}

/**
 * Add 5cm buffer to each dimension (convert mm→cm, add 5, return in cm)
 * and take the weight (default 500g if missing)
 */
export function calculateParcel(
  dimsMm: [number, number, number] | null,
  weightGrams: number
): ParcelDimensions {
  const BUFFER_CM = 5;
  if (!dimsMm) {
    // Default small parcel if no dims available
    return { lengthCm: 20, widthCm: 15, heightCm: 10, weightGrams };
  }
  return {
    lengthCm: Math.ceil(dimsMm[0] / 10) + BUFFER_CM,
    widthCm: Math.ceil(dimsMm[1] / 10) + BUFFER_CM,
    heightCm: Math.ceil(dimsMm[2] / 10) + BUFFER_CM,
    weightGrams,
  };
}

/**
 * Get volumetric weight (DHL uses: L×W×H / 5000 in kg)
 */
function getChargeableWeightGrams(parcel: ParcelDimensions): number {
  const volumetricKg = (parcel.lengthCm * parcel.widthCm * parcel.heightCm) / 5000;
  const actualKg = parcel.weightGrams / 1000;
  return Math.max(volumetricKg, actualKg) * 1000;
}

// ─── CARRIER PRICE TABLES (PLN) ───────────────────────────────────────────────

interface WeightTier {
  upTo1kg: number;
  upTo5kg: number;
  upTo10kg: number;
  upTo20kg: number;
  upTo31kg: number;
}

// ─── VINTED CARRIER AVAILABILITY MATRIX (from Poland) ─────────────────────────
// Based on: https://www.vinted.pl — integrated shipping from PL
//
// Country     | InPost | DPD | DHL | ORLEN Paczka
// PL          |   ✅   |  ✅ |  ✅ |     ✅
// CZ          |   ✅   |  ✅ |  ✅ |     ❌
// SK          |   ✅   |  ✅ |  ❌ |     ❌
// HU          |   ✅   |  ✅ |  ❌ |     ❌
// RO          |   ✅   |  ❌ |  ❌ |     ❌
// HR          |   ✅   |  ❌ |  ❌ |     ❌
// SI          |   ✅   |  ❌ |  ❌ |     ❌
// LT          |   ❌   |  ✅ |  ❌ |     ❌
// LV          |   ❌   |  ✅ |  ❌ |     ❌
// EE          |   ❌   |  ✅ |  ❌ |     ❌
// SE          |   ❌   |  ✅ |  ✅ |     ❌
// FI          |   ❌   |  ✅ |  ❌ |     ❌

// ─── DOMESTIC RATES (PL → PL) ────────────────────────────────────────────────

const DHL_DOMESTIC_PL: WeightTier   = { upTo1kg: 14, upTo5kg: 18, upTo10kg: 24, upTo20kg: 32, upTo31kg: 48 };
const INPOST_DOMESTIC_PL: WeightTier = { upTo1kg: 12, upTo5kg: 15, upTo10kg: 18, upTo20kg: 28, upTo31kg: 40 };
const DPD_DOMESTIC_PL: WeightTier   = { upTo1kg: 13, upTo5kg: 16, upTo10kg: 22, upTo20kg: 30, upTo31kg: 45 };

// ─── INTERNATIONAL RATE TIERS (PLN, from PL) ─────────────────────────────────

// InPost international rates from PL (Furgonetka gross rates)
const INPOST_INTERNATIONAL: Record<string, WeightTier> = {
  CZ: { upTo1kg: 22.90, upTo5kg: 27.90, upTo10kg: 34.90, upTo20kg: 44.90, upTo31kg: 62.00 },
  SK: { upTo1kg: 22.90, upTo5kg: 27.90, upTo10kg: 34.90, upTo20kg: 44.90, upTo31kg: 62.00 },
  HU: { upTo1kg: 26.90, upTo5kg: 32.90, upTo10kg: 42.90, upTo20kg: 56.90, upTo31kg: 78.00 },
  RO: { upTo1kg: 34.90, upTo5kg: 42.90, upTo10kg: 54.90, upTo20kg: 72.90, upTo31kg: 98.00 },
  HR: { upTo1kg: 36.90, upTo5kg: 45.90, upTo10kg: 58.90, upTo20kg: 76.90, upTo31kg: 102.00 },
  SI: { upTo1kg: 34.90, upTo5kg: 42.90, upTo10kg: 54.90, upTo20kg: 72.90, upTo31kg: 98.00 },
  DE: { upTo1kg: 31.90, upTo5kg: 38.90, upTo10kg: 48.90, upTo20kg: 64.90, upTo31kg: 84.00 },
  FR: { upTo1kg: 38.90, upTo5kg: 47.90, upTo10kg: 58.90, upTo20kg: 76.90, upTo31kg: 102.00 },
  AT: { upTo1kg: 35.90, upTo5kg: 43.90, upTo10kg: 54.90, upTo20kg: 72.90, upTo31kg: 96.00 },
  IT: { upTo1kg: 40.70, upTo5kg: 49.90, upTo10kg: 62.00, upTo20kg: 78.00, upTo31kg: 105.00 },
};

// DPD international rates from PL (Furgonetka gross rates)
const DPD_INTERNATIONAL: Record<string, WeightTier> = {
  CZ: { upTo1kg: 24.90, upTo5kg: 29.90, upTo10kg: 38.90, upTo20kg: 49.90, upTo31kg: 68.00 },
  SK: { upTo1kg: 24.90, upTo5kg: 29.90, upTo10kg: 38.90, upTo20kg: 49.90, upTo31kg: 68.00 },
  HU: { upTo1kg: 29.90, upTo5kg: 38.90, upTo10kg: 48.90, upTo20kg: 64.90, upTo31kg: 85.00 },
  LT: { upTo1kg: 29.90, upTo5kg: 36.90, upTo10kg: 46.90, upTo20kg: 59.90, upTo31kg: 82.00 },
  LV: { upTo1kg: 31.90, upTo5kg: 38.90, upTo10kg: 48.90, upTo20kg: 62.90, upTo31kg: 85.00 },
  EE: { upTo1kg: 34.90, upTo5kg: 42.90, upTo10kg: 52.90, upTo20kg: 68.90, upTo31kg: 92.00 },
  SE: { upTo1kg: 42.90, upTo5kg: 52.90, upTo10kg: 64.90, upTo20kg: 82.90, upTo31kg: 110.00 },
  FI: { upTo1kg: 42.90, upTo5kg: 52.90, upTo10kg: 64.90, upTo20kg: 82.90, upTo31kg: 110.00 },
  DE: { upTo1kg: 38.90, upTo5kg: 48.90, upTo10kg: 58.90, upTo20kg: 75.90, upTo31kg: 98.00 },
  FR: { upTo1kg: 44.90, upTo5kg: 54.90, upTo10kg: 66.90, upTo20kg: 84.90, upTo31kg: 112.00 },
  AT: { upTo1kg: 41.90, upTo5kg: 51.90, upTo10kg: 62.90, upTo20kg: 80.90, upTo31kg: 106.00 },
  IT: { upTo1kg: 48.60, upTo5kg: 58.90, upTo10kg: 69.90, upTo20kg: 89.90, upTo31kg: 118.00 },
};

// DHL international rates from PL (for Vinted-available countries only: CZ, SE)
const DHL_INTERNATIONAL_VINTED: Record<string, WeightTier> = {
  CZ: { upTo1kg: 30, upTo5kg: 39.67, upTo10kg: 47.65, upTo20kg: 54.67, upTo31kg: 73.95 },
  SE: { upTo1kg: 45, upTo5kg: 67.17, upTo10kg: 80.68, upTo20kg: 92.55, upTo31kg: 125.22 },
  DE: { upTo1kg: 35, upTo5kg: 45.00, upTo10kg: 55.00, upTo20kg: 70.00, upTo31kg: 90.00 },
  FR: { upTo1kg: 40, upTo5kg: 50.00, upTo10kg: 60.00, upTo20kg: 75.00, upTo31kg: 95.00 },
  AT: { upTo1kg: 38, upTo5kg: 48.00, upTo10kg: 58.00, upTo20kg: 72.00, upTo31kg: 92.00 },
  IT: { upTo1kg: 45, upTo5kg: 55.00, upTo10kg: 65.00, upTo20kg: 80.00, upTo31kg: 100.00 },
};

function getWeightPrice(tier: WeightTier, weightGrams: number): number | null {
  const kg = weightGrams / 1000;
  if (kg <= 1) return tier.upTo1kg;
  if (kg <= 5) return tier.upTo5kg;
  if (kg <= 10) return tier.upTo10kg;
  if (kg <= 20) return tier.upTo20kg;
  if (kg <= 31) return tier.upTo31kg;
  return null; // too heavy
}

/**
 * Main function — returns all available shipping options for a given route and parcel.
 * Enforces Vinted carrier availability matrix for PL origin.
 */
export function getShippingOptions(
  fromCode: string,
  toCode: string,
  parcel: ParcelDimensions,
  plnToEurRate: number = 4.25
): ShippingOption[] {
  const chargeableGrams = getChargeableWeightGrams(parcel);
  const options: ShippingOption[] = [];
  const isDomestic = fromCode === toCode && fromCode === 'PL';

  // ── DOMESTIC (PL → PL) ──────────────────────────────────────────────────
  if (isDomestic) {
    // Furgonetka domestic
    const dhlPrice = getWeightPrice(DHL_DOMESTIC_PL, chargeableGrams);
    if (dhlPrice !== null) {
      options.push({
        id: 'dhl_domestic',
        carrier: 'Furgonetka.pl',
        service: 'Furgonetka Courier',
        icon: '📦',
        pricePln: dhlPrice,
        priceEur: Math.round((dhlPrice / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Door-to-door delivery',
      });
      options.push({
        id: 'dhl_pop',
        carrier: 'Furgonetka.pl',
        service: 'Furgonetka Point / Box',
        icon: '📦',
        pricePln: Math.max(10, dhlPrice - 1),
        priceEur: Math.round((Math.max(10, dhlPrice - 1) / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Parcel locker / Pickup point',
      });
    }

    // DPD domestic
    const dpdPrice = getWeightPrice(DPD_DOMESTIC_PL, chargeableGrams);
    if (dpdPrice !== null) {
      options.push({
        id: 'dpd_domestic',
        carrier: 'DPD',
        service: 'DPD Classic',
        icon: '🔴',
        pricePln: dpdPrice,
        priceEur: Math.round((dpdPrice / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Door-to-door delivery',
      });
      options.push({
        id: 'dpd_pickup',
        carrier: 'DPD',
        service: 'DPD Pickup Station',
        icon: '🔴',
        pricePln: Math.max(10, dpdPrice - 1),
        priceEur: Math.round((Math.max(10, dpdPrice - 1) / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Parcel locker / Pickup point',
      });
    }

    // InPost domestic (max 25kg)
    if (chargeableGrams <= 25000) {
      const inpostPrice = getWeightPrice(INPOST_DOMESTIC_PL, chargeableGrams);
      if (inpostPrice !== null) {
        options.push({
          id: 'inpost_paczkomat',
          carrier: 'InPost',
          service: 'Paczkomat',
          icon: '🟢',
          pricePln: inpostPrice,
          priceEur: Math.round((inpostPrice / plnToEurRate) * 100) / 100,
          deliveryDays: '1-2',
          description: 'Parcel locker pickup',
        });
      }
    }

    // Orlen Paczka (PL domestic only)
    if (chargeableGrams <= 30000) {
      const orlenPrice = chargeableGrams <= 1000 ? 9.99 : chargeableGrams <= 5000 ? 12.99 : 15.99;
      options.push({
        id: 'orlen_paczka',
        carrier: 'Orlen',
        service: 'Orlen Paczka',
        icon: '🟠',
        pricePln: orlenPrice,
        priceEur: Math.round((orlenPrice / plnToEurRate) * 100) / 100,
        deliveryDays: '1-3',
        description: 'Parcel locker / Pickup point',
      });
    }
  }
  // ── INTERNATIONAL (PL → abroad) ─────────────────────────────────────────
  else if (fromCode === 'PL') {
    // InPost international
    const inpostTier = INPOST_INTERNATIONAL[toCode] || { upTo1kg: 25, upTo5kg: 30, upTo10kg: 40, upTo20kg: 55, upTo31kg: 75 };
    const inpostPrice = getWeightPrice(inpostTier, chargeableGrams);
    if (inpostPrice !== null) {
      options.push({
        id: 'inpost_paczkomat',
        carrier: 'InPost',
        service: 'InPost International',
        icon: '🟢',
        pricePln: inpostPrice,
        priceEur: Math.round((inpostPrice / plnToEurRate) * 100) / 100,
        deliveryDays: toCode === 'CZ' || toCode === 'SK' ? '2-3' : '3-5',
        description: 'Parcel locker / Pickup point',
      });
    }

    // DPD international
    const dpdTier = DPD_INTERNATIONAL[toCode] || { upTo1kg: 30, upTo5kg: 40, upTo10kg: 50, upTo20kg: 65, upTo31kg: 85 };
    const dpdPrice = getWeightPrice(dpdTier, chargeableGrams);
    if (dpdPrice !== null) {
      options.push({
        id: 'dpd_international',
        carrier: 'DPD',
        service: 'DPD International',
        icon: '🔴',
        pricePln: dpdPrice,
        priceEur: Math.round((dpdPrice / plnToEurRate) * 100) / 100,
        deliveryDays: ['CZ', 'SK', 'HU'].includes(toCode) ? '2-3' : ['LT', 'LV', 'EE'].includes(toCode) ? '3-4' : '4-6',
        description: 'Door-to-door delivery',
      });
      options.push({
        id: 'dpd_pickup',
        carrier: 'DPD',
        service: 'DPD Pickup Point',
        icon: '🔴',
        pricePln: Math.max(15, dpdPrice - 2),
        priceEur: Math.round((Math.max(15, dpdPrice - 2) / plnToEurRate) * 100) / 100,
        deliveryDays: ['CZ', 'SK', 'HU'].includes(toCode) ? '2-4' : ['LT', 'LV', 'EE'].includes(toCode) ? '3-5' : '4-7',
        description: 'Parcel locker / Pickup point',
      });
    }

    // Furgonetka international
    const dhlTier = DHL_INTERNATIONAL_VINTED[toCode] || { upTo1kg: 40, upTo5kg: 50, upTo10kg: 60, upTo20kg: 80, upTo31kg: 100 };
    const dhlPrice = getWeightPrice(dhlTier, chargeableGrams);
    if (dhlPrice !== null) {
      options.push({
        id: 'dhl_international',
        carrier: 'Furgonetka.pl',
        service: 'Furgonetka Express',
        icon: '📦',
        pricePln: dhlPrice,
        priceEur: Math.round((dhlPrice / plnToEurRate) * 100) / 100,
        deliveryDays: toCode === 'CZ' ? '2-3' : '4-6',
        description: 'International door-to-door',
      });
      options.push({
        id: 'dhl_pop',
        carrier: 'Furgonetka.pl',
        service: 'Furgonetka Point / Box',
        icon: '📦',
        pricePln: Math.max(15, dhlPrice - 2),
        priceEur: Math.round((Math.max(15, dhlPrice - 2) / plnToEurRate) * 100) / 100,
        deliveryDays: toCode === 'CZ' ? '2-3' : '4-6',
        description: 'Parcel locker / Pickup point',
      });
    }

    // Orlen Paczka
    if (chargeableGrams <= 30000) {
      const orlenPrice = chargeableGrams <= 1000 ? 19.99 : chargeableGrams <= 5000 ? 25.99 : 35.99;
      options.push({
        id: 'orlen_paczka',
        carrier: 'Orlen',
        service: 'Orlen Paczka',
        icon: '🟠',
        pricePln: orlenPrice,
        priceEur: Math.round((orlenPrice / plnToEurRate) * 100) / 100,
        deliveryDays: '3-6',
        description: 'Parcel locker / Pickup point',
      });
    }
  }

  // Sort by price
  return options.sort((a, b) => a.pricePln - b.pricePln);
}

/**
 * Map a ShippingOption (or generic option object) to its seller delivery Courier ID
 * (e.g. 'InPost', 'DPD', 'DHL', 'Orlen', 'Poczta', 'UPS', 'FedEx', 'GLS', 'Geis', 'Ambro')
 */
export function getCourierIdForOption(option: { id?: string; carrier?: string; service?: string }): string {
  const carrier = (option.carrier || '').toLowerCase();
  const id = (option.id || '').toLowerCase();
  const service = (option.service || '').toLowerCase();

  if (carrier.includes('inpost') || id.startsWith('inpost') || service.includes('inpost') || service.includes('paczkomat')) return 'InPost';
  if (carrier.includes('dpd') || id.startsWith('dpd') || service.includes('dpd')) return 'DPD';
  if (carrier.includes('dhl') || carrier.includes('furgonetka') || id.startsWith('dhl') || service.includes('dhl') || service.includes('furgonetka')) return 'DHL';
  if (carrier.includes('orlen') || id.startsWith('orlen') || service.includes('orlen')) return 'Orlen';
  if (carrier.includes('poczta') || id.startsWith('poczta') || service.includes('poczta')) return 'Poczta';
  if (carrier.includes('ups') || id.startsWith('ups') || service.includes('ups')) return 'UPS';
  if (carrier.includes('fedex') || id.startsWith('fedex') || service.includes('fedex')) return 'FedEx';
  if (carrier.includes('gls') || id.startsWith('gls') || service.includes('gls')) return 'GLS';
  if (carrier.includes('geis') || id.startsWith('geis') || service.includes('geis')) return 'Geis';
  if (carrier.includes('ambro') || id.startsWith('ambro') || service.includes('ambro')) return 'Ambro';

  return '';
}

/**
 * Filter shipping options to remove options matching any courier in disabledCouriers
 */
export function filterOptionsByDisabledCouriers(
  options: ShippingOption[],
  disabledCouriers: string[]
): ShippingOption[] {
  if (!disabledCouriers || disabledCouriers.length === 0) return options;

  const disabledSet = new Set(disabledCouriers.map(c => c.toLowerCase()));

  const filtered = options.filter(option => {
    const courierId = getCourierIdForOption(option);
    if (courierId && disabledSet.has(courierId.toLowerCase())) {
      return false;
    }
    return true;
  });

  // If filtering removed all options (safety fallback), return original options so checkout is not bricked
  return filtered.length > 0 ? filtered : options;
}

