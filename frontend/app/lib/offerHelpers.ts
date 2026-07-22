/**
 * Offer Helpers - Stock & Weight Utilities
 */

export function getOfferStock(offer: { stock?: number; color_variants?: any[] } | null | undefined): number {
  if (!offer) return 0;
  if (offer.color_variants && Array.isArray(offer.color_variants) && offer.color_variants.length > 0) {
    return offer.color_variants.reduce((sum: number, v: any) => sum + (parseInt(v.stock) || 0), 0);
  }
  return typeof offer.stock === 'number' ? offer.stock : 0;
}

export function isOfferSoldOut(offer: { stock?: number; color_variants?: any[] } | null | undefined): boolean {
  return getOfferStock(offer) <= 0;
}

export function formatOfferWeight(weightStr?: string | number | null, variantLayers?: any[]): string {
  let grams = 0;
  if (variantLayers && Array.isArray(variantLayers) && variantLayers.length > 0) {
    grams = variantLayers.reduce((sum: number, l: any) => sum + (parseFloat(l.grams || l.weight || '0') || 0), 0);
  } else if (weightStr !== undefined && weightStr !== null) {
    const str = weightStr.toString().trim().toLowerCase().replace(',', '.');
    if (str.endsWith('kg')) {
      grams = (parseFloat(str.replace('kg', '').trim()) || 0) * 1000;
    } else {
      grams = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    }
  }

  if (grams <= 0) return '1g';
  const rounded = Math.round(grams);
  return `${Math.max(1, rounded)}g`;
}
