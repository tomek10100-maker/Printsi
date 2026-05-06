'use client';

import { Suspense, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard, Wallet, TrendingUp, DollarSign, ArrowLeft,
  Plus, History, Shield, Info, ArrowUpRight, ArrowDownLeft,
  Loader2, ExternalLink, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';
import { useTheme } from '../../../context/ThemeContext';
import BankConnect from '../../components/BankConnect';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { formatPrice } = useCurrency();
  const { theme } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  const [stats, setStats] = useState({ spent: 0, earned: 0, pendingEarned: 0, withdrawn: 0 });
  const [payoutAmount, setPayoutAmount] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    // Handle return_url from Stripe Connect onboarding
    if (searchParams?.get('connected') === 'true') {
      setMessage({ type: 'success', text: 'Stripe account connected successfully!' });
      // Clean up the URL quietly
      router.replace('/profile/billing', { scroll: false });
    }
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // Grab session token for bank-details API
    const { data: { session } } = await supabase.auth.getSession();
    setSessionToken(session?.access_token ?? null);

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(profileData);
    const [{ data: spentOrders }, { data: sales }, { data: payouts }] = await Promise.all([
      supabase.from('orders').select('total_amount, created_at, id, stripe_payment_intent_id').eq('buyer_id', user.id),
      supabase.from('order_items').select('price_at_purchase, quantity, status, created_at, id').eq('seller_id', user.id),
      supabase.from('payouts').select('*').eq('user_id', user.id)
    ]);
    // Only subtract orders from the wallet balance if they were paid using the balance
    let totalSpentFromBalance = spentOrders?.filter(o => o.stripe_payment_intent_id?.startsWith('balance_')).reduce((acc, o) => acc + o.total_amount, 0) || 0;

    let totalEarned = 0, pendingEarned = 0;

    // sum ALL payouts (positive withdrawals and negative topups)
    let totalPayoutsAmt = payouts?.filter(p => p.status === 'completed' || p.status === 'pending').reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    sales?.forEach(sale => {
      const amt = (sale.price_at_purchase * (sale.quantity || 1));
      if (sale.status === 'completed') totalEarned += amt;
      else if (sale.status !== 'cancelled') pendingEarned += amt;
    });

    setStats({
      spent: totalSpentFromBalance,
      earned: totalEarned,
      pendingEarned,
      withdrawn: totalPayoutsAmt
    });
    const unified: any[] = [];
    spentOrders?.forEach(o => unified.push({ id: o.id, type: 'spent', amount: o.total_amount, date: o.created_at, label: 'Purchase' }));
    sales?.forEach(s => unified.push({ id: s.id, type: 'earned', amount: s.price_at_purchase * (s.quantity || 1), date: s.created_at, label: 'Sale', status: s.status }));
    payouts?.forEach(p => unified.push({ id: p.id, type: 'payout', amount: p.amount, date: p.created_at, label: 'Payout', status: p.status }));
    setTransactions(unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);

    // Determine if seller using fresh data instead of stale state
    const isUserSeller = profileData?.roles?.includes('cad') || profileData?.roles?.includes('printer') || profileData?.roles?.includes('designer');

    // Check Stripe Status
    if (isUserSeller) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/stripe/status', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        const data = await res.json();
        setStripeConnected(data.isConnected);
      } catch (err) {
        console.error('Failed to check Stripe status:', err);
      } finally {
        setCheckingStripe(false);
      }
    } else {
      setCheckingStripe(false);
    }
  };

  const handleConnectStripe = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to get onboarding link');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayoutRequest = async () => {
    const amount = Number(payoutAmount);
    const balance = stats.earned - stats.spent - stats.withdrawn;
    if (!amount || amount <= 0) { setMessage({ type: 'error', text: 'Please enter a valid amount' }); return; }
    if (amount > balance) { setMessage({ type: 'error', text: 'Insufficient balance' }); return; }
    setIsProcessing(true);
    const { error } = await supabase.from('payouts').insert({ user_id: profile.id, amount, status: 'pending' });
    if (error) setMessage({ type: 'error', text: 'Request failed: ' + error.message });
    else { setMessage({ type: 'success', text: 'Payout request submitted!' }); setPayoutAmount(''); fetchData(); }
    setIsProcessing(false);
  };

  const netBalance = stats.earned - stats.spent - stats.withdrawn;
  const isSeller = profile?.roles?.includes('cad') || profile?.roles?.includes('printer');

  const getThemeStyles = () => {
    switch (theme) {
      case 'midnight': return {
        pageBg: 'bg-[#020617]',
        cardBg: 'bg-[#0f172a]',
        cardBorder: 'border-[#1e293b]',
        itemBg: 'bg-[#1e293b]/50',
        itemHover: 'hover:bg-[#1e293b]',
        textTitle: 'text-white',
        textMuted: 'text-[#94a3b8]',
        textBody: 'text-[#cbd5e1]',
        iconBg: 'bg-[#1e293b]/80',
        walletGradient: 'from-blue-600 to-indigo-600'
      };
      case 'black': return {
        pageBg: 'bg-[#000000]',
        cardBg: 'bg-[#111111]',
        cardBorder: 'border-white/10',
        itemBg: 'bg-white/[0.05]',
        itemHover: 'hover:bg-white/[0.1]',
        textTitle: 'text-white',
        textMuted: 'text-gray-400',
        textBody: 'text-gray-200',
        iconBg: 'bg-white/10',
        walletGradient: 'from-gray-800 to-black'
      };
      default: return {
        pageBg: 'bg-[#F8FAFC]',
        cardBg: 'bg-white',
        cardBorder: 'border-gray-100',
        itemBg: 'bg-gray-50',
        itemHover: 'hover:bg-white hover:shadow-md',
        textTitle: 'text-gray-900',
        textMuted: 'text-gray-500',
        textBody: 'text-gray-600',
        iconBg: 'bg-gray-50 shadow-inner',
        walletGradient: 'from-blue-500 to-blue-400'
      };
    }
  };

  const styles = getThemeStyles();

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${styles.pageBg}`}>
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-700 ${styles.pageBg}`}>
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-6">
            <Link href="/profile" className={`w-12 h-12 rounded-2xl flex items-center justify-center border hover:scale-110 transition-all ${theme !== 'white' ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-white border-gray-100 text-gray-400 hover:text-blue-600 shadow-sm'}`}>
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className={`text-4xl font-black tracking-tight ${styles.textTitle}`}>
                {isSeller ? 'Billing & Payouts' : 'My Wallet'}
              </h1>
              <p className={`${styles.textMuted} font-bold text-sm tracking-wide mt-1`}>
                {isSeller ? 'Manage your finances and track earnings' : 'Refill funds and track your spending'}
              </p>
            </div>
          </div>
          <Link href="/checkout?type=topup" className={`${theme !== 'white' ? 'bg-white text-black' : 'bg-black text-white'} px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-2 group`}>
            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> Add Funds
          </Link>
        </div>

        <div className={`grid gap-8 ${isSeller ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
          <div className={isSeller ? "lg:col-span-2 space-y-8" : "space-y-8"}>

            {/* STATS SECTION */}
            <div className={`grid gap-4 ${isSeller ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
              {/* PRIMARY BALANCE CARD */}
              <div className={`relative overflow-hidden p-6 sm:p-8 rounded-[40px] border ${styles.cardBorder} shadow-2xl flex flex-col justify-between h-64 transition-all duration-500 bg-gradient-to-br ${styles.walletGradient} group`}>
                <div className="absolute top-0 right-0 p-8 opacity-20 text-white">
                  <Wallet size={120} strokeWidth={1} />
                </div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white mb-6 border border-white/10 group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                  </div>
                  <p className="text-[11px] uppercase font-black tracking-[0.2em] mb-2 text-white/70">Available Balance</p>
                  <p className="text-xl sm:text-3xl md:text-lg lg:text-2xl xl:text-4xl font-black tracking-tighter text-white text-center break-words w-full leading-tight">{formatPrice(Math.max(0, netBalance))}</p>
                </div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/40 w-2/3" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-widest">Printis Digital Wallet</p>
                </div>
              </div>

              {isSeller && (
                <>
                  <StatCard styles={styles} icon={<TrendingUp size={24} />} label="Earned" value={formatPrice(stats.earned)} color="emerald" />
                  <StatCard styles={styles} icon={<DollarSign size={24} />} label="Pending" value={formatPrice(stats.pendingEarned)} color="orange" subtitle="On way" />
                </>
              )}
            </div>

            {/* TRANSACTION HISTORY */}
            <div className={`${styles.cardBg} rounded-[40px] p-10 border ${styles.cardBorder} shadow-2xl transition-all duration-700`}>
              <h2 className={`text-xl font-black uppercase tracking-tight mb-10 flex items-center gap-2 ${styles.textTitle}`}>
                <History size={20} className="text-blue-500" /> Transaction History
              </h2>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <div className={`text-center py-20 rounded-3xl border-2 border-dashed ${theme !== 'white' ? 'border-white/5 text-gray-600' : 'border-gray-100 text-gray-300'}`}>
                    <p className="font-bold uppercase tracking-widest text-xs">No transactions recorded</p>
                  </div>
                ) : transactions.map(tx => (
                  <div key={tx.id} className={`flex items-center justify-between p-6 border rounded-[28px] transition-all group ${styles.itemBg} ${styles.itemHover} ${styles.cardBorder}`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tx.type === 'earned' || (tx.type === 'payout' && tx.amount < 0) ? 'bg-emerald-500/10 text-emerald-400' :
                          tx.type === 'payout' ? 'bg-orange-500/10 text-orange-400' :
                            'bg-blue-500/10 text-blue-400'
                        }`}>
                        {tx.type === 'earned' ? <ArrowUpRight size={26} /> :
                          (tx.type === 'payout' && tx.amount < 0) ? <Wallet size={26} /> :
                            tx.type === 'payout' ? <ArrowDownLeft size={26} /> :
                              <CreditCard size={26} />}
                      </div>
                      <div>
                        <p className={`font-black text-base tracking-tight ${styles.textTitle}`}>
                          {tx.type === 'payout' && tx.amount < 0 ? 'Wallet Top-up' : tx.label}
                        </p>
                        <p className={`text-[11px] font-bold uppercase tracking-[0.15em] ${styles.textMuted}`}>{new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-xl ${tx.type === 'earned' || (tx.type === 'payout' && tx.amount < 0) ? 'text-emerald-400' :
                          tx.type === 'payout' ? 'text-orange-400' :
                            'text-blue-400'
                        }`}>
                        {tx.type === 'earned' || (tx.type === 'payout' && tx.amount < 0) ? '+' : '-'}{formatPrice(Math.abs(tx.amount))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SIDEBAR - ONLY FOR SELLERS */}
          {isSeller && (
            <div className="space-y-8">
              <div className={`${styles.cardBg} rounded-[40px] p-10 border ${styles.cardBorder} shadow-2xl relative overflow-hidden transition-all duration-700`}>
                <h3 className={`text-lg font-black mb-8 flex items-center gap-2 uppercase tracking-tight ${styles.textTitle}`}>
                  <ArrowUpRight className="text-blue-500" /> Payout
                </h3>

                {!stripeConnected ? (
                  <div className="space-y-5">
                    <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3 text-orange-400">
                        <AlertCircle size={20} />
                        <span className="text-xs font-black uppercase tracking-widest">Action Required</span>
                      </div>
                      <p className={`text-[10px] font-bold leading-relaxed uppercase tracking-wider ${styles.textMuted}`}>
                        To receive payouts, you must first connect your account with <span className="text-blue-500">Stripe Connect</span>. This is a one-time setup.
                      </p>
                      <button
                        onClick={handleConnectStripe}
                        disabled={isProcessing}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-600 hover:text-white transition-all shadow-xl flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="animate-spin" size={18} /> : (
                          <>Connect Stripe <ExternalLink size={14} /></>
                        )}
                      </button>
                    </div>

                    {/* Bank account accordion */}
                    <BankConnect
                      profile={profile}
                      sessionToken={sessionToken}
                      theme={theme}
                      onSaved={fetchData}
                    />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={16} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Stripe Active</span>
                      </div>
                    </div>
                    <div>
                      <label className={`text-[11px] uppercase font-black tracking-[0.2em] mb-2 block ${styles.textMuted}`}>Amount</label>
                      <input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} className={`w-full border-2 rounded-2xl py-5 px-6 font-black focus:border-blue-500 focus:outline-none transition-all ${theme !== 'white' ? 'bg-white/5 border-white/5 text-white placeholder-gray-800' : 'bg-gray-50 border-gray-100 text-gray-900'}`} placeholder="0.00" />
                    </div>
                    {message && (
                      <div className={`p-5 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <AlertCircle size={18} /><p className="text-xs font-bold leading-tight">{message.text}</p>
                      </div>
                    )}
                    <button onClick={handlePayoutRequest} disabled={isProcessing || !payoutAmount} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-900/10">
                      {isProcessing ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Process Payout'}
                    </button>

                    {/* Bank account accordion */}
                    <BankConnect
                      profile={profile}
                      sessionToken={sessionToken}
                      theme={theme}
                      onSaved={fetchData}
                    />
                  </div>
                )}
              </div>

              <div className={`${styles.cardBg} rounded-[40px] p-10 border ${styles.cardBorder} shadow-2xl transition-all duration-700`}>
                <h3 className={`text-lg font-black mb-8 flex items-center gap-2 uppercase tracking-tight ${styles.textTitle}`}>
                  <Shield className="text-blue-500" /> Security
                </h3>
                <p className={`text-[11px] mb-10 leading-relaxed font-bold uppercase tracking-[0.1em] ${styles.textMuted}`}>Guaranteed by Printis Escrow Protection System.</p>
                <div className={`p-6 rounded-3xl border flex items-center gap-4 ${styles.itemBg} ${styles.cardBorder}`}>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 shadow-inner">
                    <CheckCircle2 size={22} />
                  </div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${styles.textTitle}`}>Escrow Active</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ styles, icon, label, value, color, subtitle }: any) {
  const colorStyles: any = {
    blue: "bg-blue-500/10 text-blue-400 shadow-blue-500/5",
    emerald: "bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5",
    orange: "bg-orange-500/10 text-orange-400 shadow-orange-500/5"
  };

  return (
    <div className={`${styles.cardBg} p-8 rounded-[40px] border ${styles.cardBorder} shadow-2xl flex flex-col justify-between group h-full hover:scale-[1.02] transition-all duration-500`}>
      <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-10 shadow-lg ${colorStyles[color]}`}>{icon}</div>
      <div>
        <p className={`text-[11px] uppercase font-black tracking-[0.2em] mb-2 ${styles.textMuted}`}>{label}</p>
        <p className={`text-2xl sm:text-3xl font-black tracking-tighter ${styles.textTitle}`}>{value}</p>
        {subtitle && <p className={`text-[10px] font-bold mt-2 uppercase tracking-wide ${styles.textMuted}`}>{subtitle}</p>}
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#020617]"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}>
      <BillingContent />
    </Suspense>
  );
}
