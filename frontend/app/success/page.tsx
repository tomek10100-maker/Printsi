'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight, MessageCircle, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const type = searchParams.get('type'); 
  const router = useRouter();

  const { clearCart, items } = useCart();
  const { formatPrice } = useCurrency();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paidDisplay, setPaidDisplay] = useState<{ amount: number, currency: string } | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const confirmed = useRef(false);

  const isTopup = type === 'topup';

  useEffect(() => {
    if (!sessionId) {
      if (isTopup) {
        setStatus('error');
        setErrorMessage('Session ID is missing.');
      } else {
        setStatus('done');
      }
      return;
    }

    if (sessionId === 'balance_pay') {
      clearCart();
      setStatus('done');
      return;
    }

    if (confirmed.current) return;
    confirmed.current = true;

    const finalizePayment = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        if (isTopup) {
          const response = await fetch('/api/stripe/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, sessionId }),
          });
          const data = await response.json();
          if (data.success) {
            setStatus('done');
            if (data.paidAmount) {
              setPaidDisplay({ amount: data.paidAmount, currency: data.paidCurrency });
            }
          } else {
            setErrorMessage(data.error);
            setStatus('error');
          }
          return;
        }

        // Standard Order
        const raw = typeof window !== 'undefined' ? localStorage.getItem('printis_cart') : null;
        const cartItems: any[] = raw ? JSON.parse(raw) : items;

        const response = await fetch('/api/stripe/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, items: cartItems, sessionId }),
        });

        const data = await response.json();
        if (data.success || data.orderId) {
          if (data.chatId) {
            setChatId(data.chatId);
          }
          clearCart();
          setStatus('done');
        } else {
          setErrorMessage(data.error || 'Failed to verify order.');
          setStatus('error');
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage('Check your connection.');
      }
    };

    finalizePayment();
  }, [sessionId, isTopup, router, clearCart, items]);

  if (status === 'loading') {
    return (
      <div className="max-w-md w-full bg-[#111218] rounded-[40px] p-12 text-center shadow-2xl border border-white/5">
        <Loader2 className="animate-spin mx-auto mb-6 text-blue-500" size={48} />
        <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Confirming Payment…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`max-w-md w-full rounded-[40px] p-12 text-center shadow-2xl border ${isTopup ? 'bg-[#111218] border-red-500/20' : 'bg-white border-red-100'}`}>
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <AlertCircle size={40} />
        </div>
        <h1 className={`text-2xl font-black uppercase mb-2 ${isTopup ? 'text-white' : 'text-gray-900'}`}>Verification Failed</h1>
        <p className="text-gray-500 text-sm mb-4 font-medium">We couldn't verify your payment. If funds were taken, please contact our support.</p>
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-8">
            <p className="text-red-500 text-xs font-bold font-mono break-all">{errorMessage}</p>
          </div>
        )}
        <Link href={isTopup ? "/profile/billing" : "/cart"} className={`block w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${isTopup ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
          Return to {isTopup ? "Billing" : "Cart"}
        </Link>
      </div>
    );
  }

  return (
    <div className={`max-w-md w-full rounded-[48px] p-12 text-center shadow-2xl border animate-in fade-in zoom-in duration-700 relative overflow-hidden ${isTopup ? 'bg-[#0a0a0c] border-white/10' : 'bg-white border-gray-100'}`}>
      <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl relative z-10 ${isTopup ? 'bg-blue-500/10 text-blue-400' : 'bg-green-100 text-green-600'}`}>
        {isTopup ? <Wallet size={54} strokeWidth={1.5} /> : <CheckCircle2 size={54} strokeWidth={2.5} />}
      </div>
      <h1 className={`text-3xl font-black uppercase tracking-tight mb-3 relative z-10 ${isTopup ? 'text-white' : 'text-gray-900'}`}>
        {isTopup ? 'Wallet Topped Up!' : 'Order Confirmed!'}
      </h1>
      
      {paidDisplay && (
        <p className="text-3xl font-black text-emerald-400 mb-6 drop-shadow-sm">
          +{new Intl.NumberFormat('en-US', { style: 'currency', currency: paidDisplay.currency }).format(paidDisplay.amount)}
        </p>
      )}

      <p className="text-gray-500 font-bold mb-10 text-sm leading-relaxed relative z-10">
        {isTopup ? 'Your payment was successful. Funds have been added. Let\'s get some prints!' : 'Your payment was successful. The seller has been notified and will process your order soon.'}
      </p>

      <div className="space-y-4 relative z-10">
        <Link href={isTopup ? "/profile/billing" : (chatId ? `/profile/messages?chat=${chatId}` : "/profile/messages")} className={`flex items-center justify-center gap-2 w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-95 ${isTopup ? 'bg-white text-gray-900 hover:bg-blue-600 hover:text-white' : 'bg-gray-900 text-white hover:bg-blue-600'}`}>
          {isTopup ? <CheckCircle size={18} /> : <MessageCircle size={18} />} {isTopup ? 'Back to Billing' : 'View Order Chat'}
        </Link>
        <Link href={isTopup ? "/gallery" : "/"} className={`flex items-center justify-center gap-2 w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${isTopup ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10' : 'bg-white text-gray-900 border-2 border-gray-100 hover:border-gray-300'}`}>
           {isTopup ? 'Explore Marketplace' : 'Back to Home'} <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#050507] flex items-center justify-center p-6 font-sans">
      <Suspense fallback={<div className="flex items-center gap-3 text-gray-400 font-black uppercase tracking-widest text-xs"><Loader2 className="animate-spin text-blue-600" size={40} /> Verifying…</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}