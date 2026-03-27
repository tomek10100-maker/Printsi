'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your account...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification link.');
      return;
    }

    const verify = async () => {
      try {
        // We need an API call for this because we want to use service role to update the verified status
        // and we want it to be secure.
        const res = await fetch('/api/auth/verify-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (data.success) {
          setStatus('success');
          setMessage('Your account has been successfully verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(data.error || 'An error occurred during verification.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('Server connection error.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 text-center border border-gray-100">
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin text-blue-600 mb-6" size={48} />
          <h1 className="text-2xl font-black uppercase text-gray-900 mb-2 italic tracking-tight">Printsi</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-green-100 shadow-xl shadow-green-100">
            <CheckCircle className="text-green-500" size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase text-gray-900 mb-2 italic tracking-tight">Account Active</h1>
          <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">
            {message}
          </p>
          <Link
            href="/login"
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            Go to Login
            <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center animate-in shake duration-500">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-red-100 shadow-xl shadow-red-100">
            <XCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase text-gray-900 mb-2 italic tracking-tight">Verification Error</h1>
          <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">
            {message}
          </p>
          <Link
            href="/login"
            className="w-full py-4 bg-gray-100 text-gray-900 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
          >
            Back to Login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyTokenPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900 relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px]"></div>
      </div>

      <Suspense fallback={<div className="text-xs font-black uppercase text-gray-400 tracking-widest">Loading...</div>}>
        <VerifyContent />
      </Suspense>

      <p className="text-center mt-12 text-[10px] text-gray-300 font-bold uppercase tracking-[0.3em]">
        Printsi Official Verification System
      </p>
    </main>
  );
}
