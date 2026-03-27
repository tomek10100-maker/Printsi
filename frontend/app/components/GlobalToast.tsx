'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function GlobalToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    let idCounter = 0;

    // Przechwytujemy natywne wywołania alert() w całej aplikacji!
    const originalAlert = window.alert;
    
    window.alert = (message: any) => {
      const msgStr = String(message);
      
      // Detekcja typu błędu na podstawie słów kluczowych 
      let type: 'success' | 'error' | 'info' = 'info';
      const msgLower = msgStr.toLowerCase();
      
      if (msgLower.includes('success') || msgStr.includes('✅')) type = 'success';
      if (msgLower.includes('error') || msgLower.includes('failed') || msgStr.includes('❌') || msgLower.includes('lacks') || msgLower.includes('missing')) type = 'error';

      // Czyścimy ikonki emoji z tekstu by wyglądało to pro, bo dodajemy swoje
      const cleanMsg = msgStr.replace(/✅|❌/g, '').trim();

      const newId = ++idCounter;
      setToasts(prev => [...prev, { message: cleanMsg, type, id: newId }]);

      // Autoukrywanie po 5 sekundach
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newId));
      }, 5000);
    };

    return () => {
      window.alert = originalAlert; // Przywracamy przy odmontowaniu
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`flex items-start gap-3 px-5 py-4 w-[90vw] max-w-sm sm:max-w-md rounded-2xl shadow-2xl border-2 backdrop-blur-xl transition-all duration-300 pointer-events-auto
            animate-in slide-in-from-top-10 fade-in zoom-in-95
            ${toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-800' : ''}
            ${toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' : ''}
            ${toast.type === 'info' ? 'bg-blue-50/95 border-blue-200 text-blue-800' : ''}
          `}
        >
          <div className="pt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle className="text-green-500" size={24} />}
            {toast.type === 'error' && <XCircle className="text-red-500" size={24} />}
            {toast.type === 'info' && <AlertCircle className="text-blue-500" size={24} />}
          </div>
          
          <div className="flex-1 flex flex-col">
            <span className={`text-[11px] font-black uppercase tracking-widest mb-1 opacity-60
              ${toast.type === 'success' ? 'text-green-700' : ''}
              ${toast.type === 'error' ? 'text-red-700' : ''}
              ${toast.type === 'info' ? 'text-blue-700' : ''}
            `}>
              {toast.type === 'success' && 'Sukces'}
              {toast.type === 'error' && 'Wystąpił Błąd'}
              {toast.type === 'info' && 'Powiadomienie'}
            </span>
            <span className="font-medium text-sm leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap pr-2">
              {toast.message}
            </span>
          </div>

          <button 
            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            className="shrink-0 p-1.5 rounded-full hover:bg-black/5 transition-colors opacity-50 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
