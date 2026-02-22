'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Truck, Globe, Loader2, Package, Info } from 'lucide-react';
import { DHL_COUNTRIES, countryNameToCode } from '../../lib/dhlRates';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DeliverySettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [shipFromCountry, setShipFromCountry] = useState('Poland');

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }
            setUser(user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('country')
                .eq('id', user.id)
                .single();

            if (profile?.country) {
                // If stored as country name, use it; default to Poland
                setShipFromCountry(profile.country || 'Poland');
            }

            setLoading(false);
        };
        fetchData();
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .update({ country: shipFromCountry, updated_at: new Date() })
            .eq('id', user.id);

        if (error) {
            alert('Error saving: ' + error.message);
        } else {
            alert('✅ Ship-from country saved!');
            router.push('/profile');
        }
        setSaving(false);
    };

    const selectedCountry = DHL_COUNTRIES.find(c => c.name === shipFromCountry);
    const selectedCode = countryNameToCode(shipFromCountry);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" />
        </div>
    );

    return (
        <main className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-6">
            <div className="max-w-2xl mx-auto">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black uppercase text-gray-900 tracking-tight">Delivery Settings</h1>
                        <p className="text-gray-500 text-sm font-medium">Set where you ship your products from.</p>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex gap-3">
                    <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-black text-blue-800 text-sm mb-1">How shipping costs are calculated</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            Buyers see the exact DHL shipping cost based on <strong>your location → their location</strong>.
                            A buyer in Germany ordering from a German seller pays domestic rates.
                            A buyer in France ordering from a Polish seller pays cross-border rates.
                        </p>
                    </div>
                </div>

                {/* Selector */}
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                            <Globe size={14} /> I ship my products from:
                        </label>
                        <select
                            value={shipFromCountry}
                            onChange={(e) => setShipFromCountry(e.target.value)}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
                        >
                            {DHL_COUNTRIES.map(c => (
                                <option key={c.code} value={c.name}>
                                    {c.name} ({c.deliveryDays} day delivery to nearby EU)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Preview */}
                    {selectedCountry && (
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                            <p className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3 flex items-center gap-2">
                                <Package size={14} /> DHL Rate Preview from {selectedCountry.name}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {[
                                    { label: 'Same country (domestic)', rate: null, note: 'lower rate' },
                                    { label: 'To Germany', rate: selectedCode === 'DE' ? 'domestic' : '≈ ' + DHL_COUNTRIES.find(c => c.code === 'DE')?.rates.upTo5kg.toFixed(2) + ' PLN / 5kg', note: '' },
                                    { label: 'To France', rate: selectedCode === 'FR' ? 'domestic' : '≈ ' + DHL_COUNTRIES.find(c => c.code === 'FR')?.rates.upTo5kg.toFixed(2) + ' PLN / 5kg', note: '' },
                                    { label: 'To Italy', rate: selectedCode === 'IT' ? 'domestic' : '≈ ' + DHL_COUNTRIES.find(c => c.code === 'IT')?.rates.upTo5kg.toFixed(2) + ' PLN / 5kg', note: '' },
                                ].map((row, i) => (
                                    <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide">{row.label}</p>
                                        <p className="font-black text-gray-900 text-sm mt-1">
                                            {row.rate || 'Discounted domestic'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 font-medium">
                                * Domestic delivery uses local carrier rates. Cross-border uses DHL Parcel Connect.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Settings</>}
                    </button>
                </div>

                {/* DHL Rate Table */}
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mt-6">
                    <h3 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                        <Truck size={18} className="text-blue-600" /> Full DHL Rate Table (PLN)
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-2 text-gray-400 font-black uppercase tracking-wide">Country</th>
                                    <th className="text-right py-2 text-gray-400 font-black uppercase tracking-wide">Days</th>
                                    <th className="text-right py-2 text-gray-400 font-black uppercase tracking-wide">≤5kg</th>
                                    <th className="text-right py-2 text-gray-400 font-black uppercase tracking-wide">≤10kg</th>
                                    <th className="text-right py-2 text-gray-400 font-black uppercase tracking-wide">≤20kg</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DHL_COUNTRIES.map(c => (
                                    <tr
                                        key={c.code}
                                        className={`border-b border-gray-50 ${c.name === shipFromCountry ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="py-2 font-bold text-gray-900">
                                            {c.name === shipFromCountry && <span className="text-blue-600 mr-1">📍</span>}
                                            {c.name}
                                        </td>
                                        <td className="text-right text-gray-500">{c.deliveryDays}</td>
                                        <td className="text-right text-gray-900 font-bold">{c.name === shipFromCountry ? '~15' : c.rates.upTo5kg.toFixed(0)}</td>
                                        <td className="text-right text-gray-900 font-bold">{c.name === shipFromCountry ? '~20' : c.rates.upTo10kg.toFixed(0)}</td>
                                        <td className="text-right text-gray-900 font-bold">{c.name === shipFromCountry ? '~30' : c.rates.upTo20kg.toFixed(0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3">Your country (📍) shows domestic rates. Other countries show cross-border rates.</p>
                </div>

            </div>
        </main>
    );
}
