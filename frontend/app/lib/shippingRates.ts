// ============================================================
// Printis Shipping Calculator
// Calculates parcel size from print dimensions + 5cm buffer
// Returns multiple carrier options with prices
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

// DHL domestic PL rates (PLN)
const DHL_DOMESTIC_PL: WeightTier = { upTo1kg: 14, upTo5kg: 18, upTo10kg: 24, upTo20kg: 32, upTo31kg: 48 };

// InPost Paczkomat domestic PL rates (PLN)
const INPOST_DOMESTIC_PL: WeightTier = { upTo1kg: 12, upTo5kg: 15, upTo10kg: 18, upTo20kg: 28, upTo31kg: 40 };

// DPD domestic PL rates (PLN)
const DPD_DOMESTIC_PL: WeightTier = { upTo1kg: 13, upTo5kg: 16, upTo10kg: 22, upTo20kg: 30, upTo31kg: 45 };

// International DHL rates from PL (PLN) — simplified by zone
const DHL_INTERNATIONAL: Record<string, WeightTier> = {
  // Zone 1 — DE, CZ, SK, AT, NL, BE, LT, LV, EE
  ZONE1: { upTo1kg: 35, upTo5kg: 42, upTo10kg: 50, upTo20kg: 60, upTo31kg: 80 },
  // Zone 2 — FR, ES, IT, SE, DK, IE, FI
  ZONE2: { upTo1kg: 50, upTo5kg: 60, upTo10kg: 70, upTo20kg: 85, upTo31kg: 115 },
  // Zone 3 — RO, BG, HR, PT, GR, HU, SI
  ZONE3: { upTo1kg: 55, upTo5kg: 65, upTo10kg: 78, upTo20kg: 95, upTo31kg: 130 },
  // Default
  DEFAULT: { upTo1kg: 65, upTo5kg: 80, upTo10kg: 100, upTo20kg: 130, upTo31kg: 180 },
};

const COUNTRY_ZONES: Record<string, string> = {
  DE: 'ZONE1', CZ: 'ZONE1', SK: 'ZONE1', AT: 'ZONE1', NL: 'ZONE1',
  BE: 'ZONE1', LT: 'ZONE1', LV: 'ZONE1', EE: 'ZONE1',
  FR: 'ZONE2', ES: 'ZONE2', IT: 'ZONE2', SE: 'ZONE2',
  DK: 'ZONE2', IE: 'ZONE2', FI: 'ZONE2', LU: 'ZONE2',
  RO: 'ZONE3', BG: 'ZONE3', HR: 'ZONE3', PT: 'ZONE3',
  GR: 'ZONE3', HU: 'ZONE3', SI: 'ZONE3',
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

// InPost only works domestically (PL→PL) and max 25kg
function inpostAvailable(fromCode: string, toCode: string, weightGrams: number): boolean {
  return fromCode === 'PL' && toCode === 'PL' && weightGrams <= 25000;
}

/**
 * Main function — returns all available shipping options for a given route and parcel
 */
export function getShippingOptions(
  fromCode: string,
  toCode: string,
  parcel: ParcelDimensions,
  plnToEurRate: number = 4.25
): ShippingOption[] {
  const chargeableGrams = getChargeableWeightGrams(parcel);
  const options: ShippingOption[] = [];

  if (fromCode === toCode) {
    // DOMESTIC
    const dhlPrice = getWeightPrice(DHL_DOMESTIC_PL, chargeableGrams);
    if (dhlPrice !== null) {
      options.push({
        id: 'dhl_domestic',
        carrier: 'DHL',
        service: 'DHL Parcel',
        icon: '🟡',
        pricePln: dhlPrice,
        priceEur: Math.round((dhlPrice / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Door-to-door delivery',
      });
      // DHL POP / Box (Pickup Point)
      options.push({
        id: 'dhl_pop',
        carrier: 'DHL',
        service: 'DHL POP / Box',
        icon: '🟡',
        pricePln: Math.max(10, dhlPrice - 1),
        priceEur: Math.round((Math.max(10, dhlPrice - 1) / plnToEurRate) * 100) / 100,
        deliveryDays: '1-2',
        description: 'Parcel locker / Pickup point',
      });
    }

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
      // DPD Pickup (Pickup Point)
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

    if (inpostAvailable(fromCode, toCode, chargeableGrams)) {
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
  } else {
    // INTERNATIONAL
    const zone = COUNTRY_ZONES[toCode] || 'DEFAULT';
    const intlTier = DHL_INTERNATIONAL[zone];
    const dhlPrice = getWeightPrice(intlTier, chargeableGrams);
    if (dhlPrice !== null) {
      options.push({
        id: 'dhl_international',
        carrier: 'DHL',
        service: 'DHL Parcel Connect',
        icon: '🟡',
        pricePln: dhlPrice,
        priceEur: Math.round((dhlPrice / plnToEurRate) * 100) / 100,
        deliveryDays: zone === 'ZONE1' ? '2-3' : zone === 'ZONE2' ? '3-5' : '4-6',
        description: 'International door-to-door',
      });
    }
  }

  // Sort by price
  return options.sort((a, b) => a.pricePln - b.pricePln);
}
