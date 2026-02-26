'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useCurrency } from '../../context/CurrencyContext';
import { Globe, User, Shield, Check, ChevronRight, ChevronLeft, Loader2, Coins } from 'lucide-react';
import { DHL_COUNTRIES } from '../lib/dhlRates';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CURRENCIES = [
    { code: 'EUR', label: '🇪🇺 Euro (€)' },
    { code: 'USD', label: '🇺🇸 US Dollar ($)' },
    { code: 'GBP', label: '🇬🇧 British Pound (£)' },
    { code: 'PLN', label: '🇵🇱 Polski Złoty (zł)' },
    { code: 'CHF', label: '🇨🇭 Swiss Franc (CHF)' },
    { code: 'SEK', label: '🇸🇪 Swedish Krona (kr)' },
    { code: 'NOK', label: '🇳🇴 Norwegian Krone (kr)' },
    { code: 'DKK', label: '🇩🇰 Danish Krone (kr)' },
    { code: 'CZK', label: '🇨🇿 Czech Koruna (Kč)' },
    { code: 'HUF', label: '🇭🇺 Hungarian Forint (Ft)' },
    { code: 'RON', label: '🇷🇴 Romanian Leu (lei)' },
    { code: 'BGN', label: '🇧🇬 Bulgarian Lev (лв)' },
    { code: 'ISK', label: '🇮🇸 Icelandic Króna (kr)' },
    { code: 'RSD', label: '🇷🇸 Serbian Dinar (din)' },
    { code: 'BAM', label: '🇧🇦 Bosnian Mark (KM)' },
    { code: 'MKD', label: '🇲🇰 Macedonian Denar (ден)' },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { setCurrency, rates } = useCurrency();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [step, setStep] = useState(1);

    // Step 1: Basic
    const [fullName, setFullName] = useState('');

    // Step 2: Roles
    const [roles, setRoles] = useState<string[]>([]);

    // Step 3: Localization
    const [country, setCountry] = useState('PL'); // Default
    const [localCurrency, setLocalCurrency] = useState('EUR');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.push('/login');
                return;
            }
            const user = session.user;
            setUser(user);

            // Handle potential error if profile doesn't exist yet (which is normal for a brand new user)
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('roles, full_name')
                .eq('id', user.id)
                .single();

            // If profile exists AND has roles, redirect away
            if (profile && profile.roles && profile.roles.length > 0) {
                router.push('/');
            } else {
                // Otherwise user stays on the onboarding page
                if (profile?.full_name) {
                    setFullName(profile.full_name);
                }
                setLoading(false);
            }
        };
        init();
    }, [router]);

    const toggleRole = (role: string) => {
        let newRoles = [...roles];
        if (role === 'business') newRoles = newRoles.filter(r => r !== 'hobbyist');
        else if (role === 'hobbyist') newRoles = newRoles.filter(r => r !== 'business');

        if (newRoles.includes(role)) setRoles(newRoles.filter(r => r !== role));
        else setRoles([...newRoles, role]);
    };

    const handleComplete = async () => {
        setSaving(true);
        try {
            // Zapisz profil
            const { error } = await supabase.from('profiles').upsert({
                id: user.id,
                full_name: fullName || 'New User',
                roles: roles.length > 0 ? roles : ['customer'], // Wyrównanie min. 1 roli
                country: country, // Opcjonalnie do tabeli profiles jeśli takowa kolumna istnieje
                updated_at: new Date(),
            });

            if (error) throw error;

            // Zapisz walutę w context
            setCurrency(localCurrency as any);

            router.push('/');
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

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

            {/* BACKGROUND DECORATION */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-100/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">

                {/* HEADER */}
                <div className="text-center mb-10">
                    <div className="inline-block bg-blue-100 text-blue-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                        Welcome to Printsi
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Let's set up your account.</h1>
                    <p className="text-gray-500 mt-2 font-medium">It only takes a minute to personalize your experience.</p>
                </div>

                {/* PROGRESS BAR */}
                <div className="flex gap-2 mb-8">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className={`h-2 flex-1 rounded-full transition-all duration-500 ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    ))}
                </div>

                {/* CARD CONTAINER */}
                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 transition-all duration-500 relative">

                    {/* STEP 1: ABOUT YOU */}
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

                    {/* STEP 2: ROLES */}
                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="flex items-center gap-3 mb-6 text-gray-900">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Shield size={24} /></div>
                                <h2 className="text-2xl font-black uppercase">Choose Your Roles</h2>
                            </div>

                            <p className="text-gray-500 mb-6 font-medium">Select all that apply. This helps us tailor the marketplace to your needs.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <RoleCard title="Customer" desc="I want to buy products." active={roles.includes('customer')} onClick={() => toggleRole('customer')} />
                                <RoleCard title="CAD Designer" desc="I want to sell 3D models." active={roles.includes('designer')} onClick={() => toggleRole('designer')} />
                                <RoleCard title="3D Printer" desc="I offer printing services." active={roles.includes('printer')} onClick={() => toggleRole('printer')} />
                                <RoleCard title="Business / Studio" desc="I represent a company." active={roles.includes('business')} onClick={() => toggleRole('business')} />
                                <RoleCard title="Hobbyist / Maker" desc="I do this for fun." active={roles.includes('hobbyist')} onClick={() => toggleRole('hobbyist')} />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PREFERENCES */}
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
                                        <select
                                            value={country}
                                            onChange={e => setCountry(e.target.value)}
                                            className="w-full p-4 pl-12 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            {DHL_COUNTRIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Preferred Currency</label>
                                    <div className="relative">
                                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <select
                                            value={localCurrency}
                                            onChange={e => setLocalCurrency(e.target.value)}
                                            className="w-full p-4 pl-12 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            {CURRENCIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.label}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* NAVIGATION BUTTONS */}
                <div className="flex justify-between items-center mt-8">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="flex items-center gap-2 text-gray-400 hover:text-gray-900 font-bold px-4 py-2 transition-colors uppercase text-xs tracking-widest"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : <div />}

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && !fullName.trim()}
                            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl transition-all ${step === 1 && !fullName.trim() ? 'bg-gray-100 text-gray-400 shadow-none' : 'bg-gray-900 text-white hover:bg-blue-600 hover:-translate-y-1 hover:shadow-blue-600/20'
                                }`}
                        >
                            Next Step <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleComplete}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 hover:-translate-y-1 hover:shadow-blue-600/30 transition-all disabled:opacity-70"
                        >
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                            Complete Setup
                        </button>
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
