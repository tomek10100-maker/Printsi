'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, AlertCircle, X, LifeBuoy } from 'lucide-react';

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function GlobalToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    let idCounter = 0;
    const originalAlert = window.alert;
    
    window.alert = (message: any) => {
      let msgStr = String(message);
      
      // Smart filter for Stripe messages
      if (msgStr.toLowerCase().includes("add up to at least")) {
        const match = msgStr.match(/\d+[\.,]\d+\s*(zł|pln|eur|usd|gbp)/i);
        if (match) {
          msgStr = `Minimum deposit amount is ${match[0].toUpperCase()}`;
        } else {
          msgStr = "The amount is below the minimum allowed.";
        }
      }

      // Detect type
      let type: 'success' | 'error' | 'info' = 'info';
      const msgLower = msgStr.toLowerCase();
      
      if (msgLower.includes('success') || msgStr.includes('✅')) type = 'success';
      if (msgLower.includes('error') || msgLower.includes('failed') || msgStr.includes('❌') || msgLower.includes('lacks') || msgLower.includes('missing')) type = 'error';

      const cleanMsg = msgStr.replace(/✅|❌/g, '').replace(/^Error:\s*/i, '').trim();
      const newId = ++idCounter;
      
      setToasts(prev => [...prev, { message: cleanMsg, type, id: newId }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newId));
      }, 6000);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100000] flex flex-col gap-4 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`group flex items-center gap-5 px-8 py-5 w-[90vw] max-w-sm sm:max-w-md rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border backdrop-blur-3xl transition-all duration-500 pointer-events-auto
            animate-in slide-in-from-top-12 fade-in zoom-in-90
            ${toast.type === 'success' ? 'bg-[#0f1115]/90 border-emerald-500/30 text-emerald-50' : ''}
            ${toast.type === 'error' ? 'bg-[#120a0a]/90 border-red-500/30 text-red-50' : ''}
            ${toast.type === 'info' ? 'bg-[#0a0c12]/90 border-blue-500/30 text-blue-50' : ''}
          `}
        >
          <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500
            ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : ''}
            ${toast.type === 'error' ? 'bg-red-500/10 text-red-400' : ''}
            ${toast.type === 'info' ? 'bg-blue-500/10 text-blue-400' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle size={28} strokeWidth={1.5} />}
            {toast.type === 'error' && <XCircle size={28} strokeWidth={1.5} />}
            {toast.type === 'info' && <AlertCircle size={28} strokeWidth={1.5} />}
          </div>
          
          <div className="flex-1 flex flex-col">
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1.5
              ${toast.type === 'success' ? 'text-emerald-500/60' : ''}
              ${toast.type === 'error' ? 'text-red-500/60' : ''}
              ${toast.type === 'info' ? 'text-blue-500/60' : ''}
            `}>
              {toast.type === 'success' && 'Confirmed'}
              {toast.type === 'error' && 'Payment Error'}
              {toast.type === 'info' && 'Notification'}
            </span>
            <span className="font-bold text-[13px] leading-tight tracking-tight max-h-32 overflow-y-auto whitespace-pre-wrap pr-2">
              {toast.message}
            </span>
            {toast.message.toLowerCase().includes('support') && (
              <Link
                href="/support"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider transition-all w-fit shadow-lg shadow-blue-600/30 active:scale-95 pointer-events-auto"
              >
                <LifeBuoy size={12} /> Contact Support &rarr;
              </Link>
            )}
          </div>

          <button 
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors opacity-50 hover:opacity-100"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
