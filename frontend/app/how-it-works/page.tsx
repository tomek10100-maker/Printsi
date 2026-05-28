'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Search, Package, ShoppingCart, MessageSquare,
    Upload, Globe, Wallet, Printer, FileText, CheckCircle2,
    Layers, Handshake, Shield, Zap, Star, ArrowRight,
    ChevronRight, Users, BarChart2, Truck, Lock, RefreshCcw
} from 'lucide-react';

type TabType = 'buyer' | 'printer' | 'designer' | 'job';

export default function HowItWorksPage() {
    const [activeTab, setActiveTab] = useState<TabType>('buyer');

    const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
        { id: 'buyer',    label: 'Buyer',       icon: <ShoppingCart size={16} />,  color: 'text-blue-600',   bg: 'bg-blue-600'   },
        { id: 'printer',  label: '3D Printer',  icon: <Printer size={16} />,      color: 'text-emerald-600', bg: 'bg-emerald-600' },
        { id: 'designer', label: 'CAD Designer',icon: <Layers size={16} />,       color: 'text-purple-600', bg: 'bg-purple-600'  },
        { id: 'job',      label: 'Print Request',icon: <FileText size={16} />,    color: 'text-orange-600', bg: 'bg-orange-600'  },
    ];

    const content: Record<TabType, { title: string; subtitle: string; accent: string; steps: { icon: React.ReactNode; title: string; desc: string }[]; cta: { label: string; href: string } }> = {
        buyer: {
            title: 'Buy Custom 3D Items',
            subtitle: 'From browsing to doorstep — secure, simple and fast.',
            accent: 'from-blue-600 to-blue-800',
            steps: [
                { icon: <Search size={22} />, title: 'Browse the Gallery', desc: 'Explore thousands of unique physical 3D-printed items and digital STL files made by independent creators. Filter by material, category, or price.' },
                { icon: <Handshake size={22} />, title: 'Negotiate & Customize', desc: 'Message the seller directly. Propose custom colors, materials or sizes. Use the built-in proposal system to reach a deal — no back-and-forth emails needed.' },
                { icon: <ShoppingCart size={22} />, title: 'Add to Cart & Checkout', desc: 'Pay securely through our escrow system. Your money is held safely until the order is fulfilled. Multiple currencies supported — PLN, EUR, USD, GBP and more.' },
                { icon: <Truck size={22} />, title: 'Track & Receive', desc: 'Follow your order status live in the chat. Once you receive your item, confirm delivery to release payment to the seller. Something wrong? Open a dispute.' },
                { icon: <Star size={22} />, title: 'Everything in Your Profile', desc: 'View all past orders, download digital files, manage your balance, and track favorites — all from one clean dashboard.' },
            ],
            cta: { label: 'Start Browsing', href: '/gallery' },
        },
        printer: {
            title: 'Sell Your 3D Prints',
            subtitle: 'Turn your printer into a money-making machine.',
            accent: 'from-emerald-600 to-teal-700',
            steps: [
                { icon: <Upload size={22} />, title: 'Set Up Your Profile', desc: 'Complete onboarding as a Printer. Add your delivery zones, shipping methods and filament inventory. Our filament manager auto-calculates material costs.' },
                { icon: <Package size={22} />, title: 'Create Listings', desc: 'List physical items with up to 6 photos, multi-color variants, dimensions and auto-calculated pricing from your filament stock. Or use Manual Mode to set prices directly.' },
                { icon: <MessageSquare size={22} />, title: 'Chat & Negotiate', desc: 'Receive orders and messages from buyers. Use the chat panel to negotiate custom requests, propose changes and confirm orders before production.' },
                { icon: <Truck size={22} />, title: 'Ship the Order', desc: 'Pack the item and ship via your preferred carrier. Mark it as shipped in the chat. A shipping label can be sent to your email if using our courier integration.' },
                { icon: <Wallet size={22} />, title: 'Get Paid', desc: 'Once the buyer confirms delivery, funds are instantly released to your Printsi balance. Withdraw to your bank account at any time via the billing panel.' },
            ],
            cta: { label: 'Start Selling', href: '/upload' },
        },
        designer: {
            title: 'Sell Digital 3D Files',
            subtitle: 'Design once, sell forever. No inventory needed.',
            accent: 'from-purple-600 to-violet-700',
            steps: [
                { icon: <Layers size={22} />, title: 'Onboard as a Designer', desc: 'Register as a CAD Designer in your profile settings. You gain access to the "Digital File" listing type — upload STL, OBJ, 3MF or ZIP files.' },
                { icon: <Upload size={22} />, title: 'Create a Digital Listing', desc: 'Upload your 3D model file plus up to 6 preview images. Set a price in your local currency. The file is stored securely — buyers receive it only after payment.' },
                { icon: <Globe size={22} />, title: 'Sell Globally', desc: 'Your listing is instantly visible to buyers worldwide. Prices are automatically shown in the buyer\'s local currency. No need to manage stock or shipping.' },
                { icon: <MessageSquare size={22} />, title: 'Deliver via Chat', desc: 'When a purchase is made, coordinate delivery through the chat. Mark the order as "Sent to Email" once the buyer has the file.' },
                { icon: <Wallet size={22} />, title: 'Passive Income', desc: 'Each sale goes straight to your Printsi balance. One design can generate income indefinitely. Withdraw earnings anytime.' },
            ],
            cta: { label: 'Upload a Design', href: '/upload' },
        },
        job: {
            title: 'Post a Print Request',
            subtitle: 'Have a 3D file? Find a printer to make it for you.',
            accent: 'from-orange-500 to-amber-600',
            steps: [
                { icon: <FileText size={22} />, title: 'Post Your Request', desc: 'Upload your STL file along with photos, dimensions, and material requirements. Describe any custom instructions — infill density, shell thickness, color, finish.' },
                { icon: <Users size={22} />, title: 'Receive Proposals', desc: 'Printers with the right equipment browse job listings and send you price proposals directly in the chat. Compare offers and choose the best printer for your job.' },
                { icon: <Handshake size={22} />, title: 'Accept & Pay', desc: 'Once you agree on price, accept the proposal. The payment is held in escrow — neither you nor the printer can access it until the job is done.' },
                { icon: <Printer size={22} />, title: 'Production & Shipping', desc: 'The printer produces your item using your 3D file. Once shipped, you\'ll be notified in the chat and can track delivery status.' },
                { icon: <CheckCircle2 size={22} />, title: 'Confirm & Release Payment', desc: 'When your item arrives, inspect it and confirm delivery. Funds are released to the printer. Something\'s not right? Use the dispute system for full protection.' },
            ],
            cta: { label: 'Post a Request', href: '/upload' },
        },
    };

    const currentTab = content[activeTab];
    const currentTabMeta = tabs.find(t => t.id === activeTab)!;

    const platformFeatures = [
        { icon: <Shield size={20} />, title: 'Escrow Payments', desc: 'Funds are held securely until order is completed. Full buyer and seller protection.' },
        { icon: <MessageSquare size={20} />, title: 'Built-in Chat', desc: 'Real-time messaging with file sharing, proposals and order management — no external tools needed.' },
        { icon: <Handshake size={20} />, title: 'Negotiation System', desc: 'Propose changes to price, quantity, color and material directly within the chat.' },
        { icon: <RefreshCcw size={20} />, title: 'Dispute Resolution', desc: 'If something goes wrong, open a dispute. Our team reviews and mediates the case.' },
        { icon: <BarChart2 size={20} />, title: 'Multi-Currency', desc: 'Automatic currency conversion. Pay or earn in PLN, EUR, USD, GBP, CHF and more.' },
        { icon: <Zap size={20} />, title: 'Auto Pricing', desc: 'Printers can link filament inventory for automatic cost calculation — no spreadsheets needed.' },
        { icon: <Globe size={20} />, title: 'Global Shipping', desc: 'Ship internationally via any carrier. Domestic and international shipping rates built in.' },
        { icon: <Lock size={20} />, title: 'Secure Storage', desc: 'All files and images are stored securely. Digital files are only accessible after purchase.' },
    ];

    return (
        <main className="min-h-screen bg-gray-50 font-sans text-gray-900">

            {/* ── HERO ─────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-10 font-bold uppercase text-[10px] tracking-widest transition-colors">
                        <ArrowLeft size={14} /> Back to Home
                    </Link>
                    <div className="max-w-3xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Platform Guide</p>
                        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none mb-5">
                            How<br /><span className="text-blue-400">Printsi</span><br />Works.
                        </h1>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed max-w-xl">
                            A marketplace built around 3D printing — connecting buyers, printers, and designers in one secure ecosystem.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div className="flex flex-wrap gap-3 mt-10">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${activeTab === tab.id ? 'bg-white text-gray-900 border-white' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── ROLE STEPS ────────────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

                {/* Tab header */}
                <div className={`bg-gradient-to-r ${currentTab.accent} rounded-3xl p-5 sm:p-8 text-white mb-10 shadow-xl`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 mb-1">{currentTabMeta.label} Flow</p>
                    <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">{currentTab.title}</h2>
                    <p className="text-white/80 font-medium mt-2">{currentTab.subtitle}</p>
                </div>

                {/* Steps */}
                <div className="relative">
                    {/* Vertical connector line */}
                    <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block" />

                    <div className="space-y-6">
                        {currentTab.steps.map((step, idx) => (
                            <div key={idx} className="relative flex gap-6 group">
                                {/* Step number circle */}
                                <div className={`relative z-10 w-14 h-14 shrink-0 rounded-2xl bg-white border-2 border-gray-200 flex flex-col items-center justify-center shadow-sm group-hover:border-blue-400 group-hover:shadow-md transition-all`}>
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">0{idx + 1}</span>
                                </div>

                                {/* Content card */}
                                <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 hover:shadow-md hover:border-gray-200 transition-all group-hover:-translate-y-0.5">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 shrink-0`}>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-base mb-1">{step.title}</h3>
                                            <p className="text-sm text-gray-500 font-medium leading-relaxed">{step.desc}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Arrow to next */}
                                {idx < currentTab.steps.length - 1 && (
                                    <div className="absolute left-[26px] bottom-[-18px] text-gray-300 hidden md:block z-20">
                                        <ChevronRight size={14} className="rotate-90" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-10 text-center">
                    <Link
                        href={currentTab.cta.href}
                        className={`inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${currentTab.accent} text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
                    >
                        {currentTab.cta.label} <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* ── PLATFORM FEATURES ─────────────────────────────── */}
            <div className="bg-white border-t border-gray-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                    <div className="text-center mb-12">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-3">Platform Features</p>
                        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-gray-900">
                            Built for <span className="text-blue-600">Trust.</span>
                        </h2>
                        <p className="text-gray-500 font-medium mt-3 max-w-xl mx-auto">
                            Every tool you need to buy, sell and create — safely and efficiently — in one place.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {platformFeatures.map((f, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-100 rounded-2xl p-5 hover:bg-white hover:shadow-md hover:border-blue-100 transition-all group">
                                <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-blue-600 mb-4 shadow-sm group-hover:border-blue-200 group-hover:shadow-md transition-all">
                                    {f.icon}
                                </div>
                                <h3 className="font-black text-gray-900 text-sm mb-1">{f.title}</h3>
                                <p className="text-xs text-gray-500 font-medium leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── CATEGORIES OVERVIEW ───────────────────────────── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
                <div className="text-center mb-12">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 mb-3">Marketplace Categories</p>
                    <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-gray-900">
                        Three Ways to <span className="text-blue-600">Create.</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            href: '/gallery?category=physical',
                            badge: 'Physical Items',
                            title: 'Ready-Made 3D Prints',
                            desc: 'Browse printed items made by real printers. Order physical objects shipped directly to your door with full escrow protection.',
                            icon: <Package size={28} />,
                            gradient: 'from-blue-50 to-blue-100/50',
                            border: 'border-blue-200',
                            textColor: 'text-blue-700',
                            cta: 'Browse Physical',
                            ctaStyle: 'bg-blue-600 hover:bg-blue-700',
                        },
                        {
                            href: '/gallery?category=digital',
                            badge: 'Digital Files',
                            title: 'Download STL Models',
                            desc: 'Buy digital 3D model files from independent designers. Download instantly and print on your own machine or at a local print shop.',
                            icon: <Layers size={28} />,
                            gradient: 'from-purple-50 to-purple-100/50',
                            border: 'border-purple-200',
                            textColor: 'text-purple-700',
                            cta: 'Browse Files',
                            ctaStyle: 'bg-purple-600 hover:bg-purple-700',
                        },
                        {
                            href: '/gallery?category=job',
                            badge: 'Print Jobs',
                            title: 'Custom Print Requests',
                            desc: 'Have your own STL file but no printer? Post a request and receive proposals from verified printers ready to produce it for you.',
                            icon: <FileText size={28} />,
                            gradient: 'from-orange-50 to-orange-100/50',
                            border: 'border-orange-200',
                            textColor: 'text-orange-700',
                            cta: 'Post a Job',
                            ctaStyle: 'bg-orange-500 hover:bg-orange-600',
                        },
                    ].map((cat, i) => (
                        <div key={i} className={`bg-gradient-to-br ${cat.gradient} border ${cat.border} rounded-3xl p-5 sm:p-7 flex flex-col`}>
                            <div className={`w-12 h-12 rounded-2xl bg-white border ${cat.border} flex items-center justify-center ${cat.textColor} shadow-sm mb-5`}>
                                {cat.icon}
                            </div>
                            <p className={`text-[9px] font-black uppercase tracking-widest ${cat.textColor} mb-1`}>{cat.badge}</p>
                            <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">{cat.title}</h3>
                            <p className="text-sm text-gray-600 font-medium leading-relaxed flex-1 mb-6">{cat.desc}</p>
                            <Link
                                href={cat.href}
                                className={`inline-flex items-center gap-2 ${cat.ctaStyle} text-white text-[11px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl w-fit transition-all shadow-md`}
                            >
                                {cat.cta} <ArrowRight size={13} />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── BOTTOM CTA ────────────────────────────────────── */}
            <div className="bg-gray-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Ready to Start?</p>
                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
                        Join the <span className="text-blue-400">Ecosystem.</span>
                    </h2>
                    <p className="text-gray-400 font-medium mb-8 text-lg max-w-xl mx-auto">
                        Whether you want to buy, print or design — create an account and start in minutes.
                    </p>
                    <div className="flex flex-wrap gap-4 justify-center">
                        <Link href="/login" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                            Create Account <ArrowRight size={16} />
                        </Link>
                        <Link href="/gallery" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all">
                            Browse Gallery
                        </Link>
                        <Link href="/faq" className="inline-flex items-center gap-2 text-gray-400 hover:text-white px-4 py-4 font-black uppercase tracking-widest text-sm transition-colors">
                            FAQ <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}