const { getShippingOptions, parseDimensionString, calculateParcel } = require('./app/lib/shippingRates');

// Mock data based on the checkout page state
const items = [
  { id: 'some-offer-id', seller_id: '64a1da17-6803-416c-ba3e-7c9fd4dab77e', quantity: 110, price: 13.65 }
];
const offerWeights = { 'some-offer-id': 234 }; // from the screenshot (234g)
const offerDimensions = { 'some-offer-id': 'Width: 100 mm, Height: 100 mm, Depth: 100 mm' };
const sellerCountries = { '64a1da17-6803-416c-ba3e-7c9fd4dab77e': 'PL' };
const sellerDeliverySettings = { '64a1da17-6803-416c-ba3e-7c9fd4dab77e': {} };
const formData = { country: 'PL' };
const rates = { PLN: 1, EUR: 4.25 };
const currency = 'PLN';

function run() {
  try {
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
    const disabledCouriers = deliverySettings.disabled_couriers || [];
    const freeShippingEnabled = deliverySettings.free_shipping_enabled || false;
    const freeShippingThreshold = deliverySettings.free_shipping_threshold || 0;

    const sellerItemsPricePln = shippableItems
        .filter(item => item.seller_id === firstSellerId)
        .reduce((sum, item) => sum + (item.price * item.quantity * (currency !== 'PLN' && rates && rates['PLN'] && rates[currency] ? (rates['PLN']/rates[currency]) : 1)), 0);

    console.log("totalWeightGrams:", totalWeightGrams);
    console.log("maxDimsMm:", maxDimsMm);
    const parcel = calculateParcel(maxDimsMm, totalWeightGrams);
    console.log("Parcel:", parcel);
    
    let options = getShippingOptions(fromCode, toCode, parcel, plnRate);
    console.log("Options count:", options.length);
    console.log("Options:", options);
  } catch (e) {
    console.error("CRASHED:", e);
  }
}

run();
