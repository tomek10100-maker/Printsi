'use client';

import { useState } from 'react';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/reset-password-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Wystąpił błąd podczas wysyłania linku.');
      }

      setSuccess(true);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
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
            Reset Your Password
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-green-100 shadow-xl shadow-green-100">
              <CheckCircle className="text-green-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">
              We have sent a password reset link to <strong>{email}</strong>. Please check your inbox and spam folder.
            </p>
            <Link
              href="/login"
              className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-black transition-all flex items-center justify-center"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            {status && (
              <div className="mb-6 p-4 rounded-xl border text-sm font-bold bg-red-50 border-red-200 text-red-600">
                ❌ {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter your email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
