'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, ShieldCheck, Truck } from 'lucide-react';

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <div className="bg-blue-600 text-white p-12 rounded-3xl shadow-xl mb-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">We’ve got your back.</h1>
            <p className="text-blue-100 text-lg max-w-xl mx-auto font-medium mb-8">
              Need help with an order or have a technical question? Our team is here to assist you.
            </p>
            <a href="mailto:support@printsi.com" className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-full font-black uppercase tracking-widest hover:bg-gray-100 transition-colors text-xs">
              <Mail size={18} /> Contact Support
            </a>
          </div>
          {/* Ozdobne koła w tle */}
          <div className="absolute top-[-50%] left-[-10%] w-96 h-96 bg-blue-500 rounded-full opacity-50 blur-3xl"></div>
          <div className="absolute bottom-[-50%] right-[-10%] w-96 h-96 bg-blue-400 rounded-full opacity-50 blur-3xl"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SupportCard 
            icon={<Truck className="text-blue-600" size={32} />} 
            title="Order Issues" 
            desc="Haven't received your package? Let us know the Order ID." 
          />
          <SupportCard 
            icon={<MessageSquare className="text-purple-600" size={32} />} 
            title="Technical Help" 
            desc="Trouble downloading a file or setting up a print?" 
          />
          <SupportCard 
            icon={<ShieldCheck className="text-green-600" size={32} />} 
            title="Copyright" 
            desc="Report intellectual property infringement or policy violations." 
          />
        </div>
      </div>
    </main>
  );
}

function SupportCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center hover:-translate-y-1 transition-transform">
      <div className="bg-gray-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
        {icon}
      </div>
      <h3 className="font-black uppercase text-gray-900 mb-3 text-sm">{title}</h3>
      <p className="text-gray-500 text-xs font-bold leading-relaxed">{desc}</p>
    </div>
  );
}