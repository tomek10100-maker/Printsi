'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { CreditCard, ArrowLeft, Loader2, MapPin, ShieldCheck, Wallet, Package, Truck, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { DHL_COUNTRIES, calculateShippingPln, countryNameToCode, parseWeightToGrams } from '../lib/dhlRates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentMethod = searchParams.get('method') || 'stripe';

  const { currency, rates, formatPrice } = useCurrency();
  const cart = useCart();
  const items = cart?.items || [];

  const cartTotalEur = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [offerWeights, setOfferWeights] = useState<Record<string, number>>({}); // offerId -> grams
  const [sellerCountries, setSellerCountries] = useState<Record<string, string>>({}); // sellerId -> countryCode

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    zip: '',
    country: 'PL'
  });

  // Per-seller shipping breakdown
  const shippingBreakdown = useMemo(() => {
    // Group cart items by seller
    const sellerGroups: Record<string, typeof items> = {};
    items.forEach(item => {
      if (!sellerGroups[item.seller_id]) sellerGroups[item.seller_id] = [];
      sellerGroups[item.seller_id].push(item);
    });

    const breakdown: { sellerId: string; fromCode: string; toCode: string; weightGrams: number; costPln: number | null }[] = [];

    Object.entries(sellerGroups).forEach(([sellerId, sellerItems]) => {
      const fromCode = sellerCountries[sellerId] || 'PL'; // fallback to PL
      const toCode = formData.country;
      const weightGrams = sellerItems.reduce((total, item) => {
        return total + ((offerWeights[item.id] ?? 500) * item.quantity);
      }, 0);
      const costPln = calculateShippingPln(fromCode, toCode, weightGrams);
      breakdown.push({ sellerId, fromCode, toCode, weightGrams, costPln });
    });

    return breakdown;
  }, [items, sellerCountries, formData.country, offerWeights]);

  const totalWeightGrams = useMemo(() =>
    items.reduce((total, item) => total + ((offerWeights[item.id] ?? 500) * item.quantity), 0)
    , [items, offerWeights]);

  const shippingPln = useMemo(() => {
    const allValid = shippingBreakdown.every(s => s.costPln !== null);
    if (!allValid || shippingBreakdown.length === 0) return null;
    return shippingBreakdown.reduce((sum, s) => sum + (s.costPln ?? 0), 0);
  }, [shippingBreakdown]);

  const shippingEur = useMemo(() => {
    if (shippingPln === null) return null;
    if (!rates || !rates['PLN']) return shippingPln / 4.25;
    return shippingPln / rates['PLN'];
  }, [shippingPln, rates]);

  const grandTotalEur = cartTotalEur + (shippingEur ?? 0);
  const selectedDhlCountry = DHL_COUNTRIES.find(c => c.code === formData.country);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFormData({
          fullName: profile.full_name || '',
          email: user.email || '',
          address: profile.address || '',
          city: profile.city || '',
          zip: profile.zip_code || '',
          country: profile.country === 'Poland' ? 'PL' : (profile.country || 'PL')
        });
      } else {
        setFormData(prev => ({ ...prev, email: user.email || '' }));
      }

      // Fetch offer weights from Supabase
      if (items.length > 0) {
        const offerIds = items.map(i => i.id);
        const { data: offers } = await supabase
          .from('offers')
          .select('id, weight')
          .in('id', offerIds);

        if (offers) {
          const weightMap: Record<string, number> = {};
          offers.forEach(offer => {
            weightMap[offer.id] = parseWeightToGrams(offer.weight);
          });
          setOfferWeights(weightMap);
        }

        // Fetch each seller's ship-from country
        const uniqueSellerIds = [...new Set(items.map(i => i.seller_id))].filter(Boolean);
        if (uniqueSellerIds.length > 0) {
          const { data: sellerProfiles } = await supabase
            .from('profiles')
            .select('id, country')
            .in('id', uniqueSellerIds);

          if (sellerProfiles) {
            const countryMap: Record<string, string> = {};
            sellerProfiles.forEach(p => {
              // Convert full country name (e.g. 'Germany') to code (e.g. 'DE')
              countryMap[p.id] = countryNameToCode(p.country) || 'PL';
            });
            setSellerCountries(countryMap);
          }
        }
      }

      setFetchingProfile(false);
    };
    fetchUserData();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0) return;
    if (shippingEur === null) {
      alert('Please select a valid shipping country.');
      return;
    }
    setLoading(true);

    const currentRate = rates?.[currency] || 1;

    if (paymentMethod === 'balance') {
      try {
        const response = await fetch('/api/balance/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            items,
            email: formData.email,
            shipping: formData,
            shippingCostEur: shippingEur,
          }),
        });
        const data = await response.json();
        if (data.success) {
          window.location.href = '/success?session_id=balance_pay';
        } else {
          alert('Payment Error: ' + (data.error || 'Unknown error'));
          setLoading(false);
        }
      } catch (error) {
        alert('Could not process balance payment.');
        setLoading(false);
      }
      return;
    }

    // Stripe payment
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          items,
          email: formData.email,
          selectedCurrency: currency,
          exchangeRate: currentRate,
          shippingCostEur: shippingEur,
          shippingLabel: `DHL to ${selectedDhlCountry?.name} (${selectedDhlCountry?.deliveryDays} business days)`,
          shipping: {
            name: formData.fullName,
            address: {
              line1: formData.address,
              city: formData.city,
              postal_code: formData.zip,
              country: formData.country,
            }
          }
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Payment Error: ' + (data.error || 'Unknown error'));
        setLoading(false);
      }
    } catch (error) {
      alert('Could not connect to payment server.');
      setLoading(false);
    }
  };

  if (items.length === 0 && !loading && !fetchingProfile) {
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
        <Link href="/cart" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Cart
        </Link>

        <div className="flex flex-col lg:flex-row gap-12">

          {/* LEFT: SHIPPING DETAILS */}
          <div className="flex-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                <MapPin className="text-blue-600" /> Shipping Details
              </h2>

              {fetchingProfile ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400" /></div>
              ) : (
                <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                  <input name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Full Name" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  <input name="email" value={formData.email} onChange={handleInputChange} placeholder="Email Address" type="email" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Street Address" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  <div className="grid grid-cols-2 gap-4">
                    <input name="city" value={formData.city} onChange={handleInputChange} placeholder="City" required className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                    <input name="zip" value={formData.zip} onChange={handleInputChange} placeholder="ZIP Code" required className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  </div>

                  {/* DHL Country Selector */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1 block">
                      Destination Country (DHL Supported)
                    </label>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900"
                    >
                      {DHL_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.deliveryDays} business days)
                        </option>
                      ))}
                    </select>
                  </div>
                </form>
              )}
            </div>

            {/* DHL INFO CARD */}
            {selectedDhlCountry && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex gap-3">
                <Truck className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-black text-yellow-800 text-sm">DHL Parcel Connect</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Delivery to <strong>{selectedDhlCountry.name}</strong> in {selectedDhlCountry.deliveryDays} business days.
                    Total parcel weight: <strong>{(totalWeightGrams / 1000).toFixed(2)} kg</strong>
                    {totalWeightGrams > 31000 && (
                      <span className="text-red-600 font-bold"> ⚠️ Exceeds 31kg DHL limit!</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: ORDER SUMMARY */}
          <div className="w-full lg:w-96">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 sticky top-8">
              <h3 className="text-lg font-black uppercase mb-6">Order Summary</h3>

              {/* Items */}
              <div className="space-y-2 mb-4 text-sm">
                {items.map((item, i) => (
                  <div key={i} className="flex justify-between text-gray-600 text-xs font-bold">
                    <span>{item.title} (x{item.quantity})</span>
                    <span className="text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="h-px bg-gray-100 my-3" />

              {/* Subtotal */}
              <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotalEur)}</span>
              </div>

              {/* Shipping */}
              <div className="flex justify-between text-sm font-bold mb-3">
                <span className="flex items-center gap-1 text-gray-600">
                  <Truck size={14} /> DHL Shipping
                </span>
                {shippingEur !== null ? (
                  <span className="text-blue-600">{formatPrice(shippingEur)}</span>
                ) : (
                  <span className="text-red-500 text-xs">Not available</span>
                )}
              </div>

              {/* Total shipping weight */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-xs text-gray-500 font-medium flex items-center gap-2">
                <Package size={14} />
                Total weight: <strong className="text-gray-900">{(totalWeightGrams / 1000).toFixed(2)} kg</strong>
                {shippingPln !== null && (
                  <span className="ml-auto text-gray-400">{shippingPln.toFixed(2)} PLN</span>
                )}
              </div>

              <div className="h-px bg-gray-100 my-3" />

              {/* Grand Total */}
              <div className="flex justify-between font-black text-xl text-gray-900 mb-6">
                <span>Total</span>
                <span className={paymentMethod === 'balance' ? 'text-green-600' : 'text-blue-600'}>
                  {formatPrice(grandTotalEur)}
                </span>
              </div>

              {/* Payment method info */}
              {paymentMethod === 'balance' ? (
                <div className="bg-green-50 p-4 rounded-xl mb-6 flex items-start gap-3 border border-green-100">
                  <Wallet className="text-green-600 flex-shrink-0" size={20} />
                  <p className="text-xs text-green-800 font-medium">
                    Paying with <strong>Printsi Balance</strong>. Funds will be deducted from your account.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 p-4 rounded-xl mb-6 flex items-start gap-3">
                  <ShieldCheck className="text-blue-600 flex-shrink-0" size={20} />
                  <p className="text-xs text-blue-800 font-medium">
                    Secure checkout by Stripe. Pay in <strong>{currency}</strong>.
                  </p>
                </div>
              )}

              {/* Warning if shipping not available */}
              {shippingEur === null && (
                <div className="bg-red-50 p-3 rounded-xl mb-4 flex items-center gap-2 border border-red-100">
                  <AlertCircle size={16} className="text-red-500" />
                  <p className="text-xs text-red-600 font-bold">
                    DHL does not ship to the selected country or parcel exceeds 31kg.
                  </p>
                </div>
              )}

              <button
                type="submit"
                form="checkout-form"
                disabled={loading || shippingEur === null || fetchingProfile}
                className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex justify-center items-center gap-2 ${loading || shippingEur === null
                  ? 'bg-gray-300 cursor-not-allowed'
                  : paymentMethod === 'balance'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-900 hover:bg-blue-600'
                  }`}
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    {paymentMethod === 'balance' ? <Wallet size={18} /> : <CreditCard size={18} />}
                    Pay {formatPrice(grandTotalEur)}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}