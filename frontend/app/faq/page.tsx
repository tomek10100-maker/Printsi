'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, ChevronDown, ChevronUp, HelpCircle, ShoppingCart,
    Printer, Layers, Wallet, Shield, Package, Truck, RefreshCcw,
    MessageSquare, FileText, Search, ArrowRight, Mail
} from 'lucide-react';

type Category = {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    border: string;
    bg: string;
};

type FAQItem = {
    q: string;
    a: string;
    category: string;
};

const CATEGORIES: Category[] = [
    { id: 'all',      label: 'All',          icon: <HelpCircle size={15} />,    color: 'text-gray-600',   border: 'border-gray-300',   bg: 'bg-gray-100' },
    { id: 'buying',   label: 'Buying',       icon: <ShoppingCart size={15} />,  color: 'text-blue-600',   border: 'border-blue-200',   bg: 'bg-blue-50'  },
    { id: 'selling',  label: 'Selling',      icon: <Printer size={15} />,       color: 'text-emerald-600',border: 'border-emerald-200', bg: 'bg-emerald-50'},
    { id: 'digital',  label: 'Digital Files',icon: <Layers size={15} />,        color: 'text-purple-600', border: 'border-purple-200',  bg: 'bg-purple-50' },
    { id: 'payments', label: 'Payments',     icon: <Wallet size={15} />,        color: 'text-amber-600',  border: 'border-amber-200',   bg: 'bg-amber-50'  },
    { id: 'shipping', label: 'Shipping',     icon: <Truck size={15} />,         color: 'text-indigo-600', border: 'border-indigo-200',  bg: 'bg-indigo-50' },
    { id: 'safety',   label: 'Safety',       icon: <Shield size={15} />,        color: 'text-rose-600',   border: 'border-rose-200',    bg: 'bg-rose-50'   },
];

const FAQS: FAQItem[] = [
    // BUYING
    {
        category: 'buying',
        q: 'How do I place an order on Printsi?',
        a: 'Browse the Gallery and find an item you like. You can add it directly to your cart, or click on the listing to view details. From the product page you can message the seller, customize the order (color, material, quantity), and proceed to checkout. Payment is held securely in escrow until you confirm delivery.',
    },
    {
        category: 'buying',
        q: 'Can I request custom colors or materials?',
        a: 'Yes! Most physical listings support color and material customization. When viewing an offer, you can select from available variants or message the seller directly to request a specific color or material. Sellers can also send you a custom price proposal through the built-in negotiation system.',
    },
    {
        category: 'buying',
        q: 'What is the difference between Physical Items, Digital Files, and Print Requests?',
        a: 'Physical Items are real 3D-printed objects that will be shipped to you by the seller. Digital Files are downloadable STL/OBJ/3MF models you print yourself or use at a print shop. Print Requests (Jobs) are listings where you upload your own 3D file and printers bid on printing it for you.',
    },
    {
        category: 'buying',
        q: 'Can I cancel an order after placing it?',
        a: 'You can request a cancellation by messaging the seller before the item is marked as shipped. Once shipped, the order cannot be cancelled, but you can open a dispute if there is a problem. Since many items are custom-made on demand, cancellations before production are easier to process.',
    },
    {
        category: 'buying',
        q: 'How do I track my order?',
        a: 'All order updates happen in real time inside the chat with the seller. Once an item is shipped, the status changes to "Shipped" in the chat. If the seller provides a tracking number, it will be displayed in the order details.',
    },
    // SELLING
    {
        category: 'selling',
        q: 'How do I start selling on Printsi?',
        a: 'Create an account and go through onboarding to set your role — Printer (for physical items) or CAD Designer (for digital files). Then go to Upload to create your first listing. Add photos, set a price, choose your delivery settings, and publish.',
    },
    {
        category: 'selling',
        q: 'What is the Auto Pricing mode for physical items?',
        a: 'Auto Pricing is available if you have added your filament inventory in the Profile → Filaments section. When creating a listing, you select which filaments and how many grams each variant uses. Printsi automatically calculates the material cost and lets you add a markup. This ensures your prices always reflect current material costs.',
    },
    {
        category: 'selling',
        q: 'Can I offer multiple color variants for one product?',
        a: 'Yes! You can add multiple color variants per listing. Each variant can have different filament colors (including multi-color / multi-layer prints), its own price markup, and separate stock tracking. Buyers see all variants and can choose their preferred option.',
    },
    {
        category: 'selling',
        q: 'How do I receive payment?',
        a: 'When a buyer confirms delivery, the payment is released from escrow to your Printsi balance. You can then withdraw your balance to a connected bank account via the Profile → Billing section. We use Stripe Connect to process payouts securely.',
    },
    {
        category: 'selling',
        q: 'What fees does Printsi charge sellers?',
        a: 'Printsi takes a small platform fee per transaction to cover escrow, payment processing, and platform costs. The exact percentage is shown during listing creation. There are no monthly subscription fees — you only pay when you make a sale.',
    },
    // DIGITAL
    {
        category: 'digital',
        q: 'What file formats can I sell as a digital product?',
        a: 'You can upload STL, OBJ, 3MF and ZIP files. ZIP is recommended if your design consists of multiple files or includes printing instructions. All files are stored securely and only made accessible to buyers after a successful payment.',
    },
    {
        category: 'digital',
        q: 'Can buyers pirate or share digital files I sell?',
        a: 'While we cannot prevent buyers from sharing files after purchase (as with all digital goods), Printsi protects your files during the transaction — files are only released after confirmed payment. We recommend watermarking your files or including license terms in the description.',
    },
    {
        category: 'digital',
        q: 'How does delivery of a digital file work?',
        a: 'After a buyer purchases a digital file, you are notified via chat. You coordinate delivery through the chat — typically by sending the file to the buyer\'s email or via chat message. Once you\'ve delivered it, mark the order as "Sent to Email". The buyer then confirms receipt to release payment.',
    },
    // PAYMENTS
    {
        category: 'payments',
        q: 'Is it safe to pay on Printsi?',
        a: 'Yes. All payments go through an escrow system powered by Stripe — one of the world\'s most trusted payment processors. Your money is never sent directly to the seller. It is held securely until you confirm you have received your order in good condition.',
    },
    {
        category: 'payments',
        q: 'What currencies are supported?',
        a: 'Printsi supports multiple currencies including PLN, EUR, USD, GBP, CHF, SEK, CZK and more. Prices are automatically shown in your selected currency using live exchange rates. You can switch your currency at any time from the navigation bar or your account settings.',
    },
    {
        category: 'payments',
        q: 'Can I top up my Printsi balance?',
        a: 'Yes. You can top up your Printsi wallet from the Profile → Billing section using a card or other Stripe-supported payment method. Your balance is used for purchases and can also be withdrawn if you are a seller.',
    },
    {
        category: 'payments',
        q: 'When are funds released to the seller?',
        a: 'Funds are held in escrow and released immediately when the buyer clicks "I Received It" to confirm delivery. If the buyer does not confirm or open a dispute within the review window, funds may be released automatically after the deadline.',
    },
    // SHIPPING
    {
        category: 'shipping',
        q: 'How does shipping work for physical items?',
        a: 'Each seller defines their delivery settings — including which countries they ship to and at what rates. Shipping costs are shown on the product page. After a purchase, the seller ships the item and marks the order as shipped in the chat. The order status updates in real time.',
    },
    {
        category: 'shipping',
        q: 'Do you offer international shipping?',
        a: 'International shipping is supported. Sellers set the countries they ship to in their delivery settings. Shipping rates are calculated based on package weight and destination. Not all sellers ship internationally — check the product page for availability.',
    },
    {
        category: 'shipping',
        q: 'How long does delivery take?',
        a: 'Delivery times vary depending on the seller\'s location, print complexity, and chosen shipping method. Unlike traditional e-commerce, most items on Printsi are printed on demand after the order is placed. Typical times range from 3–14 business days. Check with the seller for an accurate estimate.',
    },
    // SAFETY
    {
        category: 'safety',
        q: 'What happens if I receive a damaged or wrong item?',
        a: 'If your item arrives damaged or is not as described, use the "Problem" button in the chat to open a dispute. Our team will review the case with evidence from both parties. Depending on the outcome, a refund or replacement may be arranged. Always photograph any damage upon receipt.',
    },
    {
        category: 'safety',
        q: 'How does the dispute system work?',
        a: 'When a buyer opens a dispute, funds in escrow are frozen and the case is escalated to the Printsi support team. Both buyer and seller are asked to provide evidence (photos, messages, etc.). Our team reviews the case and issues a resolution — which may include a full refund, partial refund or release of funds to the seller.',
    },
    {
        category: 'safety',
        q: 'Is my personal data safe on Printsi?',
        a: 'Yes. We follow GDPR guidelines and use industry-standard encryption for all personal data. Payment data is handled exclusively by Stripe and never stored on our servers. You can manage your data preferences and request deletion at any time from your account settings.',
    },
    {
        category: 'safety',
        q: 'Can I report a seller or listing?',
        a: 'Yes. If you encounter a listing that violates our terms (e.g. illegal content, misleading description, spam), you can report it using the flag button on the product page or by contacting support directly. We review all reports within 24–48 hours.',
    },
];

export default function FAQPage() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [openIndex, setOpenIndex] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    const filtered = FAQS.filter(f => {
        const matchCat = activeCategory === 'all' || f.category === activeCategory;
        const matchSearch = search.trim() === '' || f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
    });

    const toggle = (i: number) => setOpenIndex(prev => (prev === i ? null : i));

    const getCategoryMeta = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];

    return (
        <main className="min-h-screen bg-gray-50 font-sans text-gray-900">

            {/* ── HERO ─────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-10 font-bold uppercase text-[10px] tracking-widest transition-colors">
                        <ArrowLeft size={14} /> Back to Home
                    </Link>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Help Center</p>
                            <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none">
                                Frequently<br /><span className="text-blue-400">Asked.</span>
                            </h1>
                            <p className="text-gray-400 font-medium mt-4 max-w-md">
                                {FAQS.length} answers covering buying, selling, payments, shipping, and more.
                            </p>
                        </div>
                        {/* Search */}
                        <div className="relative w-full md:w-80">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search questions…"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setOpenIndex(null); }}
                                className="w-full bg-white/10 border border-white/20 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none focus:bg-white/20 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

                {/* ── CATEGORY FILTERS ─────────────────────────── */}
                <div className="flex flex-wrap gap-2 mb-10">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveCategory(cat.id); setOpenIndex(null); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border ${activeCategory === cat.id ? `${cat.bg} ${cat.border} ${cat.color}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                            {cat.icon} {cat.label}
                            {cat.id !== 'all' && (
                                <span className="ml-0.5 opacity-60">
                                    ({FAQS.filter(f => f.category === cat.id).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── FAQ ACCORDION ─────────────────────────────── */}
                {filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <HelpCircle size={40} className="mx-auto mb-4 opacity-30" />
                        <p className="font-bold text-lg">No results found</p>
                        <p className="text-sm font-medium mt-1">Try a different search term or category.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((item, i) => {
                            const cat = getCategoryMeta(item.category);
                            const isOpen = openIndex === i;
                            return (
                                <div
                                    key={i}
                                    className={`bg-white rounded-2xl border transition-all shadow-sm ${isOpen ? 'border-blue-200 shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}
                                >
                                    <button
                                        onClick={() => toggle(i)}
                                        className="w-full flex items-start gap-4 p-4 sm:p-5 text-left group"
                                        aria-expanded={isOpen}
                                    >
                                        {/* Category badge */}
                                        <div className={`mt-0.5 p-2 rounded-xl ${cat.bg} ${cat.border} border shrink-0 ${cat.color}`}>
                                            {cat.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[9px] font-black uppercase tracking-widest ${cat.color} mb-1`}>{cat.label}</p>
                                            <h3 className={`font-black text-gray-900 text-sm leading-snug group-hover:text-blue-600 transition-colors ${isOpen ? 'text-blue-600' : ''}`}>
                                                {item.q}
                                            </h3>
                                        </div>
                                        <div className={`shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-gray-400`}>
                                            <ChevronDown size={18} />
                                        </div>
                                    </button>
                                    {isOpen && (
                                        <div className="px-5 pb-5">
                                            <div className="ml-11 pl-4 border-l-2 border-blue-100">
                                                <p className="text-sm text-gray-600 font-medium leading-relaxed">{item.a}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── QUICK LINKS ───────────────────────────────── */}
                <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                        { icon: <FileText size={20} />, title: 'How It Works', desc: 'Detailed guide for buyers, sellers, printers and designers.', href: '/how-it-works', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                        { icon: <MessageSquare size={20} />, title: 'Contact Support', desc: 'Get help from our team for any issue not covered here.', href: '/support', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                        { icon: <Package size={20} />, title: 'Browse Gallery', desc: 'Ready to shop? Explore thousands of listings.', href: '/gallery', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                    ].map((link, i) => (
                        <Link key={i} href={link.href} className={`${link.bg} border ${link.border} rounded-2xl p-5 flex gap-4 hover:shadow-md transition-all group`}>
                            <div className={`w-10 h-10 bg-white rounded-xl border ${link.border} flex items-center justify-center ${link.color} shadow-sm shrink-0 group-hover:shadow-md transition-all`}>
                                {link.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`font-black text-sm ${link.color} mb-0.5`}>{link.title}</p>
                                <p className="text-xs text-gray-500 font-medium leading-snug">{link.desc}</p>
                            </div>
                            <ArrowRight size={16} className={`${link.color} opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0`} />
                        </Link>
                    ))}
                </div>

                {/* ── STILL NEED HELP ───────────────────────────── */}
                <div className="mt-10 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 sm:p-8 text-white text-center">
                    <Mail size={32} className="mx-auto text-blue-400 mb-4" />
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Still have questions?</h3>
                    <p className="text-gray-400 font-medium mb-6 max-w-md mx-auto">
                        Our support team is here to help. Reach out and we'll get back to you as soon as possible.
                    </p>
                    <Link
                        href="/support"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg hover:-translate-y-0.5"
                    >
                        Contact Support <ArrowRight size={15} />
                    </Link>
                </div>
            </div>
        </main>
    );
}