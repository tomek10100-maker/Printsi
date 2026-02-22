// ============================================================
// DHL Parcel Connect — Rate Table & Shipping Calculator
// Supports: origin-aware routing, domestic vs cross-border
// ============================================================

export interface DhlCountry {
    name: string;
    code: string;
    deliveryDays: string;
    // International rates FROM Poland (PLN) — used as cross-border approximation
    rates: {
        upTo5kg: number;
        upTo10kg: number;
        upTo20kg: number;
        upTo31kg: number;
    };
}

// All DHL Parcel Connect countries, sorted by delivery time
export const DHL_COUNTRIES: DhlCountry[] = [
    { name: 'Poland', code: 'PL', deliveryDays: '1-2', rates: { upTo5kg: 20.00, upTo10kg: 25.00, upTo20kg: 35.00, upTo31kg: 50.00 } },
    { name: 'Germany', code: 'DE', deliveryDays: '2', rates: { upTo5kg: 39.67, upTo10kg: 47.65, upTo20kg: 54.67, upTo31kg: 73.95 } },
    { name: 'Czech Republic', code: 'CZ', deliveryDays: '2', rates: { upTo5kg: 39.67, upTo10kg: 47.65, upTo20kg: 54.67, upTo31kg: 73.95 } },
    { name: 'Slovakia', code: 'SK', deliveryDays: '2', rates: { upTo5kg: 39.67, upTo10kg: 47.65, upTo20kg: 54.67, upTo31kg: 73.95 } },
    { name: 'Netherlands', code: 'NL', deliveryDays: '2', rates: { upTo5kg: 39.67, upTo10kg: 47.65, upTo20kg: 54.67, upTo31kg: 73.95 } },
    { name: 'Austria', code: 'AT', deliveryDays: '2', rates: { upTo5kg: 43.89, upTo10kg: 52.71, upTo20kg: 60.45, upTo31kg: 81.80 } },
    { name: 'Belgium', code: 'BE', deliveryDays: '3', rates: { upTo5kg: 46.76, upTo10kg: 56.18, upTo20kg: 64.43, upTo31kg: 87.18 } },
    { name: 'Lithuania', code: 'LT', deliveryDays: '3', rates: { upTo5kg: 53.53, upTo10kg: 64.30, upTo20kg: 73.75, upTo31kg: 99.77 } },
    { name: 'Hungary', code: 'HU', deliveryDays: '3', rates: { upTo5kg: 55.22, upTo10kg: 66.31, upTo20kg: 76.09, upTo31kg: 102.92 } },
    { name: 'Latvia', code: 'LV', deliveryDays: '3', rates: { upTo5kg: 55.58, upTo10kg: 66.77, upTo20kg: 76.59, upTo31kg: 103.61 } },
    { name: 'Ireland', code: 'IE', deliveryDays: '4', rates: { upTo5kg: 51.67, upTo10kg: 62.06, upTo20kg: 71.19, upTo31kg: 96.32 } },
    { name: 'Denmark', code: 'DK', deliveryDays: '4', rates: { upTo5kg: 58.90, upTo10kg: 70.75, upTo20kg: 81.16, upTo31kg: 109.79 } },
    { name: 'Estonia', code: 'EE', deliveryDays: '4', rates: { upTo5kg: 59.21, upTo10kg: 69.60, upTo20kg: 79.85, upTo31kg: 108.02 } },
    { name: 'Luxembourg', code: 'LU', deliveryDays: '4', rates: { upTo5kg: 55.59, upTo10kg: 66.77, upTo20kg: 76.59, upTo31kg: 103.61 } },
    { name: 'Spain', code: 'ES', deliveryDays: '4', rates: { upTo5kg: 55.56, upTo10kg: 66.74, upTo20kg: 76.58, upTo31kg: 103.57 } },
    { name: 'Italy', code: 'IT', deliveryDays: '4', rates: { upTo5kg: 64.93, upTo10kg: 77.99, upTo20kg: 89.45, upTo31kg: 121.00 } },
    { name: 'France', code: 'FR', deliveryDays: '4', rates: { upTo5kg: 75.64, upTo10kg: 80.53, upTo20kg: 98.94, upTo31kg: 122.68 } },
    { name: 'Sweden', code: 'SE', deliveryDays: '4', rates: { upTo5kg: 67.17, upTo10kg: 80.68, upTo20kg: 92.55, upTo31kg: 125.22 } },
    { name: 'Portugal', code: 'PT', deliveryDays: '5', rates: { upTo5kg: 59.02, upTo10kg: 70.88, upTo20kg: 81.32, upTo31kg: 110.02 } },
    { name: 'Croatia', code: 'HR', deliveryDays: '5', rates: { upTo5kg: 68.35, upTo10kg: 82.10, upTo20kg: 94.18, upTo31kg: 127.37 } },
    { name: 'Romania', code: 'RO', deliveryDays: '5', rates: { upTo5kg: 56.53, upTo10kg: 67.88, upTo20kg: 77.88, upTo31kg: 105.36 } },
    { name: 'Slovenia', code: 'SI', deliveryDays: '5', rates: { upTo5kg: 62.14, upTo10kg: 74.62, upTo20kg: 85.60, upTo31kg: 115.82 } },
    { name: 'Finland', code: 'FI', deliveryDays: '5', rates: { upTo5kg: 68.56, upTo10kg: 82.33, upTo20kg: 94.46, upTo31kg: 127.78 } },
    { name: 'Monaco', code: 'MC', deliveryDays: '5', rates: { upTo5kg: 73.09, upTo10kg: 77.83, upTo20kg: 95.60, upTo31kg: 118.56 } },
    { name: 'Bulgaria', code: 'BG', deliveryDays: '5', rates: { upTo5kg: 83.51, upTo10kg: 100.28, upTo20kg: 115.05, upTo31kg: 155.65 } },
    { name: 'Greece', code: 'GR', deliveryDays: '7', rates: { upTo5kg: 62.64, upTo10kg: 75.24, upTo20kg: 86.32, upTo31kg: 116.79 } },
    { name: 'Malta', code: 'MT', deliveryDays: '7', rates: { upTo5kg: 506.04, upTo10kg: 581.56, upTo20kg: 659.32, upTo31kg: 740.47 } },
    { name: 'Cyprus', code: 'CY', deliveryDays: '10', rates: { upTo5kg: 123.98, upTo10kg: 170.19, upTo20kg: 218.65, upTo31kg: 273.87 } },
];

// Domestic shipping rates (within the same country) in PLN equivalent
// Based on typical major courier prices per country, 2025
const DOMESTIC_RATES_PLN: Record<string, { upTo5kg: number; upTo10kg: number; upTo20kg: number; upTo31kg: number }> = {
    PL: { upTo5kg: 15, upTo10kg: 20, upTo20kg: 30, upTo31kg: 45 },
    DE: { upTo5kg: 25, upTo10kg: 32, upTo20kg: 42, upTo31kg: 60 },
    FR: { upTo5kg: 27, upTo10kg: 35, upTo20kg: 48, upTo31kg: 68 },
    NL: { upTo5kg: 22, upTo10kg: 30, upTo20kg: 40, upTo31kg: 58 },
    AT: { upTo5kg: 24, upTo10kg: 31, upTo20kg: 41, upTo31kg: 59 },
    BE: { upTo5kg: 23, upTo10kg: 30, upTo20kg: 40, upTo31kg: 57 },
    ES: { upTo5kg: 25, upTo10kg: 33, upTo20kg: 44, upTo31kg: 63 },
    IT: { upTo5kg: 26, upTo10kg: 34, upTo20kg: 46, upTo31kg: 65 },
    SE: { upTo5kg: 26, upTo10kg: 34, upTo20kg: 45, upTo31kg: 64 },
    CZ: { upTo5kg: 18, upTo10kg: 24, upTo20kg: 33, upTo31kg: 47 },
    SK: { upTo5kg: 18, upTo10kg: 24, upTo20kg: 33, upTo31kg: 47 },
    HU: { upTo5kg: 20, upTo10kg: 26, upTo20kg: 36, upTo31kg: 52 },
    RO: { upTo5kg: 19, upTo10kg: 25, upTo20kg: 35, upTo31kg: 50 },
    BG: { upTo5kg: 18, upTo10kg: 24, upTo20kg: 33, upTo31kg: 47 },
    PT: { upTo5kg: 24, upTo10kg: 31, upTo20kg: 42, upTo31kg: 60 },
    GR: { upTo5kg: 22, upTo10kg: 29, upTo20kg: 39, upTo31kg: 56 },
    HR: { upTo5kg: 20, upTo10kg: 27, upTo20kg: 37, upTo31kg: 53 },
    // Default for remaining countries
    DEFAULT: { upTo5kg: 23, upTo10kg: 30, upTo20kg: 42, upTo31kg: 60 },
};

/** Convert country full name to 2-letter ISO code */
export function countryNameToCode(name: string): string | null {
    const country = DHL_COUNTRIES.find(c =>
        c.name.toLowerCase() === (name || '').toLowerCase()
    );
    return country?.code || null;
}

/** Get rate from a rate-tier object based on weight in grams */
function getRateByWeight(
    rateTier: { upTo5kg: number; upTo10kg: number; upTo20kg: number; upTo31kg: number },
    weightGrams: number
): number | null {
    const kg = weightGrams / 1000;
    if (kg <= 5) return rateTier.upTo5kg;
    if (kg <= 10) return rateTier.upTo10kg;
    if (kg <= 20) return rateTier.upTo20kg;
    if (kg <= 31) return rateTier.upTo31kg;
    return null; // Over 31kg — DHL Connect doesn't handle
}

/**
 * Calculate DHL shipping cost in PLN.
 * Handles:
 * - Domestic (fromCode === toCode): uses DOMESTIC_RATES_PLN
 * - Cross-border EU: uses destination country's international rate table
 *
 * @param fromCode  2-letter ISO code of seller's country (ship FROM)
 * @param toCode    2-letter ISO code of buyer's country (ship TO)
 * @param weightGrams Total parcel weight in grams
 * @returns Shipping cost in PLN, or null if unsupported
 */
export function calculateShippingPln(
    fromCode: string,
    toCode: string,
    weightGrams: number
): number | null {
    if (weightGrams > 31000) return null;

    // DOMESTIC delivery (same country)
    if (fromCode === toCode) {
        const domesticRates = DOMESTIC_RATES_PLN[fromCode] || DOMESTIC_RATES_PLN['DEFAULT'];
        return getRateByWeight(domesticRates, weightGrams);
    }

    // CROSS-BORDER: check if destination is in our DHL table
    const toCountry = DHL_COUNTRIES.find(c => c.code === toCode);
    if (!toCountry) return null;

    return getRateByWeight(toCountry.rates, weightGrams);
}

// Keep old function for backward compatibility
export function calculateDhlShippingPln(toCode: string, weightGrams: number): number | null {
    return calculateShippingPln('PL', toCode, weightGrams);
}

/**
 * Parse weight string from the offers table (stored as text).
 * Supports: "500", "500g", "500 g", "1.5kg", "1.5 kg"
 * Returns weight in grams. Defaults to 500g if unparseable.
 */
export function parseWeightToGrams(weightStr: string | null | undefined): number {
    if (!weightStr) return 500;
    const normalized = weightStr.trim().toLowerCase().replace(',', '.');
    const kgMatch = normalized.match(/^([\d.]+)\s*kg$/);
    if (kgMatch) return Math.round(parseFloat(kgMatch[1]) * 1000);
    const gMatch = normalized.match(/^([\d.]+)\s*g?$/);
    if (gMatch) return Math.round(parseFloat(gMatch[1]));
    return 500;
}
