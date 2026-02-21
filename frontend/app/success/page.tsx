'use client';

import React, { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';
// Importujemy useCart (ścieżka ../../ wychodzi z 'success' i 'app' do folderu głównego)
import { useCart } from '../../context/CartContext'; 

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const router = useRouter();
  
  // Pobieramy clearCart oraz items (żeby sprawdzić czy koszyk jest pełny)
  const { clearCart, items } = useCart(); 

  useEffect(() => {
    // ZABEZPIECZENIE: Jeśli ktoś wejdzie tu bez płacenia (brak session_id), wyrzuć go na główną
    if (!sessionId) {
       router.push('/');
       return;
    }

    // NAPRAWA PĘTLI: Czyścimy koszyk TYLKO jeśli faktycznie coś w nim jest.
    // Dzięki temu, po wyczyszczeniu (items.length = 0), useEffect nie odpali się ponownie.
    if (items.length > 0) {
        console.log("✅ Płatność udana - czyszczę koszyk...");
        clearCart();
    }
  }, [sessionId, items.length, clearCart, router]);

  return (
    <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-500">
      
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-lg shadow-green-100 animate-bounce">
        <CheckCircle size={48} strokeWidth={3} />
      </div>

      <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 mb-2">Payment Successful!</h1>
      <p className="text-gray-500 font-medium mb-8">
        Thank you for your purchase. Your payment has been processed securely by Stripe.
      </p>

      <div className="bg-gray-50 p-4 rounded-xl mb-8 border border-gray-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Transaction Reference</p>
        <p className="text-xs font-mono text-gray-600 break-all">{sessionId || 'Processing...'}</p>
      </div>

      <div className="space-y-3">
        <Link href="/profile/orders" className="flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg">
            <ShoppingBag size={18} /> View My Orders
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
      <Suspense fallback={<div className="flex items-center gap-2"><Loader2 className="animate-spin"/> Verifying payment...</div>}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}