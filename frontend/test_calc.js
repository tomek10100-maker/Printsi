function parseDimensionString(dimStr) {
  if (!dimStr) return null;
  const nums = [];
  const matches = dimStr.matchAll(/[\d.]+(?:\s*mm)?/g);
  for (const m of matches) {
    const n = parseFloat(m[0]);
    if (!isNaN(n)) nums.push(n);
  }
  if (nums.length < 3) return null;
  nums.sort((a, b) => b - a);
  return [nums[0], nums[1], nums[2]];
}

function calculateParcel(dimsMm, weightGrams) {
  const BUFFER_CM = 5;
  if (!dimsMm) {
    return { lengthCm: 20, widthCm: 15, heightCm: 10, weightGrams };
  }
  return {
    lengthCm: Math.ceil(dimsMm[0] / 10) + BUFFER_CM,
    widthCm: Math.ceil(dimsMm[1] / 10) + BUFFER_CM,
    heightCm: Math.ceil(dimsMm[2] / 10) + BUFFER_CM,
    weightGrams,
  };
}

function getChargeableWeightGrams(parcel) {
  const volumetricKg = (parcel.lengthCm * parcel.widthCm * parcel.heightCm) / 5000;
  const actualKg = parcel.weightGrams / 1000;
  return Math.max(volumetricKg, actualKg) * 1000;
}

function getWeightPrice(tier, weightGrams) {
  const kg = weightGrams / 1000;
  if (kg <= 1) return tier.upTo1kg;
  if (kg <= 5) return tier.upTo5kg;
  if (kg <= 10) return tier.upTo10kg;
  if (kg <= 20) return tier.upTo20kg;
  if (kg <= 31) return tier.upTo31kg;
  return null;
}

const DHL_DOMESTIC_PL = { upTo1kg: 14, upTo5kg: 18, upTo10kg: 24, upTo20kg: 32, upTo31kg: 48 };
const INPOST_DOMESTIC_PL = { upTo1kg: 12, upTo5kg: 15, upTo10kg: 18, upTo20kg: 28, upTo31kg: 40 };
const DPD_DOMESTIC_PL = { upTo1kg: 13, upTo5kg: 16, upTo10kg: 22, upTo20kg: 30, upTo31kg: 45 };

function getShippingOptions(fromCode, toCode, parcel, plnToEurRate = 4.25) {
  const chargeableGrams = getChargeableWeightGrams(parcel);
  const options = [];
  const isDomestic = fromCode === toCode && fromCode === 'PL';

  if (isDomestic) {
    const dhlPrice = getWeightPrice(DHL_DOMESTIC_PL, chargeableGrams);
    if (dhlPrice !== null) {
      options.push({ id: 'dhl_domestic', carrier: 'DHL', pricePln: dhlPrice });
      options.push({ id: 'dhl_pop', carrier: 'DHL', pricePln: Math.max(10, dhlPrice - 1) });
    }
    const dpdPrice = getWeightPrice(DPD_DOMESTIC_PL, chargeableGrams);
    if (dpdPrice !== null) {
      options.push({ id: 'dpd_domestic', carrier: 'DPD', pricePln: dpdPrice });
      options.push({ id: 'dpd_pickup', carrier: 'DPD', pricePln: Math.max(10, dpdPrice - 1) });
    }
    if (chargeableGrams <= 25000) {
      const inpostPrice = getWeightPrice(INPOST_DOMESTIC_PL, chargeableGrams);
      if (inpostPrice !== null) {
        options.push({ id: 'inpost_paczkomat', carrier: 'InPost', pricePln: inpostPrice });
      }
    }
  }
  return options;
}

const items = [
  { id: '1c102660-9a77-41c9-a985-7be707660986', seller_id: '64a1da17-6803-416c-ba3e-7c9fd4dab77e', quantity: 110, price: 13.65 }
];
const offerWeights = {}; // empty
const offerDimensions = {}; // empty
const sellerCountries = {}; // empty
const sellerDeliverySettings = {}; // empty
const formData = { country: 'PL' };
const rates = null;

function calculate() {
  const plnRate = rates?.['PLN'] || 4.25;

  let totalWeightGrams = 0;
  let maxDimsMm = null;

  const shippableItems = items.filter(item => item.category !== 'digital');
  for (const item of shippableItems) {
    totalWeightGrams += (offerWeights[item.id] ?? 500) * item.quantity;
    const dimStr = offerDimensions[item.id];
    const dims = parseDimensionString(dimStr);
    if (dims) {
      if (!maxDimsMm) {
        maxDimsMm = dims;
      } else {
        maxDimsMm = [
          Math.max(maxDimsMm[0], dims[0]),
          Math.max(maxDimsMm[1], dims[1]),
          maxDimsMm[2] + dims[2],
        ];
      }
    }
  }

  const firstSellerId = shippableItems[0]?.seller_id;
  const fromCode = (sellerCountries)[firstSellerId] || 'PL';
  const toCode = formData.country;
  const deliverySettings = sellerDeliverySettings[firstSellerId] || {};

  const parcel = calculateParcel(maxDimsMm, totalWeightGrams);
  let options = getShippingOptions(fromCode, toCode, parcel, plnRate);

  console.log("totalWeightGrams:", totalWeightGrams);
  console.log("parcel:", parcel);
  console.log("options:", options);
}

calculate();
