'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCurrency } from '../../context/CurrencyContext';
import {
    Globe, User, Shield, Check, ChevronRight, ChevronLeft,
    Loader2, Coins, ScrollText, ChevronDown,
} from 'lucide-react';
import { DHL_COUNTRIES } from '../lib/dhlRates';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CURRENCIES = [
    { code: 'EUR', label: '🇪🇺 Euro (€)' },
    { code: 'PLN', label: '🇵🇱 Polski Złoty (zł)' },
    { code: 'CZK', label: '🇨🇿 Czech Koruna (Kč)' },
    { code: 'HUF', label: '🇭🇺 Hungarian Forint (Ft)' },
    { code: 'RON', label: '🇷🇴 Romanian Leu (lei)' },
    { code: 'SEK', label: '🇸🇪 Swedish Krona (kr)' },
];

const TOTAL_STEPS = 4;

const TOS_SECTIONS = [
    {
        title: '§1. General Provisions and Definitions',
        content: `These Terms of Service ("Terms") govern access to and use of the Printis online marketplace ("Platform"), available at printis.io, operated by Printis Global Sp. z o.o., ul. Wymyślona 404/2, 00-000 Warszawa, Poland, NIP: 1234567890, e-mail: legal@printis.io ("Administrator").

Definitions:
• User – any individual or legal entity accessing the Platform.
• Buyer – a User who purchases Products or Services via the Platform.
• Seller / Maker – a User (individual, legal entity, or unincorporated body) offering Products or Services on the Platform.
• 3D Product – a tangible, 3D-printed item listed for sale by a Seller.
• Digital Product – a non-material digital file (e.g. STL, OBJ, 3MF, STEP) containing a 3D model offered for download.
• Print Job – a service consisting of printing a 3D model on demand, according to the Buyer's individual specifications.
• Escrow – a payment protection mechanism whereby funds are held by the Platform until the Buyer confirms delivery or the dispute resolution period expires.`,
    },
    {
        title: '§2. Role of the Platform',
        content: `The Administrator provides the technical infrastructure of the Platform to facilitate connections and the conclusion of contracts between Buyers and Sellers.

The Administrator is NOT a party to any sale, delivery, or service agreement concluded between Users (except where the Administrator operates its own seller account).

A contract is concluded directly between the Buyer and the Seller at the moment the Seller confirms acceptance of an order on the Platform.

The Administrator reserves the right to remove listings and suspend accounts that violate these Terms, applicable law, or community standards, without prior notice in cases of serious infringement.`,
    },
    {
        title: '§3. Registration and Account Requirements',
        content: `Browsing listings on the Platform does not require registration.

An account is required to: (a) place orders, (b) list Products or Services, (c) use the messaging system, (d) receive payouts.

Users must be at least 18 years of age (or the legal age of majority in their jurisdiction) to register.

The Seller listing a 3D Product is obligated to: (a) accurately describe the item's category, material, dimensions and weight, (b) provide genuine photographs of the actual item — computer renders alone are insufficient, (c) ensure stock levels are kept accurate and up to date.

The Seller listing a Digital Product (3D model file) declares that the file is their original work or that they hold a valid commercial licence permitting resale.

The Seller offering a Print Job service declares their capability to fulfil the job within the agreed timeframe and to the agreed quality standard.`,
    },
    {
        title: '§4. Intellectual Property and Licences',
        content: `Any Seller offering Digital Products or 3D Products based on third-party 3D model files declares that they hold full copyright or a commercial licence for that content.

It is strictly prohibited to sell Digital Products or 3D Products derived from files downloaded from the internet that are subject to a licence excluding commercial use (e.g. Creative Commons Non-Commercial — CC BY-NC or CC BY-NC-SA).

Upon receipt of a credible copyright infringement notice from the legitimate rights-holder, the Administrator reserves the right to immediately remove the listing and suspend the Seller's account (Notice & Takedown procedure, consistent with applicable EU and Polish copyright law).

Buyers purchasing Digital Products receive a single-use personal licence to print the model for personal use only, unless the listing explicitly states otherwise. Resale, redistribution or commercial exploitation of purchased digital files is prohibited without explicit authorisation from the rights-holder.`,
    },
    {
        title: '§5. Prohibited Listings and Conduct',
        content: `It is strictly prohibited to offer on the Platform:
• Printed firearms, knives, their significant components, or 3D model files intended for their production.
• Items inciting hatred on racial, religious, ethnic, or gender grounds.
• Items infringing on third-party intellectual property rights (copyright, trademarks, patents).
• Dangerous goods or items violating applicable Polish, EU, or international law.
• Counterfeit or misleadingly labelled goods.
• Items promoting or facilitating illegal activity of any kind.

The Administrator may remove any listing at its sole discretion if it determines the listing to be inappropriate, misleading, or potentially harmful, and may permanently ban accounts responsible for repeated violations.`,
    },
    {
        title: '§6. Payments, Escrow and Platform Fees',
        content: `Payments on the Platform are processed by Stripe (Stripe Payments Europe, Ltd.), in accordance with Stripe's Terms of Service and applicable PSD2 regulations.

The Administrator operates an Escrow mechanism: funds paid by the Buyer are held securely until (a) the Buyer confirms successful delivery, or (b) 14 days after the Seller marks the item as shipped (whichever comes first), or (c) a dispute is resolved.

The Administrator charges Sellers a platform commission of 8% of the gross transaction value (excluding shipping costs) upon release of funds from Escrow.

Payouts to Sellers are processed via SEPA bank transfer to the IBAN registered in the Seller's account settings, subject to the minimum payout threshold of €10.00.

Buyers may fund their Printis Wallet (internal balance) to pay for orders without entering card details at each checkout. Wallet top-ups are processed via Stripe. Platform wallet funds are not redeemable for cash and are non-transferable between accounts.`,
    },
    {
        title: '§7. Withdrawal Rights and Returns',
        content: `3D Products (ready-made, from stock): The Buyer (acting as a consumer) has the right to withdraw from the contract within 14 days of receiving the parcel, without giving any reason. Return shipping costs are borne by the Buyer unless the item is defective.

Print Jobs (custom-made items): In accordance with Article 38(3) of the Polish Consumer Rights Act (and analogous EU Directive 2011/83/EU provisions), the right of withdrawal does NOT apply where the Print Job is manufactured to the Buyer's individual specifications (e.g. custom size, colour, engraving, or personal 3D file).

Digital Products (3D model files): The right of withdrawal does NOT apply once the Buyer has expressly consented to the immediate delivery of digital content before the expiry of the withdrawal period, and acknowledges the consequent loss of the right of withdrawal. This consent is collected via a mandatory checkbox at the final checkout step. If this checkbox is not ticked, the file will not be delivered and the order will be cancelled.

In all cases, defective or non-conforming items must be reported within 2 years of purchase (for consumers) or within the statutory warranty period (for business buyers).`,
    },
    {
        title: '§8. Liability, Complaints and Dispute Resolution',
        content: `The Seller bears sole responsibility for the conformity of the Product or Service with the contract concluded with the Buyer.

Complaints regarding product quality, non-delivery, or file defects should be submitted directly to the Seller via the Platform's messaging system within 30 days of the issue arising.

The Administrator provides a dispute mediation system to assist in resolving disagreements between Buyers and Sellers. The Administrator does not bear financial liability for either party's failure to perform their contractual obligations.

In the event of a confirmed fraud or a Seller's prolonged non-responsiveness, the Administrator may — at its sole discretion — initiate a refund from the Escrow balance as a goodwill gesture, up to a maximum of the transaction value.

For EU consumers: disputes may also be submitted to the Online Dispute Resolution (ODR) platform operated by the European Commission at: https://ec.europa.eu/consumers/odr.`,
    },
    {
        title: '§9. Privacy, Data Protection and GDPR',
        content: `The processing of Users' personal data is governed by the Printis Privacy Policy, available at printis.io/privacy, which constitutes an integral part of these Terms.

By registering an account, the User acknowledges and accepts the Privacy Policy.

The Administrator processes personal data in accordance with Regulation (EU) 2016/679 (GDPR) and the Polish Act of 10 May 2018 on the Protection of Personal Data.

Users have the right to: access, rectify, erase, restrict processing of, and port their data, as well as the right to object and to lodge a complaint with the supervisory authority (UODO in Poland).`,
    },
    {
        title: '§10. Final Provisions',
        content: `The Administrator reserves the right to amend these Terms for valid legal or technological reasons, providing Users with at least 14 days' advance notice before changes take effect. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.

Matters not governed by these Terms shall be subject to Polish law, in particular the Civil Code (Kodeks Cywilny) and the Consumer Rights Act (Ustawa o prawach konsumenta), as well as applicable EU directives.

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.

These Terms were last updated on 29 May 2025.`,
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { setCurrency } = useCurrency();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [step, setStep] = useState(1);

    // Step 1
    const [fullName, setFullName] = useState('');

    // Step 2
    const [roles, setRoles] = useState<string[]>([]);
    const [roleError, setRoleError] = useState('');

    // Step 3
    const [country, setCountry] = useState('PL');
    const [localCurrency, setLocalCurrency] = useState('EUR');

    // Step 4 — ToS
    const [openSection, setOpenSection] = useState<number | null>(null);
    const [tosAccepted, setTosAccepted] = useState(false);
    const [digitalConsent, setDigitalConsent] = useState(false);

    useEffect(() => {
        if (roleError) {
            const timer = setTimeout(() => setRoleError(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [roleError]);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) { router.push('/login'); return; }
            const user = session.user;
            setUser(user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('roles, full_name')
                .eq('id', user.id)
                .single();

            if (profile?.roles?.length > 0) {
                router.push('/');
            } else {
                if (profile?.full_name) setFullName(profile.full_name);
                setLoading(false);
            }
        };
        init();
    }, [router]);

    const toggleRole = (role: string) => {
        let newRoles = [...roles];
        const group1 = ['customer', 'designer', 'printer'];
        const group2 = ['hobbyist', 'business'];

        if (group1.includes(role)) {
            if (newRoles.includes(role)) {
                const othersInGroup1 = newRoles.filter(r => group1.includes(r) && r !== role);
                if (othersInGroup1.length > 0) newRoles = newRoles.filter(r => r !== role);
                else { setRoleError('At least one marketplace role must be selected.'); return; }
            } else {
                newRoles.push(role);
            }
        } else if (group2.includes(role)) {
            if (newRoles.includes(role)) { setRoleError('At least one account type must be selected.'); return; }
            else { newRoles = newRoles.filter(r => !group2.includes(r)); newRoles.push(role); }
        }
        setRoles(newRoles);
        setRoleError('');
    };

    const handleComplete = async () => {
        if (!tosAccepted) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                full_name: fullName || 'New User',
                roles: roles.length > 0 ? roles : ['customer'],
                country,
                updated_at: new Date(),
            });
            if (error) throw error;
            setCurrency(localCurrency as any);
            fetch('/api/order/welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name: fullName || 'New User' }),
            }).catch(() => {});
            router.push('/');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const isStep1Valid = fullName.trim().length > 0;
    const hasSelectedRole = roles.some(r => ['customer', 'designer', 'printer'].includes(r));
    const hasSelectedAccountType = roles.some(r => ['hobbyist', 'business'].includes(r));
    const isStep2Valid = hasSelectedRole && hasSelectedAccountType;
    const isStep4Valid = tosAccepted && digitalConsent;

    const isNextDisabled = (step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid);
    const isCompleteDisabled = !isStep4Valid || saving;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading...</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">

                {/* HEADER */}
                <div className="text-center mb-10">
                    <div className="inline-block bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                        Welcome to Printis
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Let's set up your account.</h1>
                    <p className="text-gray-500 mt-2 font-medium">It only takes a minute to personalize your experience.</p>
                </div>

                {/* PROGRESS BAR */}
                <div className="flex gap-2 mb-8">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                        <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    ))}
                </div>

                {/* CARD */}
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 transition-all duration-500">

                    {/* STEP 1 */}
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 text-gray-900">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><User size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">About You</h2>
                            </div>
                            <p className="text-gray-500 mb-8 font-medium">What name should we use to address you? This can be your real name or your studio/business name.</p>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Display Name / Company Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="e.g. John's Studio"
                                className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 text-lg placeholder:text-gray-300"
                                autoFocus
                            />
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 text-gray-900">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Shield size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Choose Your Roles</h2>
                            </div>
                            <p className="text-gray-500 mb-6 font-medium">This helps us tailor the marketplace to your needs.</p>
                            <div className="space-y-6">
                                {roleError && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
                                        ⚠️ {roleError}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 italic">What do you want to do? (Select at least one)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <RoleCard title="Customer" desc="I want to buy products." active={roles.includes('customer')} onClick={() => toggleRole('customer')} />
                                        <RoleCard title="CAD Designer" desc="I want to sell 3D models." active={roles.includes('designer')} onClick={() => toggleRole('designer')} />
                                        <RoleCard title="3D Printer" desc="I offer printing services." active={roles.includes('printer')} onClick={() => toggleRole('printer')} />
                                    </div>
                                </div>
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 italic">Account Type (Choose one)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <RoleCard title="Hobbyist / Maker" desc="I do this for fun." active={roles.includes('hobbyist')} onClick={() => toggleRole('hobbyist')} />
                                        <RoleCard title="Business / Studio" desc="I represent a company." active={roles.includes('business')} onClick={() => toggleRole('business')} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 text-gray-900">
                                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Globe size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Region & Currency</h2>
                            </div>
                            <p className="text-gray-500 mb-8 font-medium">Where are you located and how do you prefer to pay?</p>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Country / Region</label>
                                    <div className="relative">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <select value={country} onChange={e => setCountry(e.target.value)} className="w-full p-4 pl-12 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer">
                                            {DHL_COUNTRIES.map(c => (<option key={c.code} value={c.code}>{c.name}</option>))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Preferred Currency</label>
                                    <div className="relative">
                                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <select value={localCurrency} onChange={e => setLocalCurrency(e.target.value)} className="w-full p-4 pl-12 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer">
                                            {CURRENCIES.map(c => (<option key={c.code} value={c.code}>{c.label}</option>))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 — TERMS OF SERVICE */}
                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 mb-2 text-gray-900">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ScrollText size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Terms of Service</h2>
                            </div>
                            <p className="text-gray-500 mb-6 font-medium text-sm">Please read and accept our Terms of Service before completing your registration.</p>

                            {/* ToS Accordion */}
                            <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100 mb-6 max-h-80 overflow-y-auto shadow-inner">
                                {TOS_SECTIONS.map((section, idx) => (
                                    <div key={idx}>
                                        <button
                                            onClick={() => setOpenSection(openSection === idx ? null : idx)}
                                            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors group"
                                        >
                                            <span className="font-black text-xs text-gray-700 uppercase tracking-wide group-hover:text-blue-600 transition-colors">{section.title}</span>
                                            <ChevronDown size={14} className={`text-gray-400 transition-transform duration-300 flex-shrink-0 ml-3 ${openSection === idx ? 'rotate-180' : ''}`} />
                                        </button>
                                        {openSection === idx && (
                                            <div className="px-5 pb-5 bg-gray-50/50">
                                                <p className="text-xs text-gray-600 leading-relaxed font-medium whitespace-pre-line">{section.content}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Checkboxes */}
                            <div className="space-y-4">
                                {/* Main ToS acceptance */}
                                <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${tosAccepted ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-200'}`}>
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={tosAccepted}
                                            onChange={e => setTosAccepted(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${tosAccepted ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                            {tosAccepted && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 leading-relaxed">
                                        I have read and I accept the <span className="text-blue-600 font-black">Printis Terms of Service</span> and <span className="text-blue-600 font-black">Privacy Policy</span>. I understand that by using the Platform, I agree to be bound by these Terms.
                                    </span>
                                </label>

                                {/* Digital content consent */}
                                <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${digitalConsent ? 'border-emerald-500 bg-emerald-50/50' : 'border-gray-200 hover:border-emerald-200'}`}>
                                    <div className="relative flex-shrink-0 mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={digitalConsent}
                                            onChange={e => setDigitalConsent(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${digitalConsent ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                                            {digitalConsent && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 leading-relaxed">
                                        I expressly consent to the immediate delivery of digital content (3D model files) before the expiry of the 14-day withdrawal period, and I acknowledge that by granting this consent, <span className="text-emerald-700 font-black">I lose my right to withdraw from the contract</span> for digital file purchases once the file has been delivered. (§7 of the Terms, Art. 38(13) of the Consumer Rights Act)
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* NAVIGATION */}
                <div className="flex justify-between items-center mt-8">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold px-4 py-2 transition-colors uppercase text-xs tracking-widest"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : <div />}

                    {step < TOTAL_STEPS ? (
                        <div className="flex flex-col items-end gap-2">
                            {step === 2 && isNextDisabled && (
                                <span className="text-[10px] uppercase tracking-widest font-black text-red-500">Select at least one option from each section</span>
                            )}
                            <button
                                onClick={() => setStep(step + 1)}
                                disabled={isNextDisabled}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${isNextDisabled
                                    ? 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'
                                    : 'bg-gray-900 text-white hover:bg-blue-600 hover:-translate-y-1 hover:shadow-blue-600/20'
                                }`}
                            >
                                Next Step <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-end gap-2">
                            {!isStep4Valid && (
                                <span className="text-[10px] uppercase tracking-widest font-black text-red-500">Please accept all required agreements</span>
                            )}
                            <button
                                onClick={handleComplete}
                                disabled={isCompleteDisabled}
                                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${isCompleteDisabled
                                    ? 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-1 hover:shadow-blue-600/30'
                                }`}
                            >
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                Complete Setup
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

function RoleCard({ title, desc, active, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all hover:-translate-y-1 ${active
                ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-md'
            }`}
        >
            <h3 className={`font-black text-sm md:text-base ${active ? 'text-blue-900' : 'text-gray-900'}`}>{title}</h3>
            <p className="text-[11px] md:text-xs text-gray-500 mt-2 leading-relaxed font-bold">{desc}</p>
            {active && <div className="mt-3 flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-600"><Check size={12} strokeWidth={4} /> Selected</div>}
        </div>
    );
}
