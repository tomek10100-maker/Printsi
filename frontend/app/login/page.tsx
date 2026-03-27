'use client';

import { createClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      setStatus({ type: 'error', message: error.message });
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setStatus({ type: 'error', message: error.message });
      } else if (data.user && data.session === null) {
        // Confirmation email sent (Supabase default)
        setStatus({ type: 'success', message: 'Perfect! Check your inbox for a confirmation link to activate your account.' });
        // Optional: Call our welcome relay if we want a custom welcome right away
        fetch('/api/auth/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, fullName: email.split('@')[0] }),
        }).catch(() => {});
      } else {
        window.location.href = '/onboarding';
      }
    } else {
      const { data: sessionData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus({ type: 'error', message: error.message });
      } else if (sessionData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', sessionData.user.id)
          .single();

        if (!profile?.roles || profile.roles.length === 0) {
          window.location.href = '/onboarding';
        } else {
          window.location.href = '/';
        }
      }
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 relative font-sans">
      
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-60"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>
      </div>

      {/* Back Button */}
      <div className="absolute top-8 left-8">
        <Link
          href="/"
          className="group flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-all font-black uppercase tracking-widest text-[10px]"
        >
          <div className="p-2 bg-white rounded-full shadow-sm border border-gray-100 group-hover:shadow-md group-hover:-translate-x-1 transition-all">
            <ArrowLeft size={16} />
          </div>
          Back to Home
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-[32px] shadow-2xl p-10 border border-gray-100 relative overflow-hidden">
          
          <div className="text-center mb-10">
            <div className="inline-block p-4 bg-blue-50 rounded-2xl mb-4">
              <span className="text-2xl">🖨️</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tighter italic">Printsi</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              {isSignUp ? 'Join the marketplace' : 'Welcome back to the platform'}
            </p>
          </div>

          {/* Status Messages (Cegiełki) */}
          {status && (
            <div className={`mb-8 p-4 rounded-2xl border flex gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              status.type === 'error' 
                ? 'bg-red-50 border-red-100 text-red-600' 
                : 'bg-green-50 border-green-100 text-green-600'
            }`}>
              <div className="shrink-0 mt-0.5">
                {status.type === 'error' ? '🚫' : '✅'}
              </div>
              <p className="text-xs font-black uppercase tracking-tight leading-relaxed">
                {status.message}
              </p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-900 font-black uppercase tracking-widest text-[11px] py-4 px-4 rounded-2xl transition-all shadow-sm mb-8"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative flex py-2 items-center mb-8">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink-0 mx-4 text-gray-300 text-[10px] font-black uppercase tracking-widest">or email</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold placeholder-gray-300 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest ml-1">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-gray-900 font-bold placeholder-gray-300 focus:bg-white focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                isSignUp ? 'Create Account' : 'Sign In Now'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 font-bold">
            {isSignUp ? 'ALREADY HAVE AN ACCOUNT?' : "DON'T HAVE AN ACCOUNT YET?"}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setStatus(null); }}
              className="ml-2 text-blue-600 hover:text-blue-700 transition-colors uppercase"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>

        </div>
        
        <p className="text-center mt-10 text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
          Powered by Printsi — 2025
        </p>
      </div>
    </main>
  );
}