'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { Lock, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [success, setSuccess] = useState(false);

  // Sprawdzamy czy użytkownik wszedł tu z prawidłowym tokenem z maila
  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event == "PASSWORD_RECOVERY") {
        console.log("Password recovery event triggered.");
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: "Passwords don't match." });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setStatus({ type: 'error', message: "Password must be at least 6 characters long." });
      setLoading(false);
      return;
    }

    // Aktualizujemy hasło u zalogowanego aktualnie użytkownika (sesja pochodzi z linku resetującego)
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus({ type: 'error', message: 'Failed to reset password: ' + error.message });
      setLoading(false);
    } else {
      setSuccess(true);
      // Wylogowujemy go przymusowo by zalogował się nowym hasłem? Lub zostawiamy zalogowanego.
      // Domyślnie zostawiamy zalogowanego, ale dla pewności po zmianie wylogujmy, aby przeszedł standardowy flow logowania
      await supabase.auth.signOut();
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 relative">
      <div className="absolute top-6 left-6">
        <Link
          href="/login"
          className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-bold text-sm bg-white/50 px-4 py-2 rounded-full hover:bg-white border border-transparent hover:border-gray-200"
        >
          <ArrowLeft size={18} /> Back to Login
        </Link>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Printsi</h1>
          <p className="text-gray-500">
            Create New Password
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-green-100 shadow-xl shadow-green-100">
              <CheckCircle className="text-green-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset Successful!</h2>
            <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">
              Your password has been successfully updated. You can now log in with your new password.
            </p>
            <Link
              href="/login"
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all flex items-center justify-center"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <>
            {status && (
              <div className="mb-6 p-4 rounded-xl border text-sm font-bold bg-red-50 border-red-200 text-red-600">
                ❌ {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 mt-4"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Update Password'
                )}
              </button>

              <p className="mt-4 text-center text-[11px] text-gray-400 uppercase tracking-widest font-semibold">
                Make it strong & secure
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
