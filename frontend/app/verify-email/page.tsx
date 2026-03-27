'use client';

import Link from 'next/link';
import { MailCheck, ArrowRight, ShieldCheck } from 'lucide-react';

export default function VerifyEmailPage() {
    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-900 relative">
            
            {/* Decorative gradient blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-60"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-[120px] opacity-60"></div>
            </div>

            <div className="w-full max-w-md bg-white rounded-[32px] shadow-2xl p-12 border border-gray-100 text-center relative overflow-hidden group">
                <div className="mx-auto w-24 h-24 bg-blue-50 rounded-3xl flex flex-col items-center justify-center mb-10 relative border-4 border-white shadow-xl animate-bounce">
                    <MailCheck size={40} className="text-blue-600 relative z-10" strokeWidth={1.5} />
                    <div className="absolute inset-0 bg-blue-400 rounded-2xl animate-ping opacity-20"></div>
                </div>

                <h1 className="text-4xl font-black text-gray-900 mb-4 uppercase tracking-tighter italic">Check Inbox</h1>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-8">
                    Link sent to your email address
                </p>

                <p className="text-gray-500 mb-10 leading-relaxed font-medium text-sm">
                    We've sent a verification link. Please click it to activate your account and join the Printsi community.
                </p>

                <div className="bg-gray-50 rounded-2xl p-6 mb-10 border border-gray-100 text-left flex gap-4 items-start shadow-sm">
                    <ShieldCheck className="text-green-500 mt-1 flex-shrink-0" size={24} />
                    <div>
                        <h3 className="font-black text-gray-900 text-[11px] uppercase tracking-wider mb-1">Verify to Continue</h3>
                        <p className="text-xs text-gray-500 font-medium leading-normal">
                            Once verified, you'll be able to log in and set up your seller or maker profile.
                        </p>
                    </div>
                </div>

                <Link
                    href="/login"
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 transition-all flex items-center justify-center gap-3 group/btn shadow-xl shadow-gray-200"
                >
                    Return to Login
                    <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
            </div>

            <p className="text-gray-400 text-[10px] font-black uppercase mt-10 tracking-[0.3em] flex items-center gap-4">
                <span className="w-12 h-[1px] bg-gray-200"></span>
                Check Spam Folder
                <span className="w-12 h-[1px] bg-gray-200"></span>
            </p>
        </main>
    );
}
