'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // If no PASSWORD_RECOVERY event fires within 3 seconds → link is invalid/expired
    const timeout = setTimeout(() => {
      if (isMounted) setCheckingSession(false);
    }, 3000);

    // ONLY trust PASSWORD_RECOVERY event — don't use getSession() which races with hash parsing
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      clearTimeout(timeout);
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidSession(true);
      }
      setCheckingSession(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setStatus({ type: 'error', message: 'Failed to reset password: ' + error.message });
        setLoading(false);
      } else {
        // Sign out first, then show success — prevents any auth listeners from firing mid-render
        await supabase.auth.signOut();
        setSuccess(true);
        setLoading(false);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'An unexpected error occurred.' });
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
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Printis</h1>
          <p className="text-gray-500">
            Create New Password
          </p>
        </div>

        {checkingSession ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-gray-500 font-medium text-sm">Verifying reset token...</p>
          </div>
        ) : !hasValidSession && !success ? (
          <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600 border border-amber-200">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
            <p className="text-gray-500 font-medium text-sm mb-6 leading-relaxed">
              Your password reset link is missing, expired, or has already been used. Please request a new link.
            </p>
            <Link
              href="/forgot-password"
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center text-sm"
            >
              Request New Reset Link
            </Link>
          </div>
        ) : success ? (
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
