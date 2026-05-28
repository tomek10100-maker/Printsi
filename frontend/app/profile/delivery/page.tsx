'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Truck, Globe, Loader2, Info, Check, PackageOpen } from 'lucide-react';
import { DHL_COUNTRIES } from '../../lib/dhlRates';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COURIERS = [
    { id: 'InPost', name: 'InPost Paczkomat / Courier', icon: '🟡' },
    { id: 'DPD', name: 'DPD Pickup / Courier', icon: '🔴' },
    { id: 'DHL', name: 'DHL POP / Courier', icon: '🟡' },
    { id: 'Orlen', name: 'Orlen Paczka', icon: '🔴' },
];

export default function DeliverySettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);

    const [shipFromCountry, setShipFromCountry] = useState('Poland');
    const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
    const [freeShippingThreshold, setFreeShippingThreshold] = useState('0');
    const [disabledCouriers, setDisabledCouriers] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }
            setUser(user);

            const { data: profile } = await supabase
                .from('profiles')
                .select('country, free_shipping_enabled, free_shipping_threshold, disabled_couriers')
                .eq('id', user.id)
                .single();

            if (profile) {
                setShipFromCountry(profile.country || 'Poland');
                setFreeShippingEnabled(profile.free_shipping_enabled || false);
                setFreeShippingThreshold(profile.free_shipping_threshold?.toString() || '0');
                setDisabledCouriers(profile.disabled_couriers || []);
            }

            setLoading(false);
        };
        fetchData();
    }, [router]);

    const toggleCourier = (courierId: string) => {
        setDisabledCouriers(prev => {
            const isCurrentlyDisabled = prev.includes(courierId);
            let newDisabled: string[];

            if (isCurrentlyDisabled) {
                newDisabled = prev.filter(id => id !== courierId);
            } else {
                newDisabled = [...prev, courierId];
            }

            // Ensure at least one courier remains active
            if (newDisabled.length >= COURIERS.length) {
                alert('You must have at least one active courier.');
                return prev;
            }

            return newDisabled;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .update({ 
                country: shipFromCountry,
                free_shipping_enabled: freeShippingEnabled,
                free_shipping_threshold: parseFloat(freeShippingThreshold) || 0,
                disabled_couriers: disabledCouriers,
                updated_at: new Date() 
            })
            .eq('id', user.id);

        if (error) {
            alert('Error saving: ' + error.message);
        } else {
            alert('✅ Delivery settings saved!');
            router.push('/profile');
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-600" />
        </div>
    );

    return (
        <main className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-6">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors shadow-sm">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black uppercase text-gray-900 tracking-tight">Delivery Settings</h1>
                        <p className="text-gray-500 text-sm font-medium">Configure shipping options for your buyers.</p>
                    </div>
                </div>

                {/* Main Form container */}
                <div className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-8 relative z-10">

                    {/* Ship From */}
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
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] font-medium text-gray-400 mt-2 ml-1">This determines whether shipping is calculated as domestic or cross-border.</p>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Free Shipping */}
                    <div className={`border-2 rounded-2xl p-5 sm:p-6 transition-all ${freeShippingEnabled ? 'border-blue-500/50 bg-blue-50/30 shadow-md shadow-blue-500/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                            <div>
                                <label className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2 mb-1">
                                    <PackageOpen size={18} className={freeShippingEnabled ? 'text-blue-600' : 'text-gray-400'} /> 
                                    Free Shipping Threshold
                                </label>
                                <p className="text-xs font-medium text-gray-500 max-w-sm mt-1">
                                    Offering free shipping makes your items more attractive and increases sales. 
                                    <strong className="text-gray-700 block mt-1">Please note: The shipping cost will be deducted from your profit.</strong>
                                </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 mt-4 sm:mt-0 bg-gray-50 border border-gray-200 p-2 rounded-xl">
                                <span className={`text-xs font-black uppercase tracking-widest w-8 text-right ${freeShippingEnabled ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {freeShippingEnabled ? 'ON' : 'OFF'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={freeShippingEnabled} onChange={e => setFreeShippingEnabled(e.target.checked)} />
                                    {/* High-contrast toggle switch */}
                                    <div className="w-14 h-8 bg-gray-300 border border-gray-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-blue-600 peer-checked:border-blue-700 shadow-inner"></div>
                                </label>
                            </div>
                        </div>
                        
                        <div className={`transition-all duration-300 overflow-hidden ${freeShippingEnabled ? 'max-h-[300px] opacity-100 mt-5' : 'max-h-0 opacity-0 mt-0'}`}>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-4">
                                <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                    <strong>How it works:</strong> If a buyer's order from you exceeds the amount below, they get free shipping. 
                                    <strong> The shipping cost will be deducted directly from your final profit payout.</strong>
                                </p>
                            </div>

                            <div className="flex flex-col">
                                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Minimum Order Value</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={freeShippingThreshold} 
                                        onChange={e => setFreeShippingThreshold(e.target.value)}
                                        className="w-full p-4 pl-12 bg-white border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl font-black text-blue-900 outline-none transition-all text-xl shadow-sm"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-black">PLN</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Supported Couriers */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                            <Truck size={14} /> Supported Couriers
                        </label>
                        <p className="text-xs text-gray-500 mb-4 font-medium">Uncheck couriers you do not want to use. Buyers will not see options for disabled couriers. At least one must be active.</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {COURIERS.map(courier => {
                                const isActive = !disabledCouriers.includes(courier.id);
                                return (
                                    <button
                                        key={courier.id}
                                        onClick={() => toggleCourier(courier.id)}
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                                            isActive 
                                            ? 'border-blue-600 bg-blue-50 shadow-sm' 
                                            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">{courier.icon}</span>
                                            <span className={`font-bold text-sm ${isActive ? 'text-blue-900' : 'text-gray-500'}`}>{courier.name}</span>
                                        </div>
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                                            isActive ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                                        }`}>
                                            {isActive && <Check size={14} className="text-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>
                
                {/* Save button floating at bottom */}
                <div className="sticky bottom-6 z-20">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Changes</>}
                    </button>
                </div>

            </div>
        </main>
    );
}
