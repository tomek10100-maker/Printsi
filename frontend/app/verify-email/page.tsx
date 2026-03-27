'use client';

import Link from 'next/link';
import { MailCheck, ArrowRight, ShieldCheck } from 'lucide-react';

export default function VerifyEmailPage() {
    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-gray-100 text-center relative overflow-hidden group">
                {/* Decorative blur effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -z-10 group-hover:bg-blue-600/30 transition-colors duration-500"></div>

                <div className="mx-auto w-24 h-24 bg-blue-50 rounded-full flex flex-col items-center justify-center mb-8 relative border-4 border-white shadow-sm">
                    <MailCheck size={40} className="text-blue-600 relative z-10" strokeWidth={1.5} />
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
                </div>

                <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Check your inbox</h1>

                <p className="text-gray-500 mb-8 leading-relaxed font-medium">
                    We've sent a verification link to your email address. Please click the link to activate your account and gain full access to Printsi.
                </p>

                <div className="bg-gray-50 rounded-2xl p-5 mb-8 border border-gray-100 text-left">
                    <div className="flex gap-4 items-start">
                        <ShieldCheck className="text-green-500 mt-0.5 flex-shrink-0" size={20} />
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm mb-1">Verify to Continue</h3>
                            <p className="text-xs text-gray-500 font-medium">
                                Once verified, you'll be able to log in and set up your profile immediately.
                            </p>
                        </div>
                    </div>
                </div>

                <Link
                    href="/login"
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-blue-600 transition-all flex items-center justify-center gap-3 group/btn shadow-md hover:shadow-xl"
                >
                    Return to Login
                    <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>

            <p className="text-gray-400 text-xs font-bold uppercase mt-8 tracking-widest">
                Didn't receive it? Check spam folder
            </p>
        </main>
    );
}
