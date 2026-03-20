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
  const { formatPrice, rates, currency } = useCurrency();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false); 
  const [sales, setSales] = useState<any[]>([]);
  const [balance, setBalance] = useState(0); // Base balance in EUR
  const [isStripeConnected, setIsStripeConnected] = useState(false);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);

  const fetchBalanceAndData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Fetch Stripe status
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const stripeRes = await fetch(`/api/stripe/status`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const stripeStatus = await stripeRes.json();
      if (stripeStatus.isConnected) {
        setIsStripeConnected(true);
      }
    } catch (err) {
      console.error("Error checking stripe status:", err);
    }

    // 2. Fetch sales history
    const { data: salesData } = await supabase
      .from('order_items')
      .select(`
        *,
        offers ( title, image_urls )
      `)
      .eq('seller_id', user.id)
      .eq('status', 'completed') // Only completed items are payoutable
      .order('created_at', { ascending: false });

    setSales(salesData || []);

    // 3. Fetch payouts history
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payoutRes = await fetch(`/api/billing/payouts`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const payoutData = await payoutRes.json();
      setPayouts(payoutData.payouts || []);
      
      // 4. Calculate balance (Total Sales - (Pending + Completed Payouts))
      // Assuming price_at_purchase is in base currency (EUR)
      const totalEarned = salesData?.reduce((acc, sale) => acc + (sale.price_at_purchase * (sale.quantity || 1)), 0) || 0;
      const totalPayouts = (payoutData.payouts || []).reduce((acc: number, p: any) => 
        (p.status === 'pending' || p.status === 'completed') ? acc + Number(p.amount) : acc, 
      0);

      setBalance(totalEarned - totalPayouts);
    } catch (err) {
      console.error("Error fetching payouts:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchBalanceAndData();
  }, [router, searchParams, currency]); // Refresh balance if currency changes

  const handleRequestPayout = async () => {
    // 1. Get raw input (amount in user's displayed currency)
    const rawInputAmt = parseFloat(withdrawAmount);
    if (!rawInputAmt || rawInputAmt <= 0) return alert("Please enter a valid amount.");

    // 2. Convert rawInputAmt back to base currency (EUR) for comparison and saving
    let amtInBase = rawInputAmt;
    if (currency !== 'EUR' && rates && rates[currency]) {
      amtInBase = rawInputAmt / rates[currency];
    }
    
    // Safety rounding to avoid float issues
    const finalAmtInBase = Math.round(amtInBase * 100) / 100;

    if (finalAmtInBase > balance) {
      return alert(`Amount exceeds your available balance.`);
    }
    if (!isStripeConnected) return alert("Please connect your bank account first.");

    setRequestingPayout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/billing/payouts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ amount: finalAmtInBase }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Success! Payout requested. Funds will be transferred within 3 days.");
        setWithdrawAmount('');
        fetchBalanceAndData();
      } else {
        if (data.error?.includes('payouts')) {
          alert("Database error: The 'payouts' table is missing. Please ensure you have run the migration.");
        } else {
          alert("Error: " + data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setRequestingPayout(false);
    }
  };

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
                   <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                      <input 
                        type="number" 
                        placeholder="Amount" 
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="bg-transparent border-none text-white placeholder-blue-200 font-bold w-32 focus:ring-0 outline-none"
                      />
                      <button 
                        onClick={handleRequestPayout}
                        disabled={requestingPayout || !withdrawAmount}
                        className="bg-white text-blue-700 px-6 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                      >
                         {requestingPayout ? <Loader2 className="animate-spin" size={18}/> : <DollarSign size={18} />} 
                         Withdraw
                      </button>
                   </div>
                ) : (
                   <button onClick={handleConnectStripe} className="bg-white text-blue-700 px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-md flex items-center gap-2">
                     {connecting ? <Loader2 className="animate-spin"/> : <DollarSign size={18} />} Connect Bank
                   </button>
                )}
              </div>
              <p className="text-blue-200 text-[10px] mt-4 font-bold uppercase tracking-wide">
                * Payouts are processed manually within 3 business days.
              </p>
            </div>
            
            <Wallet className="absolute -bottom-6 -right-6 text-white opacity-10 w-48 h-48" />
          </div>


          {/* PAYMENT METHODS */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col">
            <h3 className="font-black uppercase text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard size={20} className="text-gray-400"/> Payout Method
            </h3>
            
            {isStripeConnected ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4 border-2 border-green-100 bg-green-50 rounded-2xl p-6 mb-4 cursor-pointer hover:bg-green-100/50 transition-colors" onClick={() => alert("Payouts are handled via your connected Stripe account.")}>
                    <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center text-green-700">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">Stripe Connected</p>
                        <p className="text-xs text-gray-500">Funds will be sent to your bank account.</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* --- LEFT: PAYOUT HISTORY --- */}
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900 mb-6 flex items-center gap-2">
              <Wallet className="text-blue-600"/> Payout History
            </h3>

            {payouts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <p className="text-gray-500 font-medium text-sm">No payout requests yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-500">
                        <th className="p-4 font-black">Date</th>
                        <th className="p-4 font-black">Status</th>
                        <th className="p-4 font-black text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-xs font-bold text-gray-600">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                              p.status === 'completed' ? 'bg-green-100 text-green-700' :
                              p.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-gray-900 text-sm">
                            {formatPrice(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* --- RIGHT: RECENT EARNINGS --- */}
          <div>
            <h3 className="text-xl font-black uppercase text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="text-green-600"/> Completed Sales
            </h3>

            {sales.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
                <p className="text-gray-500 font-medium text-sm">No completed sales yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-500">
                        <th className="p-4 font-black">Item</th>
                        <th className="p-4 font-black text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-gray-900 text-xs truncate max-w-[150px]">{sale.offers?.title}</p>
                            <p className="text-[9px] text-gray-400 font-mono">{new Date(sale.created_at).toLocaleDateString()}</p>
                          </td>
                          <td className="p-4 text-right font-black text-green-600 text-sm">
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

      </div>
    </main>
  );
}