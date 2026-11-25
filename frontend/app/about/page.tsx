'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        {/* Hero Section */}
        <div className="bg-white p-6 sm:p-12 rounded-3xl shadow-sm border border-gray-100 mb-8 text-center">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
            The Future of <span className="text-blue-600">Creation.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto font-medium">
            Bridging the gap between digital imagination and physical reality. Printis is the ecosystem for the next generation of makers.
          </p>
        </div>

        {/* Content Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm">1</span>
              Who We Are
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm font-medium">
              Printis is more than just a marketplace; it's a global ecosystem for makers, designers, and innovators. We believe that 3D printing technology shouldn't be limited to those with machines. We connect talented 3D designers with passionate makers and buyers looking for unique, custom-made items.
            </p>
          </div>

          <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-sm">2</span>
              Our Mission
            </h2>
            <p className="text-gray-600 leading-relaxed text-sm font-medium">
              To democratize manufacturing. Whether you need a replacement part, a custom figurine, or a digital file to print at home, Printis is the bridge that makes it happen. We empower creators to earn from their passion.
            </p>
          </div>
          <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100 md:col-span-2 mt-2">
            <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-sm">3</span>
              About Printis &amp; Transparency
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-medium text-gray-600">
              <div>
                <p className="font-black text-gray-900 uppercase tracking-widest mb-2 text-xs">Founder &amp; Operator</p>
                <p className="font-bold text-gray-900">Tomasz Szmal</p>
                <p className="text-xs text-gray-500 mb-1">Founder &amp; Creator of Printis</p>
                <p>Cracow, Poland</p>
                <p className="mt-2 text-xs text-gray-500">
                  Operated as an unregistered business activity (<em>działalność nierejestrowana</em>) under Polish Law (Art. 5 of the Entrepreneurs&apos; Law).
                </p>
              </div>
              <div>
                <p className="font-black text-gray-900 uppercase tracking-widest mb-2 text-xs">Contact &amp; Customer Care</p>
                <p><span className="text-gray-400 w-24 inline-block">Support:</span> <a href="mailto:support@printis.store" className="text-blue-600 font-bold hover:underline">support@printis.store</a></p>
                <p><span className="text-gray-400 w-24 inline-block">Platform:</span> <a href="https://printis.store" className="text-gray-700 hover:underline">printis.store</a></p>
                <p><span className="text-gray-400 w-24 inline-block">Location:</span> Cracow, Poland</p>
                <p className="mt-2 text-xs text-gray-500">
                  Response time: Usually within 24 hours for customer and maker assistance.
                </p>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
              <p className="text-xs text-blue-900 font-semibold leading-relaxed text-center">
                🌱 <strong>Early Pilot &amp; Community Validation:</strong> Printis is currently in an early validation phase. We are actively testing marketplace adoption, gathering feedback from creators and buyers, and working hard every day to earn your lasting trust.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 text-center">
             <Link href="/gallery" className="inline-block px-8 py-4 bg-gray-900 text-white rounded-full font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl text-xs">
                Explore the Gallery
             </Link>
        </div>
      </div>
    </main>
  );
}