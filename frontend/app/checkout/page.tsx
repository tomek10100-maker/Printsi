'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { supabase } from '../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import {
  CreditCard, ArrowLeft, Loader2, MapPin,
  ShieldCheck, Wallet, Package, Truck,
  AlertCircle, Zap, TrendingUp, Plus, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { DHL_COUNTRIES, countryNameToCode, parseWeightToGrams } from '../lib/dhlRates';
import {
  getShippingOptions,
  calculateParcel,
  parseDimensionString,
  ShippingOption
} from '../lib/shippingRates';

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTopup = searchParams.get('type') === 'topup';

  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'balance'>(isTopup ? 'stripe' : ((searchParams.get('method') as 'stripe' | 'balance') || 'stripe'));
  const [balance, setBalance] = useState<number | null>(null);

  const { currency, rates, formatPrice } = useCurrency();
  const cart = useCart();
  const items = cart?.items || [];

  const [topupAmount, setTopupAmount] = useState<string>('10');

  const numericTopup = parseFloat(topupAmount) || 0;
  const cartTotalEur = isTopup
    ? (numericTopup / (rates?.[currency] || 1))
    : items.reduce((total, item) => total + (item.price * item.quantity), 0);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [offerWeights, setOfferWeights] = useState<Record<string, number>>({});
  const [offerDimensions, setOfferDimensions] = useState<Record<string, string>>({});
  const [sellerCountries, setSellerCountries] = useState<Record<string, string>>({});
  const [sellerDeliverySettings, setSellerDeliverySettings] = useState<Record<string, any>>({});
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  // Stable options — never clears once set, prevents spinner flash between re-renders
  const [stableShippingOptions, setStableShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{
    code: string;
    name: string;
    street: string;
    city: string;
    zip: string;
    courier: string;
  } | null>(null);
  const [showMapError, setShowMapError] = useState(false);

  const isPickupOption = selectedShipping?.id === 'inpost_paczkomat' || selectedShipping?.id === 'dpd_pickup' || selectedShipping?.id === 'dhl_pop' || selectedShipping?.id === 'orlen_paczka';

  useEffect(() => {
    setSelectedPoint(null);
    setShowMapError(false);
  }, [selectedShipping]);

  const openFurgonetkaMap = () => {
    if (typeof window === 'undefined' || !(window as any).Furgonetka || !(window as any).Furgonetka.Map) {
      alert('Furgonetka map is loading, please try again in a moment...');
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY || '';

    // Determine target couriers for the widget based on selected shipping method
    let mapCouriers = ['inpost'];
    if (selectedShipping?.id === 'dpd_pickup') {
      mapCouriers = ['dpd'];
    } else if (selectedShipping?.id === 'dhl_pop') {
      mapCouriers = ['dhl'];
    } else if (selectedShipping?.id === 'orlen_paczka') {
      mapCouriers = ['orlen'];
    }

    // Set country for international pickup point search
    const targetCountry = (formData.country || 'PL').toLowerCase();

    const map = new (window as any).Furgonetka.Map({
      apiKey: apiKey,
      courierServices: mapCouriers,
      countryCode: targetCountry.toUpperCase(),
      countryCodesFilter: [targetCountry.toUpperCase()],
      callback: (params: any) => {
        if (params && params.point) {
          const p = params.point;
          const pointDetails = {
            code: p.code,
            name: p.name || `${p.code} - ${p.street}`,
            street: p.street || '',
            city: p.city || '',
            zip: p.zip || p.postcode || '',
            courier: p.courier || p.service || p.type || (selectedShipping?.id === 'dpd_pickup' ? 'dpd' : selectedShipping?.id === 'dhl_pop' ? 'dhl' : 'inpost'),
          };
          setSelectedPoint(pointDetails);
          setShowMapError(false);

          // Auto-fill standard form fields so that user gets feedback in the form
          setFormData(prev => ({
            ...prev,
            address: `${pointDetails.name}, ${pointDetails.street}`,
            city: pointDetails.city || prev.city,
            zip: pointDetails.zip || prev.zip,
          }));
        }
      }
    });

    map.show();
  };

  const getPickupLabels = () => {
    if (selectedShipping?.id === 'dpd_pickup') {
      return {
        title: 'Selected DPD Pickup Point',
        placeholder: 'No pickup point selected. Use the map to select the nearest DPD point.',
        error: 'Please select a DPD pickup point on the map before proceeding.',
        button: selectedPoint ? 'Change DPD Point' : 'Select on map'
      };
    }
    if (selectedShipping?.id === 'dhl_pop') {
      return {
        title: 'Selected DHL Pickup Point',
        placeholder: 'No pickup point selected. Use the map to select the nearest DHL point.',
        error: 'Please select a DHL pickup point on the map before proceeding.',
        button: selectedPoint ? 'Change DHL Point' : 'Select on map'
      };
    }
    if (selectedShipping?.id === 'orlen_paczka') {
      return {
        title: 'Selected Orlen Paczka Point',
        placeholder: 'No pickup point selected. Use the map to select the nearest Orlen point.',
        error: 'Please select an Orlen Paczka point on the map before proceeding.',
        button: selectedPoint ? 'Change Orlen Point' : 'Select on map'
      };
    }
    return {
      title: 'Selected InPost Paczkomat',
      placeholder: 'No pickup point selected. Use the map to select the nearest Paczkomat.',
      error: 'Please select a Paczkomat on the map before proceeding.',
      button: selectedPoint ? 'Change Paczkomat' : 'Select on map'
    };
  };

  const pickupLabels = getPickupLabels();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    country: 'PL'
  });

  // Determine if cart has any shippable (physical) items
  // Use item.category from CartItem directly — no async DB fetch needed, avoids race condition
  const hasShippable = useMemo(() => {
    if (isTopup) return false;
    return items.some(item => item.category !== 'digital');
  }, [items, isTopup]);

  // Compute available shipping options based on items dimensions + weight
  const availableShippingOptions = useMemo((): ShippingOption[] => {
    if (!hasShippable) return [];
    const plnRate = rates?.['PLN'] || 4.25;

    // Group by seller, find worst-case (largest) dimensions
    let totalWeightGrams = 0;
    let maxDimsMm: [number, number, number] | null = null;

    // Use item.category from cart (no async fetch needed)
    const shippableItems = items.filter(item => item.category !== 'digital');
    for (const item of shippableItems) {
      totalWeightGrams += (offerWeights[item.id] ?? 500) * item.quantity;
      const dimStr = offerDimensions[item.id];
      const dims = parseDimensionString(dimStr);
      if (dims) {
        if (!maxDimsMm) {
          maxDimsMm = dims;
        } else {
          // Combine: assume items stack, so add longest side
          maxDimsMm = [
            Math.max(maxDimsMm[0], dims[0]),
            Math.max(maxDimsMm[1], dims[1]),
            maxDimsMm[2] + dims[2],
          ];
        }
      }
    }

    // Get seller's country and delivery settings (first shippable seller)
    const firstSellerId = shippableItems[0]?.seller_id;
    const fromCode = (sellerCountries as any)[firstSellerId] || 'PL';
    const toCode = formData.country;
    const deliverySettings = sellerDeliverySettings[firstSellerId] || {};
    const disabledCouriers: string[] = deliverySettings.disabled_couriers || [];
    const freeShippingEnabled: boolean = deliverySettings.free_shipping_enabled || false;
    const freeShippingThreshold: number = deliverySettings.free_shipping_threshold || 0;

    // Calculate total price of items from this seller to check free shipping threshold
    // For simplicity we check total shippable cart price, but ideal would be per-seller
    const sellerItemsPricePln = shippableItems
        .filter(item => item.seller_id === firstSellerId)
        .reduce((sum, item) => sum + (item.price * item.quantity * (currency !== 'PLN' && rates && rates['PLN'] && rates[currency] ? (rates['PLN']/rates[currency]) : 1)), 0);

    const parcel = calculateParcel(maxDimsMm, totalWeightGrams);
    let options = getShippingOptions(fromCode, toCode, parcel, plnRate);

    // Filter out disabled couriers
    if (disabledCouriers.length > 0) {
        options = options.filter(opt => {
            const carrierUpper = opt.carrier.toUpperCase();
            return !disabledCouriers.some(dc => carrierUpper.includes(dc.toUpperCase()) || dc.toUpperCase().includes(carrierUpper));
        });
    }

    // Apply free shipping if threshold is met
    if (freeShippingEnabled && freeShippingThreshold > 0 && sellerItemsPricePln >= freeShippingThreshold) {
        options = options.map(opt => ({
            ...opt,
            pricePln: 0,
            priceEur: 0,
            description: 'FREE SHIPPING (Seller Promo)'
        }));
    }

    return options;
  }, [hasShippable, items, offerWeights, offerDimensions, sellerCountries, sellerDeliverySettings, formData.country, rates]);

  // Keep stable options — only update when we have real results (never flash to empty)
  useEffect(() => {
    if (availableShippingOptions.length > 0) {
      setStableShippingOptions(availableShippingOptions);
      // Re-select same carrier if still available, otherwise pick first
      setSelectedShipping(prev => {
        if (!prev) return availableShippingOptions[0];
        const still = availableShippingOptions.find(o => o.id === prev.id);
        return still || availableShippingOptions[0];
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableShippingOptions]);

  const shippingPln = selectedShipping?.pricePln ?? 0;

  const shippingEur = useMemo(() => {
    if (isTopup || !hasShippable) return 0;
    if (!selectedShipping) return null;
    return selectedShipping.priceEur;
  }, [isTopup, hasShippable, selectedShipping]);

  // --- Fee calculations ---
  const feeBase = cartTotalEur + (shippingEur ?? 0); // base for fees
  const printsiTaxEur = isTopup ? 0 : feeBase * 0.01;          // 1% Printsi Tax
  const buyerProtectionEur = isTopup ? 0 : feeBase * 0.025;    // 2.5% Buyer Protection
  const isForeignCurrency = currency !== 'EUR';
  const currencyConversionEur = (isTopup || !isForeignCurrency) ? 0 : feeBase * 0.015; // 1.5% only for non-EUR
  const totalFeesEur = printsiTaxEur + buyerProtectionEur + currencyConversionEur;

  const grandTotalEur = feeBase + totalFeesEur;

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        const rawCountry = profile.country || 'PL';
        const countryCode = rawCountry.length === 2 ? rawCountry.toUpperCase() : (countryNameToCode(rawCountry) || 'PL');
        setFormData({
          fullName: profile.full_name || '',
          email: user.email || '',
          phone: profile.phone || '',
          address: profile.address || '',
          city: profile.city || '',
          zip: profile.zip_code || '',
          country: countryCode,
        });
      }

      // Fetch offer details (weight, category, dimensions) for cart items
      if (items.length > 0) {
        const offerIds = items.map(i => i.id);
        const { data: offerData } = await supabase
          .from('offers')
          .select('id, weight, category, dimensions, user_id')
          .in('id', offerIds);

        if (offerData) {
          const weights: Record<string, number> = {};
          const dimensions: Record<string, string> = {};
          const sellerIds: string[] = [];

          offerData.forEach(o => {
            weights[o.id] = parseWeightToGrams(o.weight);
            if (o.dimensions) dimensions[o.id] = o.dimensions;
            if (o.user_id) sellerIds.push(o.user_id);
          });

          setOfferWeights(weights);
          setOfferDimensions(dimensions);

          // Fetch seller countries & delivery settings
          if (sellerIds.length > 0) {
            const { data: sellerProfiles } = await supabase
              .from('profiles')
              .select('id, country, free_shipping_enabled, free_shipping_threshold, disabled_couriers')
              .in('id', [...new Set(sellerIds)]);

            const countries: Record<string, string> = {};
            const deliverySettings: Record<string, any> = {};
            
            sellerProfiles?.forEach(p => {
              const code = (p.country || 'PL').length === 2
                ? p.country.toUpperCase()
                : (countryNameToCode(p.country) || 'PL');
              countries[p.id] = code;
              deliverySettings[p.id] = {
                  free_shipping_enabled: p.free_shipping_enabled,
                  free_shipping_threshold: p.free_shipping_threshold,
                  disabled_couriers: p.disabled_couriers || []
              };
            });
            setSellerCountries(countries);
            setSellerDeliverySettings(deliverySettings);
          }
        }
      }

      const { data: sales } = await supabase.from('order_items').select('price_at_purchase, quantity, status').eq('seller_id', user.id);
      const totalEarned = sales?.reduce((acc, s) => s.status === 'completed' ? acc + (s.price_at_purchase * (s.quantity || 1)) : acc, 0) || 0;
      const { data: orders } = await supabase.from('orders').select('total_amount').eq('buyer_id', user.id).like('stripe_payment_intent_id', 'balance_%');
      const totalSpent = orders?.reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
      const { data: payouts } = await supabase.from('payouts').select('amount').eq('user_id', user.id).in('status', ['pending', 'completed']);
      const totalPayouts = payouts?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
      setBalance(Math.max(0, totalEarned - totalSpent - totalPayouts));

      setFetchingProfile(false);
    };
    fetchUserData();
  }, [router, items.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isTopup && items.length === 0) return;
    if (hasShippable && !selectedShipping) { alert('Please select a shipping method.'); return; }
    if (isPickupOption && !selectedPoint) {
      setShowMapError(true);
      return;
    }

    setLoading(true);
    const currentRate = rates?.[currency] || 1;

    try {
      if (paymentMethod === 'balance') {
        const shippingDetails = (shippingEur ?? 0) > 0 ? {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          zip: formData.zip,
          country: formData.country
        } : undefined;

        const response = await fetch('/api/balance/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            items,
            shipping: shippingDetails,
            shippingCostEur: shippingEur || 0,
            selectedPoint: selectedPoint || undefined
          }),
        });
        const data = await response.json();

        if (data.success) {
          // Czyszczenie koszyka z localStorage / Contextu
          cart.clearCart();

          // Sukces płatności balansem - przekierowanie do wiadomości lub zamówień
          window.location.href = data.chatId ? `/profile/messages?chat=${data.chatId}` : `/profile/messages`;
        } else {
          alert('Error: ' + data.error);
          setLoading(false);
        }
      } else {
        const body = isTopup
          ? { userId: user.id, isTopup: true, topupAmount: numericTopup, email: formData.email, selectedCurrency: currency, exchangeRate: currentRate }
          : {
              userId: user.id, items, email: formData.email,
              selectedCurrency: currency, exchangeRate: currentRate,
              shippingCostEur: shippingEur || 0,
              shippingLabel: selectedShipping ? `${selectedShipping.carrier} ${selectedShipping.service}` : 'Shipping',
              shipping: (shippingEur ?? 0) > 0 ? {
                name: formData.fullName,
                address: { line1: formData.address, city: formData.city, postal_code: formData.zip, country: formData.country }
              } : undefined,
              selectedPoint: selectedPoint || undefined
            };

        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (data.url) window.location.href = data.url;
        else { alert('Error: ' + data.error); setLoading(false); }
      }
    } catch (err) { alert('Request error'); setLoading(false); }
  };

  if (!isTopup && items.length === 0 && !loading && !fetchingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h2 className="text-xl font-bold mb-4">Your cart is empty</h2>
        <Link href="/gallery" className="text-blue-600 hover:underline">Go shopping</Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Link href={isTopup ? "/profile/billing" : "/cart"} className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> {isTopup ? 'Back to Billing' : 'Back to Cart'}
        </Link>

        <div className="flex flex-col lg:flex-row gap-12">

          <div className="flex-1 space-y-8">
            {isTopup ? (
              <>
                {/* TOPUP SELECTION */}
                <div className="bg-[#0f1115] p-6 sm:p-10 rounded-[40px] shadow-2xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full -mr-48 -mt-48 blur-[100px] opacity-50" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full -ml-32 -mb-32 blur-[80px] opacity-30" />

                  <h2 className="text-4xl font-black mb-2 relative z-10 text-white tracking-tight text-center">Add Funds</h2>
                  <p className="text-gray-400 font-bold mb-12 relative z-10 text-center text-sm">Empower your wallet for frictionless 3D shopping.</p>

                  {/* MARKETING FEATURES */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 relative z-10">
                    <div className="bg-white/5 border border-white/10 p-6 rounded-[28px] flex flex-col items-center text-center group hover:bg-white hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-default">
                      <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Zap size={28} />
                      </div>
                      <p className="font-black text-xs uppercase tracking-widest text-white group-hover:text-gray-900 mb-2 transition-colors">Pay Faster</p>
                      <p className="text-[10px] text-gray-400 group-hover:text-gray-500 font-bold leading-tight transition-colors">Skip card entry. Shop with a single click.</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-6 rounded-[28px] flex flex-col items-center text-center group hover:bg-white hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-default">
                      <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        <ShieldCheck size={28} />
                      </div>
                      <p className="font-black text-xs uppercase tracking-widest text-white group-hover:text-gray-900 mb-2 transition-colors">Secure</p>
                      <p className="text-[10px] text-gray-400 group-hover:text-gray-500 font-bold leading-tight transition-colors">Bank-grade encryption powered by Stripe.</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-6 rounded-[28px] flex flex-col items-center text-center group hover:bg-white hover:shadow-2xl hover:scale-105 transition-all duration-500 cursor-default">
                      <div className="w-14 h-14 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                        <TrendingUp size={28} />
                      </div>
                      <p className="font-black text-xs uppercase tracking-widest text-white group-hover:text-gray-900 mb-2 transition-colors">Instant</p>
                      <p className="text-[10px] text-gray-400 group-hover:text-gray-500 font-bold leading-tight transition-colors">Funds available in your wallet instantly.</p>
                    </div>
                  </div>

                  <div className="relative group max-w-xl mx-auto z-10">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-[32px] blur opacity-25 group-hover:opacity-60 transition duration-1000 animate-pulse"></div>
                    <div className="relative bg-[#1a1c22] border border-white/10 rounded-[28px] focus-within:border-blue-500 p-2 flex items-center transition-all">
                      <div className="pl-6 pr-4"><Wallet className="text-gray-500" size={36} /></div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] mb-1 block">Top-up amount</label>
                        <input
                          type="text"
                          value={topupAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                              setTopupAmount(val);
                            }
                          }}
                          className="w-full bg-transparent text-4xl font-black text-white focus:outline-none placeholder-gray-700"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="pr-8 text-white text-3xl font-black flex items-center gap-2">
                        {currency}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 text-white p-8 rounded-[32px] flex items-center justify-between gap-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -mr-32 -mt-32 blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="relative z-10 flex-1">
                    <h4 className="text-lg font-black uppercase tracking-tight mb-2">Skip checkout in the future</h4>
                    <p className="text-gray-400 text-xs font-semibold leading-relaxed">
                      Use your internal balance to buy 3D files and physical items without pulling out your card every time. It's the fastest way to get your items.
                    </p>
                  </div>
                  <div className="relative z-10 hidden md:block">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 hover:scale-110 transition-transform">
                      <Plus size={32} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
              <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                  {!hasShippable ? <ShieldCheck className="text-green-600" /> : <MapPin className="text-blue-600" />}
                  {!hasShippable ? 'Order Details' : 'Shipping Details'}
                </h2>
                <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Full Name"
                    required
                    title="Please fill out this field"
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                  />
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email"
                    type="email"
                    required
                    title="Please fill out this field"
                    onInvalid={(e) => {
                      const target = e.target as HTMLInputElement;
                      if (target.validity.valueMissing) {
                        target.setCustomValidity('Please fill out this field.');
                      } else if (target.validity.typeMismatch) {
                        target.setCustomValidity('Please enter a valid email address.');
                      }
                    }}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                  />
                  {hasShippable && (
                    <>
                      <input
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Phone"
                        required
                        title="Please fill out this field"
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                      />
                      <input
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Address"
                        required
                        title="Please fill out this field"
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          placeholder="City"
                          required
                          title="Please fill out this field"
                          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        />
                        <input
                          name="zip"
                          value={formData.zip}
                          onChange={handleInputChange}
                          placeholder="ZIP"
                          required
                          title="Please fill out this field"
                          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please fill out this field.')}
                          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold"
                        />
                      </div>
                      <select name="country" value={formData.country} onChange={handleInputChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold">
                        {DHL_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </>
                  )}
                </form>
              </div>

              {/* SHIPPING METHOD SELECTION */}
              {hasShippable && (
                <div className="bg-gradient-to-br from-[#0d1117] to-[#161b27] border border-indigo-500/15 rounded-[28px] p-5 sm:p-8 shadow-2xl shadow-black/45">
                  <h2 style={{ color: '#fff', fontWeight: 900, fontSize: '14px', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: 32, height: 32, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={16} style={{ color: '#fff' }} />
                    </span>
                    Delivery Method
                  </h2>
                  {stableShippingOptions.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#6b7280' }}>
                      <Loader2 className="animate-spin" size={18} />
                      <p style={{ fontSize: '13px', fontWeight: 700 }}>Calculating shipping options…</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const PICKUP_IDS = ['inpost_paczkomat', 'dpd_pickup', 'dhl_pop', 'orlen_paczka'];
                        const doorOptions   = stableShippingOptions.filter(o => !PICKUP_IDS.includes(o.id));
                        const pickupOptions = stableShippingOptions.filter(o =>  PICKUP_IDS.includes(o.id));

                        const renderCard = (option: ShippingOption) => {
                          const isSelected = selectedShipping?.id === option.id;
                          const accentColor =
                            option.carrier === 'InPost' ? '#22c55e' :
                            option.carrier === 'DPD'    ? '#ef4444' :
                            option.carrier === 'DHL'    ? '#eab308' :
                            option.carrier === 'Orlen'  ? '#f97316' : '#6366f1';
                          const accentBg =
                            option.carrier === 'InPost' ? 'rgba(34,197,94,0.08)' :
                            option.carrier === 'DPD'    ? 'rgba(239,68,68,0.08)' :
                            option.carrier === 'DHL'    ? 'rgba(234,179,8,0.08)' :
                            option.carrier === 'Orlen'  ? 'rgba(249,115,22,0.08)' : 'rgba(99,102,241,0.08)';
                          return (
                            <label
                              key={option.id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 18px',
                                borderRadius: '14px',
                                border: isSelected ? `2px solid ${accentColor}` : '2px solid rgba(255,255,255,0.05)',
                                background: isSelected ? accentBg : 'rgba(255,255,255,0.02)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? `0 0 20px ${accentColor}22` : 'none',
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <span style={{
                                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                                background: accentColor,
                                opacity: isSelected ? 1 : 0.22,
                                borderRadius: '14px 0 0 14px',
                                transition: 'opacity 0.2s'
                              }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 8 }}>
                                <input
                                  type="radio"
                                  name="shipping_method"
                                  checked={isSelected}
                                  onChange={() => setSelectedShipping(option)}
                                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor } as React.CSSProperties}
                                />
                                <div>
                                  <p style={{ color: '#fff', fontWeight: 900, fontSize: '13px', margin: 0 }}>
                                    <span style={{ marginRight: 6 }}>{option.icon}</span>
                                    {option.carrier} &mdash; {option.service}
                                  </p>
                                  <p style={{ color: '#6b7280', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '3px 0 0' }}>
                                    {option.description} &middot; {option.deliveryDays} business days
                                  </p>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ color: accentColor, fontWeight: 900, fontSize: '14px', margin: 0 }}>
                                  {currency === 'PLN' ? `${option.pricePln.toFixed(2)} PLN` : formatPrice(option.priceEur)}
                                </p>
                                {currency !== 'PLN' && (
                                  <p style={{ color: '#4b5563', fontSize: '10px', fontWeight: 700, margin: '2px 0 0' }}>{option.pricePln.toFixed(2)} PLN</p>
                                )}
                              </div>
                            </label>
                          );
                        };

                        return (
                          <>
                            {/* ══ DOOR-TO-DOOR SECTION ══ */}
                            {doorOptions.length > 0 && (
                              <div style={{
                                borderRadius: '18px',
                                border: '1px solid rgba(255,255,255,0.06)',
                                overflow: 'hidden',
                              }}>
                                {/* Section header */}
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 12,
                                  padding: '14px 18px',
                                  background: 'rgba(255,255,255,0.03)',
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                  <span style={{
                                    width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                                    background: 'rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <Truck size={14} style={{ color: '#9ca3af' }} />
                                  </span>
                                  <div>
                                    <p style={{ color: '#e5e7eb', fontWeight: 900, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                                      Door-to-Door Delivery
                                    </p>
                                    <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 600, margin: '2px 0 0' }}>
                                      Delivered straight to your address by a courier
                                    </p>
                                  </div>
                                </div>
                                {/* Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px' }}>
                                  {doorOptions.map(renderCard)}
                                </div>
                              </div>
                            )}

                            {/* ══ PICKUP POINTS SECTION ══ */}
                            {pickupOptions.length > 0 && (
                              <div style={{
                                borderRadius: '18px',
                                border: '1px solid rgba(99,102,241,0.2)',
                                overflow: 'hidden',
                              }}>
                                {/* Section header */}
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 12,
                                  padding: '14px 18px',
                                  background: 'rgba(99,102,241,0.07)',
                                  borderBottom: '1px solid rgba(99,102,241,0.15)',
                                }}>
                                  <span style={{
                                    width: 30, height: 30, borderRadius: '9px', flexShrink: 0,
                                    background: 'rgba(99,102,241,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <MapPin size={14} style={{ color: '#818cf8' }} />
                                  </span>
                                  <div>
                                    <p style={{ color: '#a5b4fc', fontWeight: 900, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
                                      Pickup Points
                                    </p>
                                    <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 600, margin: '2px 0 0' }}>
                                      Pick up your parcel at a locker or service point near you
                                    </p>
                                  </div>
                                </div>
                                {/* Cards */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px' }}>
                                  {pickupOptions.map(renderCard)}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* PICKUP POINT PANEL */}
                      {isPickupOption && (
                        <div className="mt-3 bg-gradient-to-br from-[#0a0f1e] to-[#111827] border border-indigo-500/25 rounded-[20px] p-4 sm:p-5 shadow-lg shadow-indigo-500/10">
                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{ color: '#818cf8', fontWeight: 900, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <MapPin size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                                {pickupLabels.title}
                              </h3>
                              {selectedPoint ? (
                                <div style={{
                                  marginTop: 12,
                                  background: 'rgba(99,102,241,0.08)',
                                  border: '1px solid rgba(99,102,241,0.2)',
                                  borderRadius: '14px',
                                  padding: '14px 16px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 4
                                }}>
                                  <p style={{ color: '#818cf8', fontWeight: 900, fontSize: '13px', margin: 0 }}>
                                    ✓ &nbsp;{selectedPoint.code}
                                  </p>
                                  <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '12px', margin: 0 }}>{selectedPoint.name}</p>
                                  <p style={{ color: '#6b7280', fontWeight: 600, fontSize: '11px', margin: 0 }}>{selectedPoint.street}, {selectedPoint.zip} {selectedPoint.city}</p>
                                </div>
                              ) : (
                                <p style={{ color: '#6b7280', fontWeight: 600, fontSize: '12px', margin: '8px 0 0' }}>
                                  {pickupLabels.placeholder}
                                </p>
                              )}
                              {showMapError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                  <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                                  <p style={{ color: '#ef4444', fontWeight: 800, fontSize: '11px', margin: 0 }}>
                                    {pickupLabels.error}
                                  </p>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={openFurgonetkaMap}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '11px 20px',
                                background: selectedPoint
                                  ? 'linear-gradient(135deg,#4f46e5,#7c3aed)'
                                  : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                                color: '#fff',
                                fontWeight: 900,
                                fontSize: '11px',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                border: 'none',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                              }}
                            >
                              <Zap size={13} />
                              {pickupLabels.button}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SIZE ESTIMATE BADGE */}
                      {selectedShipping && (
                        <div style={{
                          marginTop: 10,
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: 'rgba(34,197,94,0.06)',
                          border: '1px solid rgba(34,197,94,0.18)',
                          borderRadius: '12px',
                          padding: '10px 14px'
                        }}>
                          <CheckCircle2 size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
                          <p style={{ color: '#4ade80', fontWeight: 800, fontSize: '11px', margin: 0 }}>
                            Parcel size estimated from product dimensions + 5 cm safety margin
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                <Wallet className="text-blue-600" /> Payment Method
              </h2>
              <div className="space-y-3">
                <PaymentRadio
                  label="Credit / Debit Card"
                  value="stripe"
                  current={paymentMethod}
                  set={setPaymentMethod}
                  badge="Stripe Secure"
                />
                <PaymentRadio
                  label="Wallet Balance"
                  value="balance"
                  current={paymentMethod}
                  set={setPaymentMethod}
                  disabled={balance === null || balance < grandTotalEur}
                  badge={balance !== null ? formatPrice(balance) : 'Loading...'}
                />
                {!isTopup && balance !== null && balance < grandTotalEur && (
                  <p className="text-[10px] text-amber-600 font-black uppercase tracking-[0.15em] mt-3 flex items-center gap-1.5 px-2 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} /> Insufficient funds. <Link href="/checkout?type=topup" className="underline hover:text-amber-800 transition-colors">Top-up here</Link>
                  </p>
                )}
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex gap-4 items-center">
              <ShieldCheck className="text-blue-600" size={28} />
              <div>
                <p className="font-black text-blue-900 text-sm">Secure Payment</p>
                <p className="text-xs text-blue-700 font-medium">Your payment is encrypted and processed by Stripe.</p>
              </div>
            </div>
            </>
            )}
          </div>

          <div className="w-full lg:w-96">
            <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-2xl border border-gray-100 sticky top-8">
              <h3 className="text-lg font-black uppercase mb-8 flex items-center gap-2">
                {isTopup ? <Wallet className="text-blue-600" /> : <Package className="text-blue-600" />}
                {isTopup ? 'Wallet Summary' : 'Order Summary'}
              </h3>
              <div className="space-y-4 mb-10">
                {isTopup ? (
                  <>
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl">
                      <span className="text-xs font-bold text-gray-500">Current Balance</span>
                      <span className="font-black text-gray-900">{formatPrice(balance || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-blue-500/10 p-5 rounded-2xl border border-blue-500/20">
                      <span className="text-xs font-bold text-blue-400">Recharge Amount</span>
                      <span className="font-black text-blue-400">+{formatPrice(numericTopup, true)}</span>
                    </div>
                  </>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 flex items-center justify-center">
                          <Package className="text-gray-300" size={24} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 leading-tight mb-0.5 line-clamp-1">{item.title}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.quantity} × {formatPrice(item.price)}</p>
                          {item.category !== 'digital' && (() => {
                            const hasLayers = item.variant_layers && item.variant_layers.length > 1;
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {hasLayers ? (
                                  item.variant_layers!.map((layer, li) => (
                                    <span key={li} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight bg-purple-50 text-purple-700 px-1 py-0.5 rounded-sm">
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color_hex || '#ccc' }} />
                                      {layer.color_name}
                                    </span>
                                  ))
                                ) : (
                                  item.material && <span className="text-[9px] font-black uppercase text-purple-600 tracking-tighter bg-purple-50 px-1 rounded-sm">{item.material}</span>
                                )}
                                {item.weight && <span className="text-[9px] font-black uppercase text-amber-600 tracking-tighter bg-amber-50 px-1 rounded-sm">{item.weight}</span>}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <p className="text-sm font-black text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-8 border-t border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Subtotal</span>
                  <span className="font-black text-gray-900">{isTopup ? formatPrice(numericTopup, true) : formatPrice(cartTotalEur)}</span>
                </div>
                {!isTopup && hasShippable && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Shipping</span>
                    <div className="text-right">
                      <span className="font-black text-emerald-600">
                        {!selectedShipping ? 'Select method' : shippingEur === 0 ? 'FREE' : formatPrice(shippingEur ?? 0)}
                      </span>
                      {selectedShipping && (
                        <p className="text-[9px] text-gray-400 font-bold">{selectedShipping.carrier} {selectedShipping.service}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ---- FEES ---- */}
                {!isTopup && (
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-3">Platform Fees</p>

                    {/* 1% Printsi Tax */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">1%</span>
                        <span className="text-xs font-bold text-gray-600">Printsi Tax</span>
                      </div>
                      <span className="text-xs font-black text-gray-800">{formatPrice(printsiTaxEur)}</span>
                    </div>

                    {/* 2.5% Buyer Protection */}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">2.5%</span>
                        <span className="text-xs font-bold text-gray-600">Buyer Protection</span>
                      </div>
                      <span className="text-xs font-black text-gray-800">{formatPrice(buyerProtectionEur)}</span>
                    </div>

                    {/* 1.5% Currency Conversion — only for non-EUR */}
                    {isForeignCurrency && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">1.5%</span>
                          <span className="text-xs font-bold text-gray-600">Currency Conversion</span>
                        </div>
                        <span className="text-xs font-black text-gray-800">{formatPrice(currencyConversionEur)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-end pt-4">
                  <span className="text-sm font-black uppercase text-gray-900 tracking-tighter">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1">
                      {isTopup ? formatPrice(numericTopup, true) : formatPrice(grandTotalEur ?? 0)}
                    </p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Including all fees</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                form="checkout-form"
                onClick={(e) => { if (isTopup) handlePayment(e); }}
                disabled={loading || (!isTopup && hasShippable && stableShippingOptions.length > 0 && !selectedShipping)}
                className="w-full mt-10 py-5 bg-gray-900 text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-600 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    {paymentMethod === 'balance' ? <Wallet size={18} /> : <CreditCard size={18} />}
                    {isTopup ? 'Pay Now' : `Pay ${formatPrice(isTopup ? cartTotalEur : (grandTotalEur ?? 0))}`}
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-400 font-bold text-center mt-6 uppercase tracking-widest">
                {isTopup ? 'Instant funding upon success' : 'Secure payment guaranteed'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function PaymentRadio({ label, value, current, set, disabled, badge }: any) {
  return (
    <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${current === value ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="flex items-center gap-3">
        <input type="radio" checked={current === value} onChange={() => !disabled && set(value)} className="w-4 h-4 text-blue-600" />
        <span className="font-bold text-sm text-gray-900">{label}</span>
      </div>
      {badge && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{badge}</span>}
    </label>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}>
      <CheckoutInner />
      <Script src="https://furgonetka.pl/js/dist/map/map.js" strategy="lazyOnload" />
    </Suspense>
  );
}