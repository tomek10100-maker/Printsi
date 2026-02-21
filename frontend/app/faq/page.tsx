'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle } from 'lucide-react';

export default function FAQPage() {
  const faqs = [
    {
      q: "Is it safe to buy on Printsi?",
      a: "Absolutely. We use secure payment processing to ensure your financial data is protected. We also hold payments in escrow until the order is processed to guarantee satisfaction."
    },
    {
      q: "What is the difference between 'Physical' and 'Digital'?",
      a: "'Physical Items' are real objects 3D printed and shipped to you. 'Digital Files' are downloadable models (STL/OBJ) that you can print on your own machine."
    },
    {
      q: "How long does shipping take?",
      a: "Shipping times vary depending on the seller's location and the complexity of the print. You can see estimated delivery times on each product page."
    },
    {
      q: "Can I return a custom item?",
      a: "Since many items are made-to-order (print-on-demand), returns are generally only accepted if the item arrives damaged or incorrect. Please contact support if you have issues."
    },
    {
      q: "How do I start selling?",
      a: "Create an account, go to your profile, and click 'Add Listing'. You can list physical items or digital files in minutes."
    }
  ];

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6 font-sans text-gray-900">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 mb-10 text-center">
          <HelpCircle size={48} className="mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-500 font-medium">Everything you need to know about the ecosystem.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
              <h3 className="text-lg font-black text-gray-900 mb-2">{item.q}</h3>
              <p className="text-gray-600 leading-relaxed text-sm font-medium">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}