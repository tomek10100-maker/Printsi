'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Home, Plus, Trash2, Edit3, Check, X, Loader2,
    Layers, ChevronLeft, Archive, ArchiveRestore,
    Info, Eye, EyeOff
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PLASTIC_TYPES = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'NYLON', 'PLA+', 'RESIN', 'OTHER'];

const COLOR_PRESETS = [
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Jet Black', hex: '#1A1A1A' },
    { name: 'Fiery Red', hex: '#E63946' },
    { name: 'Ocean Blue', hex: '#3A86FF' },
    { name: 'Forest Green', hex: '#2DC653' },
    { name: 'Sunburst Yellow', hex: '#FFD60A' },
    { name: 'Neon Orange', hex: '#FF6B35' },
    { name: 'Lavender', hex: '#C8B6E2' },
    { name: 'Sky Cyan', hex: '#48CAE4' },
    { name: 'Hot Pink', hex: '#FF006E' },
    { name: 'Gold', hex: '#FFD700' },
    { name: 'Silver', hex: '#C0C0C0' },
    { name: 'Copper', hex: '#B87333' },
    { name: 'Translucent', hex: '#E8F4FD' },
    { name: 'Glow Green', hex: '#39FF14' },
    { name: 'Deep Purple', hex: '#6A0DAD' },
    { name: 'Slate Gray', hex: '#708090' },
    { name: 'Cream', hex: '#FFFDD0' },
    { name: 'Wood Brown', hex: '#A0522D' },
    { name: 'Navy', hex: '#003153' },
];

function hexToName(hex: string): string {
    const preset = COLOR_PRESETS.find(p => p.hex.toLowerCase() === hex.toLowerCase());
    return preset?.name || 'Custom Color';
}

function isLight(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

type Filament = {
    id: string;
    plastic_type: string;
    color_name: string;
    color_hex: string;
    brand: string | null;
    price_per_gram: number;
    price_unit: string;
    stock_grams: number | null;
    is_active: boolean;
    created_at: string;
};

type FormState = {
    plastic_type: string;
    color_name: string;
    color_hex: string;
    brand: string;
    price_input: string;
    price_unit: 'kg' | 'g';
    price_type: 'fixed' | 'percent';
    stock_grams: string;
};

const emptyForm = (): FormState => ({
    plastic_type: 'PLA',
    color_name: '',
    color_hex: '#3A86FF',
    brand: '',
    price_input: '',
    price_unit: 'kg',
    price_type: 'fixed',
    stock_grams: '',
});

export default function FilamentsPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm());
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showPriceInfo, setShowPriceInfo] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const { currency, rates, formatPrice } = useCurrency();

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/login'); return; }

            const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
            if (!profile?.roles?.includes('printer')) { router.push('/profile'); return; }

            setUser(user);
            await fetchFilaments(user.id);
            setLoading(false);
        };
        init();
    }, [router]);

    const fetchFilaments = async (uid: string) => {
        const { data } = await supabase
            .from('filaments')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });
        setFilaments(data || []);
    };

    const handleColorPreset = (hex: string, name: string) => {
        // Always update both color AND name when clicking a preset swatch
        setForm(f => ({ ...f, color_hex: hex, color_name: name }));
    };

    const handleHexInput = (val: string) => {
        const clean = val.startsWith('#') ? val : '#' + val;
        setForm(f => ({
            ...f,
            color_hex: clean,
            color_name: f.color_name || hexToName(clean)
        }));
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (f: Filament) => {
        const displayPrice = f.price_unit === 'kg'
            ? (f.price_per_gram * 1000).toFixed(2)
            : f.price_per_gram.toFixed(4);
        setEditingId(f.id);
        setForm({
            plastic_type: f.plastic_type,
            color_name: f.color_name,
            color_hex: f.color_hex,
            brand: f.brand || '',
            price_input: displayPrice,
            price_unit: f.price_unit as 'kg' | 'g',
            price_type: 'fixed',
            stock_grams: f.stock_grams?.toString() || '',
        });
        setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.color_name || !form.price_input || !user) return;
        setSaving(true);

        const raw = parseFloat(form.price_input);
        // Convert from user's display currency to EUR for storage
        const rate = (currency !== 'EUR' && rates && rates[currency]) ? rates[currency] : 1;
        const rawInEUR = raw / rate;
        const pricePerGram = form.price_unit === 'kg' ? rawInEUR / 1000 : rawInEUR;

        const payload = {
            user_id: user.id,
            plastic_type: form.plastic_type,
            color_name: form.color_name,
            color_hex: form.color_hex.startsWith('#') ? form.color_hex : '#' + form.color_hex,
            brand: form.brand || null,
            price_per_gram: pricePerGram,
            price_unit: form.price_unit,
            stock_grams: form.stock_grams ? parseFloat(form.stock_grams) : null,
            is_active: true,
        };

        if (editingId) {
            await supabase.from('filaments').update(payload).eq('id', editingId);
        } else {
            await supabase.from('filaments').insert(payload);
        }

        await fetchFilaments(user.id);
        setShowForm(false);
        setEditingId(null);
        setSaving(false);
    };

    const handleToggleActive = async (id: string, current: boolean) => {
        await supabase.from('filaments').update({ is_active: !current }).eq('id', id);
        await fetchFilaments(user.id);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this filament permanently?')) return;
        await supabase.from('filaments').delete().eq('id', id);
        await fetchFilaments(user.id);
    };

    const visible = filaments.filter(f => showArchived ? !f.is_active : f.is_active);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Loader2 className="animate-spin text-blue-600" size={36} />
        </div>
    );

    return (
        <main className="min-h-screen bg-gray-50 font-sans">

            {/* HEADER */}
            <div className="bg-gradient-to-r from-orange-500 to-pink-600 px-6 py-10 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }} />
                <div className="max-w-4xl mx-auto relative">
                    <div className="flex items-center gap-3 mb-4">
                        <Link href="/profile" className="text-white/70 hover:text-white transition flex items-center gap-1 text-sm font-bold">
                            <ChevronLeft size={16} /> Profile
                        </Link>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                                <Layers size={28} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white">My Filaments</h1>
                                <p className="text-white/70 text-sm font-medium mt-1">
                                    {filaments.filter(f => f.is_active).length} active · {filaments.filter(f => !f.is_active).length} archived
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={openAdd}
                            className="flex items-center gap-2 px-5 py-3 bg-white text-orange-600 font-black rounded-xl shadow-lg hover:scale-105 transition-all text-sm"
                        >
                            <Plus size={18} /> Add Filament
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">

                {/* FILTERS */}
                <div className="flex items-center justify-between mb-6">
                    <p className="text-gray-500 text-sm font-medium">
                        {visible.length === 0 ? 'No filaments yet' : `Showing ${visible.length} filament${visible.length !== 1 ? 's' : ''}`}
                    </p>
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all border-2 ${showArchived ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        {showArchived ? <><Eye size={14} /> Active</> : <><Archive size={14} /> Archived</>}
                    </button>
                </div>

                {/* EMPTY STATE */}
                {visible.length === 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
                        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Layers size={36} className="text-orange-400" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">
                            {showArchived ? 'No archived filaments' : 'No filaments added yet'}
                        </h3>
                        <p className="text-gray-500 font-medium text-sm mb-6">
                            {showArchived ? 'Archive filaments to hide them from your listings.' : 'Add your first filament to start using smart pricing.'}
                        </p>
                        {!showArchived && (
                            <button onClick={openAdd} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-black hover:bg-orange-600 transition-all shadow-md">
                                Add First Filament
                            </button>
                        )}
                    </div>
                )}

                {/* FILAMENT GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visible.map(fil => (
                        <FilamentCard
                            key={fil.id}
                            filament={fil}
                            onEdit={() => openEdit(fil)}
                            onToggle={() => handleToggleActive(fil.id, fil.is_active)}
                            onDelete={() => handleDelete(fil.id)}
                        />
                    ))}
                </div>
            </div>

            {/* ADD/EDIT DRAWER */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)} />
                    <div className="relative bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto z-10">

                        {/* Drawer Header */}
                        <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-black text-gray-900">
                                {editingId ? 'Edit Filament' : 'Add Filament'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 pb-8 pt-4 space-y-6">

                            {/* PLASTIC TYPE */}
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Plastic Type</label>
                                <div className="flex flex-wrap gap-2">
                                    {PLASTIC_TYPES.map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, plastic_type: type }))}
                                            className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all ${(type === 'OTHER'
                                                ? !PLASTIC_TYPES.slice(0, -1).includes(form.plastic_type)
                                                : form.plastic_type === type)
                                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                : 'border-gray-200 text-gray-500 hover:border-orange-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                {/* Custom type input – shown when OTHER is selected */}
                                {!PLASTIC_TYPES.slice(0, -1).includes(form.plastic_type) && (
                                    <div className="mt-3">
                                        <input
                                            type="text"
                                            value={form.plastic_type === 'OTHER' ? '' : form.plastic_type}
                                            onChange={e => setForm(f => ({ ...f, plastic_type: e.target.value || 'OTHER' }))}
                                            placeholder="Enter custom plastic type (e.g. CF-Nylon, PEEK...)"
                                            className="w-full p-3 bg-orange-50 border-2 border-orange-300 rounded-xl font-bold text-sm outline-none focus:border-orange-500 transition-all text-orange-900 placeholder:text-orange-300"
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>

                            {/* COLOR */}
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-3">Color</label>

                                {/* Big color preview + name input + hex */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-14 h-14 rounded-2xl border-2 border-gray-200 shadow-md flex-shrink-0"
                                        style={{ backgroundColor: form.color_hex }}
                                    />
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={form.color_name}
                                            onChange={e => setForm(f => ({ ...f, color_name: e.target.value }))}
                                            placeholder="Color name (e.g. Fiery Red)"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-orange-400 transition-all"
                                        />
                                        <p className="text-xs text-gray-400 font-medium mt-1 pl-1">This name is visible on your public profile</p>
                                    </div>
                                </div>

                                {/* Hex row */}
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="flex items-center gap-1 flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 overflow-hidden focus-within:border-orange-400 transition-all">
                                        <span className="text-gray-400 font-bold text-sm">#</span>
                                        <input
                                            type="text"
                                            value={form.color_hex.replace('#', '')}
                                            onChange={e => handleHexInput(e.target.value)}
                                            placeholder="HEX (e.g. FF4500)"
                                            maxLength={6}
                                            className="flex-1 py-3 bg-transparent font-mono font-bold text-sm outline-none uppercase"
                                        />
                                    </div>
                                    <input
                                        type="color"
                                        value={form.color_hex.startsWith('#') && form.color_hex.length === 7 ? form.color_hex : '#3A86FF'}
                                        onChange={e => handleHexInput(e.target.value)}
                                        className="w-11 h-11 rounded-xl border-2 border-gray-200 cursor-pointer overflow-hidden flex-shrink-0"
                                        title="Custom color picker"
                                    />
                                </div>

                                {/* Large Color Palette Grid */}
                                <div className="grid grid-cols-5 gap-2">
                                    {COLOR_PRESETS.map(preset => {
                                        const selected = form.color_hex.toLowerCase() === preset.hex.toLowerCase();
                                        const light = isLight(preset.hex);
                                        return (
                                            <button
                                                key={preset.hex}
                                                type="button"
                                                onClick={() => handleColorPreset(preset.hex, preset.name)}
                                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all hover:scale-105 ${selected
                                                        ? 'border-gray-800 shadow-lg scale-105'
                                                        : 'border-transparent hover:border-gray-300 hover:shadow-md'
                                                    }`}
                                            >
                                                <div
                                                    className="w-full h-10 rounded-lg shadow-sm"
                                                    style={{ backgroundColor: preset.hex }}
                                                />
                                                <span className="text-[9px] font-black text-gray-500 text-center leading-tight truncate w-full">
                                                    {preset.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* BRAND */}
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-2">Brand (optional)</label>
                                <input
                                    type="text"
                                    value={form.brand}
                                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                                    placeholder="e.g. eSUN PLA+ Silk"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-orange-400 transition-all"
                                />
                            </div>

                            {/* PRICE */}
                            <div>
                                {/* Prominent "only for you" notice – always visible */}
                                <div className="mb-3 p-3.5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
                                    <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <EyeOff size={15} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Only visible to you</p>
                                        <p className="text-xs text-amber-700 font-medium mt-0.5">
                                            This is your <strong>filament cost</strong> – customers never see it. It's used to auto-calculate the listing price.
                                        </p>
                                    </div>
                                </div>

                                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-2">
                                    Price per {form.price_unit === 'kg' ? 'kilogram' : 'gram'}
                                </label>

                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">{currency}</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.price_input}
                                            onChange={e => setForm(f => ({ ...f, price_input: e.target.value }))}
                                            placeholder="0.00"
                                            className="w-full p-3 pl-14 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-orange-400 transition-all"
                                        />
                                    </div>
                                    <div className="flex rounded-xl overflow-hidden border-2 border-gray-200">
                                        {(['kg', 'g'] as const).map(unit => (
                                            <button
                                                key={unit}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, price_unit: unit }))}
                                                className={`px-4 py-2 font-black text-sm transition-all ${form.price_unit === unit
                                                    ? 'bg-orange-500 text-white'
                                                    : 'bg-white text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                /{unit}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Live calculation */}
                                {form.price_input && !isNaN(parseFloat(form.price_input)) && (() => {
                                    const pricePerGramEUR = form.price_unit === 'kg'
                                        ? parseFloat(form.price_input) / 1000
                                        : parseFloat(form.price_input);
                                    const rate = (currency !== 'EUR' && rates && rates[currency]) ? rates[currency] : 1;
                                    const pricePerGramEURActual = pricePerGramEUR / rate;
                                    return (
                                        <p className="text-xs text-gray-500 font-medium mt-2 pl-1">
                                            = <strong>{formatPrice(pricePerGramEURActual * 1000)}/kg</strong> · stored as {pricePerGramEURActual.toFixed(6)} EUR/g
                                        </p>
                                    );
                                })()}
                            </div>

                            {/* STOCK (optional) */}
                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-2">Stock (optional)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={form.stock_grams}
                                        onChange={e => setForm(f => ({ ...f, stock_grams: e.target.value }))}
                                        placeholder="e.g. 500"
                                        className="w-full p-3 pr-16 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-orange-400 transition-all"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">grams</span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium mt-1 pl-1">Track how much filament you have left</p>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-black hover:border-gray-300 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || !form.color_name || !form.price_input}
                                    className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-black hover:bg-orange-600 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                    {editingId ? 'Save Changes' : 'Add Filament'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

function FilamentCard({ filament, onEdit, onToggle, onDelete }: {
    filament: Filament;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const light = isLight(filament.color_hex);
    // price_per_gram is always stored in EUR – use formatPrice to convert
    const { formatPrice } = useCurrency();
    const displayPrice = filament.price_unit === 'kg'
        ? `${formatPrice(filament.price_per_gram * 1000)}/kg`
        : `${formatPrice(filament.price_per_gram * 1000)}/kg`; // always show per kg for readability

    return (
        <div className={`relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group ${!filament.is_active ? 'opacity-60' : ''}`}>
            {/* Color stripe */}
            <div
                className="h-3 w-full"
                style={{ backgroundColor: filament.color_hex }}
            />

            <div className="p-5">
                <div className="flex items-start gap-4">
                    {/* Color swatch */}
                    <div
                        className="w-14 h-14 rounded-xl shadow-md flex-shrink-0 flex items-center justify-center text-[10px] font-black"
                        style={{
                            backgroundColor: filament.color_hex,
                            color: light ? '#1a1a1a' : '#ffffff',
                        }}
                    >
                        {filament.plastic_type}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-gray-900 text-base">{filament.color_name}</h3>
                            {!filament.is_active && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase rounded-full">Archived</span>
                            )}
                        </div>
                        {filament.brand && (
                            <p className="text-xs text-gray-500 font-medium">{filament.brand}</p>
                        )}
                        <p className="text-sm font-bold text-gray-700 mt-1">{filament.plastic_type}</p>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-bold">{displayPrice}</span>
                            <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                <EyeOff size={10} /> hidden for customer
                            </span>
                        </div>

                        {filament.stock_grams !== null && (
                            <p className="text-xs text-gray-400 font-medium mt-1">
                                Stock: <strong className="text-gray-700">{filament.stock_grams}g</strong>
                                {filament.stock_grams < 100 && <span className="ml-1 text-red-500">⚠ Low</span>}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={onEdit}
                        className="flex-1 py-2 text-xs font-black text-gray-600 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-1"
                    >
                        <Edit3 size={12} /> Edit
                    </button>
                    <button
                        onClick={onToggle}
                        className="flex-1 py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 text-orange-600 hover:bg-orange-50"
                    >
                        {filament.is_active ? <><Archive size={12} /> Archive</> : <><ArchiveRestore size={12} /> Restore</>}
                    </button>
                    <button
                        onClick={onDelete}
                        className="flex-1 py-2 text-xs font-black text-red-500 rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-1"
                    >
                        <Trash2 size={12} /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
