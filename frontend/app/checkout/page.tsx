'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { 
  CreditCard, ArrowLeft, Loader2, MapPin, 
  ShieldCheck, Wallet, Package, Truck, 
  AlertCircle, DollarSign, Zap, TrendingUp, Plus 
} from 'lucide-react';
import Link from 'next/link';
import { DHL_COUNTRIES, calculateShippingPln, countryNameToCode, parseWeightToGrams } from '../lib/dhlRates';

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
  const [offerCategories, setOfferCategories] = useState<Record<string, string>>({}); 
  const [sellerCountries, setSellerCountries] = useState<Record<string, string>>({}); 

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zip: '',
    country: 'PL'
  });

  const shippingBreakdown = useMemo(() => {
    if (isTopup) return [];
    const sellerGroups: Record<string, typeof items> = {};
    items.forEach(item => {
      if (!sellerGroups[item.seller_id]) sellerGroups[item.seller_id] = [];
      sellerGroups[item.seller_id].push(item);
    });

    const breakdown: { sellerId: string; fromCode: string; toCode: string; weightGrams: number; costPln: number | null }[] = [];
    Object.entries(sellerGroups).forEach(([sellerId, sellerItems]) => {
      const shippableItems = sellerItems.filter(item => (offerCategories as any)[item.id] !== 'digital');
      if (shippableItems.length === 0) return; 
      const fromCode = (sellerCountries as any)[sellerId] || 'PL'; 
      const toCode = formData.country;
      const weightGrams = shippableItems.reduce((total, item) => {
        return total + (((offerWeights as any)[item.id] ?? 500) * item.quantity);
      }, 0);
      const costPln = calculateShippingPln(fromCode, toCode, weightGrams);
      breakdown.push({ sellerId, fromCode, toCode, weightGrams, costPln });
    });
    return breakdown;
  }, [items, isTopup, formData.country, offerCategories, sellerCountries, offerWeights]);

  const shippingPln = useMemo(() => {
    if (isTopup) return 0;
    const hasShippable = items.some(item => (offerCategories as any)[item.id] !== 'digital');
    if (!hasShippable) return 0;
    const allValid = shippingBreakdown.every(s => s.costPln !== null);
    if (!allValid || shippingBreakdown.length === 0) return null;
    return shippingBreakdown.reduce((sum, s) => sum + (s.costPln ?? 0), 0);
  }, [shippingBreakdown, items, offerCategories, isTopup]);

  const shippingEur = useMemo(() => {
    if (isTopup) return 0;
    if (shippingPln === null) return null;
    if (!rates || !rates['PLN']) return shippingPln / 4.25;
    return shippingPln / rates['PLN'];
  }, [shippingPln, rates, isTopup]);

  const grandTotalEur = cartTotalEur + (shippingEur ?? 0);

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
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isTopup && items.length === 0) return;
    if (shippingEur === null) { alert('Please select a valid shipping country.'); return; }
    
    setLoading(true);
    const currentRate = rates?.[currency] || 1;

    try {
      const body = isTopup 
        ? { userId: user.id, isTopup: true, topupAmount: numericTopup, email: formData.email, selectedCurrency: currency, exchangeRate: currentRate }
        : { userId: user.id, items, email: formData.email, selectedCurrency: currency, exchangeRate: currentRate, shippingCostEur: shippingEur || 0, shipping: (shippingEur ?? 0) > 0 ? { name: formData.fullName, address: { line1: formData.address, city: formData.city, postal_code: formData.zip, country: formData.country } } : undefined };

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else { alert('Error: ' + data.error); setLoading(false); }
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
                <div className="bg-[#0f1115] p-10 rounded-[40px] shadow-2xl border border-white/5 relative overflow-hidden">
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
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
                  {shippingPln === 0 ? <ShieldCheck className="text-green-600" /> : <MapPin className="text-blue-600" />}
                  {shippingPln === 0 ? 'Order Details' : 'Shipping Details'}
                </h2>
                <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                  <input name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Full Name" required title="Please fill out this field" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  <input name="email" value={formData.email} onChange={handleInputChange} placeholder="Email" type="email" required title="Please fill out this field" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                  {shippingPln !== 0 && (
                    <>
                      <input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone" required title="Please fill out this field" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                      <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Address" required title="Please fill out this field" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                      <div className="grid grid-cols-2 gap-4">
                        <input name="city" value={formData.city} onChange={handleInputChange} placeholder="City" required title="Please fill out this field" className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold" />
                        <input name="zip" value={formData.zip} onChange={handleInputChange} placeholder="ZIP" required title="Please fill out this field" className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold" />
                      </div>
                      <select name="country" value={formData.country} onChange={handleInputChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold">
                        {DHL_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </>
                  )}
                </form>
              </div>
            )}

            <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex gap-4 items-center">
              <ShieldCheck className="text-blue-600" size={28} />
              <div>
                <p className="font-black text-blue-900 text-sm">Secure Payment</p>
                <p className="text-xs text-blue-700 font-medium">Your payment is encrypted and processed by Stripe.</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-96">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-100 sticky top-8">
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
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{item.quantity} × {formatPrice(item.price)}</p>
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
                {!isTopup && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Shipping</span>
                    <span className="font-black text-emerald-600">{shippingEur === null ? 'Select delivery' : (shippingEur === 0 ? 'FREE' : formatPrice(shippingEur))}</span>
                  </div>
                )}
                <div className="flex justify-between items-end pt-4">
                  <span className="text-sm font-black uppercase text-gray-900 tracking-tighter">Total</span>
                  <div className="text-right">
                    <p className="text-3xl font-black text-gray-900 tracking-tight leading-none mb-1">
                      {isTopup ? formatPrice(numericTopup, true) : formatPrice(grandTotalEur ?? 0)}
                    </p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Including VAT</p>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                form="checkout-form"
                onClick={(e) => { if (isTopup) handlePayment(e); }}
                disabled={loading || (!isTopup && shippingEur === null)}
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
    </Suspense>
  );
}