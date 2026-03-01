'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight, MessageCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '../../context/CartContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const router = useRouter();

  const { clearCart, items } = useCart();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [orderId, setOrderId] = useState<string | null>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    // Balance payments are already fully processed on the server.
    // We just clear the cart and show success.
    if (sessionId === 'balance_pay') {
      clearCart();
      setStatus('done');
      return;
    }

    // For Stripe payments – we need to create the order + chat on the client side
    // because our local webhook cannot be reached by Stripe.
    if (confirmed.current) return;
    confirmed.current = true;

    const processStripeOrder = async () => {
      try {
        // 1. Get logged-in user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        // 2. Read cart from localStorage (it's still there before clearCart)
        const raw = typeof window !== 'undefined' ? localStorage.getItem('printsi_cart') : null;
        const cartItems: any[] = raw ? JSON.parse(raw) : items;

        if (!cartItems || cartItems.length === 0) {
          // Cart already cleared – nothing to process (e.g. page refresh)
          setStatus('done');
          return;
        }

        const cartTotalEur = cartItems.reduce(
          (total: number, item: any) => total + (item.price * item.quantity), 0
        );

        const shippingRaw = typeof window !== 'undefined' ? localStorage.getItem('printsi_checkout_shipping') : null;
        const shippingCostEur = typeof window !== 'undefined'
          ? parseFloat(localStorage.getItem('printsi_checkout_shipping_eur') || '0')
          : 0;
        const orderTotalEur = cartTotalEur + (shippingCostEur || 0);

        // 3. Create order record in database
        const { createClient: createServiceClient } = await import('@supabase/supabase-js');
        const response = await fetch('/api/stripe/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            items: cartItems,
            sessionId,
            totalEur: orderTotalEur,
            shippingCostEur,
          }),
        });

        const data = await response.json();
        if (data.orderId) {
          setOrderId(data.orderId);
        }

        // 4. Clear cart
        clearCart();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('printsi_checkout_shipping');
          localStorage.removeItem('printsi_checkout_shipping_eur');
        }

        setStatus('done');
      } catch (err) {
        console.error('❌ Error confirming Stripe order:', err);
        // Still clear cart and show success – payment went through
        clearCart();
        setStatus('done');
      }
    };

    processStripeOrder();
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl border border-gray-100">
        <Loader2 className="animate-spin mx-auto mb-4 text-gray-400" size={40} />
        <p className="text-gray-500 font-medium">Confirming your order…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-500">

      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-lg shadow-green-100 animate-bounce">
        <CheckCircle size={48} strokeWidth={3} />
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 mb-2">Order Confirmed!</h1>
      <p className="text-gray-500 font-medium mb-8">
        Your payment was successful. The seller has been notified and a chat has been opened for updates.
      </p>

      {sessionId && sessionId !== 'balance_pay' && (
        <div className="bg-gray-50 p-4 rounded-xl mb-8 border border-gray-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Transaction Reference</p>
          <p className="text-xs font-mono text-gray-600 break-all">{sessionId}</p>
        </div>
      )}

      <div className="space-y-3">
        <Link href="/profile/messages" className="flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg">
          <MessageCircle size={18} /> View Order Chat
        </Link>
        <Link href="/" className="flex items-center justify-center gap-2 w-full py-4 bg-white text-gray-900 border-2 border-gray-100 rounded-xl font-black uppercase tracking-widest hover:border-gray-300 transition-all">
          Back to Home <ArrowRight size={18} />
        </Link>
      </div>

    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <Suspense fallback={<div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Verifying payment…</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}