'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '../../context/CartContext'; 
import { useCurrency } from '../../context/CurrencyContext'; 
import { Lock, CreditCard, ArrowLeft, Loader2, MapPin, ShieldCheck, Wallet } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Pobieramy metodę płatności wybraną w koszyku (domyślnie stripe)
  const paymentMethod = searchParams.get('method') || 'stripe';
  
  const { currency, rates, formatPrice } = useCurrency();
  
  const cart = useCart(); 
  const items = cart?.items || [];
  
  // Obliczamy sumę zamówienia w bazowej walucie (EUR)
  const cartTotalEur = items.reduce((total, item) => total + (item.price * item.quantity), 0);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    zip: '',
    country: 'PL'
  });

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
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
          country: profile.country || 'PL'
        });
      } else {
        setFormData(prev => ({ ...prev, email: user.email || '' }));
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
    setLoading(true);

    // Bezpieczne pobranie kursu (rozwiązuje błąd 'rates is possibly null')
    const currentRate = rates?.[currency] || 1;

    // --- OPCJA 1: PŁATNOŚĆ SALDEM (BALANCE) ---
    if (paymentMethod === 'balance') {
      try {
        const response = await fetch('/api/balance/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            items: items,
            email: formData.email,
            shipping: formData
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
        console.error("Balance payment error:", error);
        alert("Could not process balance payment.");
        setLoading(false);
      }
      return; 
    }

    // --- OPCJA 2: PŁATNOŚĆ STRIPE ---
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, // Przesyłamy ID użytkownika dla Webhooka
          items: items,
          email: formData.email,
          selectedCurrency: currency, 
          exchangeRate: currentRate,
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
      console.error("Payment connection error:", error);
      alert("Could not connect to payment server.");
      setLoading(false);
    }
  };

  if (items.length === 0 && !loading && !fetchingProfile) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <h2 className="text-xl font-bold mb-4">Your cart is empty</h2>
            <Link href="/gallery" className="text-blue-600 hover:underline">Go shopping</Link>
        </div>
     )
  }

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Link href="/cart" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Cart
        </Link>

        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* LEWA STRONA: DANE DO WYSYŁKI */}
          <div className="flex-1 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
              <MapPin className="text-blue-600" /> Shipping Details
            </h2>
            
            {fetchingProfile ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-400"/></div>
            ) : (
                <form id="checkout-form" onSubmit={handlePayment} className="space-y-4">
                   <input name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="Full Name" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                   <input name="email" value={formData.email} onChange={handleInputChange} placeholder="Email Address" type="email" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                   <input name="address" value={formData.address} onChange={handleInputChange} placeholder="Street Address" required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                   <div className="grid grid-cols-2 gap-4">
                     <input name="city" value={formData.city} onChange={handleInputChange} placeholder="City" required className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                     <input name="zip" value={formData.zip} onChange={handleInputChange} placeholder="ZIP Code" required className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900" />
                   </div>
                   
                   <select name="country" value={formData.country} onChange={handleInputChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-900">
                      <option value="PL">Poland</option>
                      <option value="DE">Germany</option>
                      <option value="US">USA</option>
                      <option value="GB">United Kingdom</option>
                      <option value="FR">France</option>
                   </select>
                </form>
            )}
          </div>

          {/* PRAWA STRONA: PODSUMOWANIE ZAMÓWIENIA */}
          <div className="w-full lg:w-96">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 sticky top-8">
              <h3 className="text-lg font-black uppercase mb-6">Order Summary</h3>
              
              <div className="space-y-3 mb-8 text-sm">
                 {items.map((item, i) => (
                    <div key={i} className="flex justify-between text-gray-600 text-xs font-bold">
                      <span>{item.title} (x{item.quantity})</span>
                      <span className="text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                 ))}
                 <div className="h-px bg-gray-100 my-2"></div>
                 <div className="flex justify-between font-black text-xl text-gray-900">
                    <span>Total ({currency})</span>
                    <span className={paymentMethod === 'balance' ? "text-green-600" : "text-blue-600"}>
                      {formatPrice(cartTotalEur)}
                    </span>
                 </div>
              </div>
              
              {/* STATUS METODY PŁATNOŚCI */}
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

              <button 
                type="submit" 
                form="checkout-form" 
                disabled={loading} 
                className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex justify-center items-center gap-2 ${
                  paymentMethod === 'balance' 
                    ? 'bg-green-600 hover:bg-green-700 hover:shadow-green-600/20' 
                    : 'bg-gray-900 hover:bg-blue-600'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    {paymentMethod === 'balance' ? <Wallet size={18}/> : <CreditCard size={18}/>}
                    Pay {formatPrice(cartTotalEur)}
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