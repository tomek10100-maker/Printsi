'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, CreditCard, DollarSign, 
  Loader2, Plus, TrendingUp, Wallet, Clock, CheckCircle
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const { formatPrice } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false); 
  const [sales, setSales] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [isStripeConnected, setIsStripeConnected] = useState(false);

  useEffect(() => {
    // Check if we returned from Stripe successfully
    if (searchParams.get('connected') === 'true') {
      console.log('Stripe connected successfully!');
    }

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Check if user has a connected Stripe account
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.stripe_account_id) {
        setIsStripeConnected(true);
      }

      // 2. Fetch sales history
      const { data: salesData } = await supabase
        .from('order_items')
        .select(`
          *,
          offers ( title, image_urls )
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setSales(salesData || []);

      // 3. Calculate balance
      const totalEarned = salesData?.reduce((acc, sale) => acc + (sale.price_at_purchase * (sale.quantity || 1)), 0) || 0;
      setBalance(totalEarned);

      setLoading(false);
    };

    fetchData();
  }, [router, searchParams]);

  // --- CONNECT TO STRIPE FUNCTION ---
  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect user to Stripe onboarding
        window.location.href = data.url;
      } else {
        alert('Something went wrong connecting to Stripe: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(error);
      alert('Network error connecting to payment provider.');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/profile" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold uppercase text-xs tracking-widest mb-6">
            <ArrowLeft size={16} /> Back to Profile
          </Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Billing & Payouts</h1>
              <p className="text-gray-500 font-medium mt-2">Manage your earnings, withdrawals, and payment methods.</p>
            </div>
            
            {/* Connection status badge */}
            {isStripeConnected && (
               <div className="px-5 py-3 bg-green-100 text-green-700 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm border border-green-200">
                  <CheckCircle size={18} /> Stripe Connected
               </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* --- SECTION 1: BALANCE & ACTIONS --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* AVAILABLE BALANCE */}
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-200 font-bold uppercase tracking-widest text-xs mb-2">Available for Payout</p>
              <h2 className="text-5xl font-black mb-6">{formatPrice(balance)}</h2>
              
              <div className="flex flex-wrap gap-4">
                {isStripeConnected ? (
                   <button onClick={() => alert("Payouts are handled automatically by Stripe!")} className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-md flex items-center gap-2">
                     <DollarSign size={18} /> Stripe Dashboard
                   </button>
                ) : (
                   <button onClick={handleConnectStripe} className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-md flex items-center gap-2">
                     {connecting ? <Loader2 className="animate-spin"/> : <DollarSign size={18} />} Connect Bank
                   </button>
                )}
              </div>
            </div>
            
            <Wallet className="absolute -bottom-6 -right-6 text-white opacity-10 w-48 h-48" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
          </div>

          {/* PAYMENT METHODS */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col">
            <h3 className="font-black uppercase text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard size={20} className="text-gray-400"/> Payout Method
            </h3>
            
            {isStripeConnected ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4 border-2 border-green-100 bg-green-50 rounded-2xl p-6 mb-4">
                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center text-green-700">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Bank Connected</p>
                        <p className="text-xs text-gray-500">Payouts are handled securely by Stripe.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4 border-2 border-dashed border-gray-200 rounded-2xl p-6 mb-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">No method added</p>
                        <p className="text-xs text-gray-500">Add a bank account to receive payouts.</p>
                    </div>
                </div>
            )}

            {!isStripeConnected && (
                <button 
                  onClick={handleConnectStripe}
                  disabled={connecting}
                  className="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                >
                  {connecting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} 
                  {connecting ? 'Connecting...' : 'Add Method'}
                </button>
            )}
          </div>
        </div>

        {/* --- SECTION 2: RECENT TRANSACTIONS (EARNINGS) --- */}
        <div>
          <h3 className="text-xl font-black uppercase text-gray-900 mb-6 flex items-center gap-2">
            <TrendingUp className="text-green-600"/> Recent Earnings
          </h3>

          {sales.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Clock size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No earnings yet</h3>
              <p className="text-gray-500 mt-2 text-sm">Once you sell an item, it will appear here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-widest text-gray-500">
                      <th className="p-6 font-black">Item</th>
                      <th className="p-6 font-black">Date</th>
                      <th className="p-6 font-black">Status</th>
                      <th className="p-6 font-black text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                               {sale.offers?.image_urls?.[0] && (
                                 <img src={sale.offers.image_urls[0]} alt="" className="w-full h-full object-cover" />
                               )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                                {sale.offers?.title || 'Unknown Item'}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">ID: {sale.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 text-sm font-medium text-gray-500">
                          {new Date(sale.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-6">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-green-100 text-green-700">
                            <CheckCircle size={12} /> Paid
                          </span>
                        </td>
                        <td className="p-6 text-right font-black text-gray-900">
                          +{formatPrice(sale.price_at_purchase * (sale.quantity || 1))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}