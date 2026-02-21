'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Sliders, Package, Upload, Globe, DollarSign } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back to Home
        </Link>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-gray-900 mb-4">
            Simple. Transparent. <span className="text-blue-600">Creative.</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">How the Printsi ecosystem works</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* FOR BUYERS */}
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-6 py-2 rounded-bl-3xl font-black uppercase text-xs tracking-widest">For Buyers</div>
            
            <div className="mt-8 space-y-12">
              <Step 
                num="01" 
                title="Discover" 
                desc="Browse thousands of unique physical items and digital 3D models created by independent designers."
                icon={<Search size={24} className="text-blue-600"/>}
              />
              <Step 
                num="02" 
                title="Customize" 
                desc="Choose your colors, materials, or download the file instantly to print at home."
                icon={<Sliders size={24} className="text-blue-600"/>}
              />
              <Step 
                num="03" 
                title="Receive" 
                desc="Get your physical item shipped directly to you, or start printing the file immediately."
                icon={<Package size={24} className="text-blue-600"/>}
              />
            </div>
            
            <div className="mt-12 text-center">
               <Link href="/gallery" className="inline-block px-8 py-3 bg-blue-50 text-blue-600 rounded-xl font-black uppercase tracking-widest hover:bg-blue-100 transition-colors text-xs">
                 Start Browsing
               </Link>
            </div>
          </div>

          {/* FOR CREATORS */}
          <div className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-white text-black px-6 py-2 rounded-bl-3xl font-black uppercase text-xs tracking-widest">For Creators</div>
            
            <div className="mt-8 space-y-12">
              <Step 
                num="01" 
                title="Upload" 
                desc="List your physical products or digital 3D files. Set your own prices and manage stock."
                icon={<Upload size={24} className="text-white"/>}
                dark
              />
              <Step 
                num="02" 
                title="Connect" 
                desc="Receive orders from buyers around the world. We handle the secure payments."
                icon={<Globe size={24} className="text-white"/>}
                dark
              />
              <Step 
                num="03" 
                title="Earn" 
                desc="Get paid directly to your account. We take a small fee, you keep the rest."
                icon={<DollarSign size={24} className="text-white"/>}
                dark
              />
            </div>

            <div className="mt-12 text-center">
               <Link href="/upload" className="inline-block px-8 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all text-xs">
                 Start Selling
               </Link>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

function Step({ num, title, desc, icon, dark }: { num: string, title: string, desc: string, icon: React.ReactNode, dark?: boolean }) {
  return (
    <div className="flex gap-6 items-start">
      <div className={`
        w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-lg
        ${dark ? 'bg-white/10 text-white' : 'bg-blue-50 text-blue-600'}
      `}>
        {icon}
      </div>
      <div>
        <span className={`text-xs font-black uppercase tracking-widest mb-1 block ${dark ? 'text-gray-400' : 'text-gray-400'}`}>Step {num}</span>
        <h3 className="text-xl font-black uppercase mb-2">{title}</h3>
        <p className={`text-sm font-medium leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{desc}</p>
      </div>
    </div>
  );
}