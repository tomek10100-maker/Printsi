'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, FileText, Image as ImageIcon, Box, Layers, Printer,
  X, Trash2, ChevronDown, EyeOff, Calculator, Zap, Settings2,
  Wrench, Plus, Minus, Palette, ChevronUp
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

const BUCKET_NAME = 'printsi-files1';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Filament = {
  id: string;
  plastic_type: string;
  color_name: string;
  color_hex: string;
  brand: string | null;
  price_per_gram: number; // stored in EUR
  stock_grams: number | null;
};

type FilamentLayer = {
  layerId: string;
  filament: Filament | null;
  grams: string;
};

type ColorVariant = {
  variantId: string;
  layers: FilamentLayer[];
  markupType: 'percent' | 'fixed';
  markupValue: string;
  stock: string;
  expanded: boolean;
  openDropdownLayerId: string | null;
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);

const defaultVariant = (): ColorVariant => ({
  variantId: uid(),
  layers: [{ layerId: uid(), filament: null, grams: '' }],
  markupType: 'percent',
  markupValue: '',
  stock: '1',
  expanded: true,
  openDropdownLayerId: null,
});

/**
 * Format a number (EUR) to local currency string WITHOUT using formatPrice,
 * so we can control rounding and avoid 59.99 drift.
 * price_per_gram and total prices are stored in EUR.
 */
function toLocalDisplay(eurAmount: number, currency: string, rates: Record<string, number> | null): string {
  const converted = currency !== 'EUR' && rates?.[currency]
    ? eurAmount * rates[currency]
    : eurAmount;
  // Use standard rounding (not ceil) for display consistency
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(converted * 100) / 100);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AddOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { currency, rates, formatPrice } = useCurrency();

  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('digital');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [pricingMode, setPricingMode] = useState<'auto' | 'manual'>('auto');

  // Common
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);

  // Manual mode
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualWeight, setManualWeight] = useState('');
  const [manualPriceLocal, setManualPriceLocal] = useState('');
  const [manualStock, setManualStock] = useState('1');

  // Auto mode
  const [myFilaments, setMyFilaments] = useState<Filament[]>([]);
  const [variants, setVariants] = useState<ColorVariant[]>([defaultVariant()]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      if (profile?.roles) {
        setUserRoles(profile.roles);
        if (profile.roles.includes('printer')) {
          const { data: fils } = await supabase.from('filaments').select('*')
            .eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
          setMyFilaments(fils || []);
        }
      }
    });
  }, [router]);

  // ─── PRICE CALC ─────────────────────────────────────────────────────────────
  // All in EUR — convert only for display. Never use rates in computation.
  const computeVariantEUR = useCallback((v: ColorVariant): { materialEUR: number; markupEUR: number; totalEUR: number } | null => {
    let materialEUR = 0;
    for (const layer of v.layers) {
      if (!layer.filament || !layer.grams) return null;
      const g = parseFloat(layer.grams);
      if (isNaN(g) || g <= 0) return null;
      materialEUR += g * layer.filament.price_per_gram;
    }
    const mv = parseFloat(v.markupValue);
    let markupEUR = 0;
    if (!isNaN(mv) && mv > 0) {
      if (v.markupType === 'percent') {
        markupEUR = materialEUR * (mv / 100);
      } else {
        // Fixed amount entered in local currency → convert to EUR once
        markupEUR = (currency !== 'EUR' && rates?.[currency]) ? mv / rates[currency] : mv;
      }
    }
    return { materialEUR, markupEUR, totalEUR: materialEUR + markupEUR };
  }, [currency, rates]);

  const manualPriceEUR: number | null = (() => {
    const n = parseFloat(manualPriceLocal);
    if (isNaN(n) || n <= 0) return null;
    return (currency !== 'EUR' && rates?.[currency]) ? n / rates[currency] : n;
  })();

  // ─── IMAGE HELPERS ───────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (newFiles.length + previewImages.length > 6) { alert('Max 6 photos.'); return; }
      setPreviewImages(prev => [...prev, ...newFiles]);
    }
  };
  const removeImage = (i: number) => setPreviewImages(prev => prev.filter((_, idx) => idx !== i));

  // ─── VARIANT MUTATIONS ────────────────────────────────────────────────────────
  const updateVariant = (variantId: string, patch: Partial<ColorVariant>) =>
    setVariants(prev => prev.map(v => v.variantId === variantId ? { ...v, ...patch } : v));

  const updateLayer = (variantId: string, layerId: string, patch: Partial<FilamentLayer>) =>
    setVariants(prev => prev.map(v => {
      if (v.variantId !== variantId) return v;
      return { ...v, layers: v.layers.map(l => l.layerId === layerId ? { ...l, ...patch } : l) };
    }));

  const addLayer = (variantId: string) =>
    setVariants(prev => prev.map(v =>
      v.variantId === variantId
        ? { ...v, layers: [...v.layers, { layerId: uid(), filament: null, grams: '' }] }
        : v
    ));

  const removeLayer = (variantId: string, layerId: string) =>
    setVariants(prev => prev.map(v =>
      v.variantId === variantId
        ? { ...v, layers: v.layers.filter(l => l.layerId !== layerId) }
        : v
    ));

  const addVariant = () => setVariants(prev => [
    ...prev.map(v => ({ ...v, expanded: false })),
    defaultVariant(),
  ]);

  const removeVariant = (variantId: string) =>
    setVariants(prev => prev.length > 1 ? prev.filter(v => v.variantId !== variantId) : prev);

  // ─── SUBMIT ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { alert('Title is required.'); return; }
    if (category !== 'job' && previewImages.length === 0) { alert('Please upload at least 1 photo.'); return; }
    if (category === 'digital' && !projectFile) { alert('3D File is required for digital items.'); return; }
    if (!user?.id) return;

    if (category === 'physical') {
      if (!dimensions.trim()) { alert('Dimensions are required.'); return; }
      if (pricingMode === 'auto') {
        for (const v of variants) {
          if (!computeVariantEUR(v)) { alert('Complete all filament & weight fields in every variant.'); return; }
        }
      } else {
        if (!manualPriceLocal) { alert('Price is required.'); return; }
      }
    } else {
      if (!manualPriceLocal) { alert('Price is required.'); return; }
    }

    setLoading(true);
    try {
      let projUrl: string | null = null;
      let imageUrls: string[] = [];

      if (projectFile) {
        const ext = projectFile.name.split('.').pop();
        const p = `projects/${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, projectFile);
        if (error) throw error;
        projUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl;
      }
      for (const file of previewImages) {
        const ext = file.name.split('.').pop();
        const p = `previews/${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, file);
        if (error) throw error;
        imageUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl);
      }
      if (imageUrls.length === 0 && category === 'job')
        imageUrls.push('https://via.placeholder.com/400x300?text=Print+Request');

      let dbPrice: number,
        dbMaterial: string | null = null,
        dbColor: string | null = null,
        dbColorName: string | null = null,
        dbWeight: string | null = null,
        dbFilamentId: string | null = null,
        dbStock = 1;
      let colorVariantsPayload: any[] | undefined;

      if (category === 'physical' && pricingMode === 'auto') {
        const prices = variants.map(v => computeVariantEUR(v)!);
        dbPrice = Math.min(...prices.map(p => p.totalEUR));
        dbStock = variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
        const fl = variants[0].layers[0];
        dbMaterial = fl.filament?.plastic_type || null;
        dbColor = fl.filament?.color_hex || null;
        dbColorName = fl.filament?.color_name || null;
        dbWeight = variants[0].layers.reduce((s, l) => s + (parseFloat(l.grams) || 0), 0).toString();
        dbFilamentId = fl.filament?.id || null;
        colorVariantsPayload = variants.map((v, i) => ({
          variantId: v.variantId,
          label: v.layers.map(l => l.filament?.color_name || '').filter(Boolean).join(' + ') || `Variant ${i + 1}`,
          color_name: v.layers[0]?.filament?.color_name || null,
          plastic_type: v.layers[0]?.filament?.plastic_type || null,
          layers: v.layers.map(l => ({
            filament_id: l.filament?.id,
            color_hex: l.filament?.color_hex,
            color_name: l.filament?.color_name,
            plastic_type: l.filament?.plastic_type,
            grams: l.grams,
          })),
          priceEUR: prices[i].totalEUR,
          markupType: v.markupType,
          markupValue: v.markupValue,
          stock: parseInt(v.stock) || 0,
          primaryColor: v.layers[0]?.filament?.color_hex || '#888',
          isMultiColor: v.layers.length > 1,
        }));
      } else {
        dbPrice = manualPriceEUR!;
        dbMaterial = manualMaterial || null;
        dbColor = null;
        dbColorName = manualColor || null;
        dbWeight = manualWeight || null;
        dbStock = parseInt(manualStock) || 1;
      }

      // Try insert with color_variants, fall back without if column missing
      const basePayload = {
        title, description, price: dbPrice, category,
        material: dbMaterial, color: dbColor, color_name: dbColorName,
        weight: dbWeight, dimensions: dimensions || null,
        stock: dbStock, file_url: projUrl,
        image_url: imageUrls[0] || null, image_urls: imageUrls,
        user_id: user.id, filament_id: dbFilamentId, created_at: new Date(),
      };

      let { error: dbErr } = await supabase.from('offers').insert({
        ...basePayload,
        ...(colorVariantsPayload ? { color_variants: colorVariantsPayload } : {}),
      });

      // If color_variants column missing, retry without it
      if (dbErr && dbErr.message?.includes('color_variants')) {
        const { error: retryErr } = await supabase.from('offers').insert(basePayload);
        if (retryErr) throw retryErr;
      } else if (dbErr) {
        throw dbErr;
      }

      alert('Success! Your listing has been published.');
      router.push('/gallery');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isPhysicalAuto = category === 'physical' && pricingMode === 'auto';
  const isPrinter = userRoles.includes('printer');

  // Precompute prices
  const variantPrices = variants.map(v => computeVariantEUR(v));
  const validPrices = variantPrices.filter(Boolean) as { materialEUR: number; markupEUR: number; totalEUR: number }[];
  const minPriceEUR = validPrices.length ? Math.min(...validPrices.map(p => p.totalEUR)) : null;
  const maxPriceEUR = validPrices.length ? Math.max(...validPrices.map(p => p.totalEUR)) : null;

  // Pre-display (stable — no ceil drift)
  const fmt = (eur: number) => toLocalDisplay(eur, currency, rates);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center text-gray-900 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <Link href="/" className="absolute top-6 right-6 p-2 z-10 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all">
          <X size={24} />
        </Link>
        <div className="bg-gray-900 p-8 text-white">
          <h1 className="text-3xl font-black uppercase tracking-wide">Create Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium">Configure your new offer step by step.</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">

            {/* 1. TYPE */}
            <section className="space-y-4">
              <SectionLabel step="1" label="Listing Type" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([
                  { key: 'job', label: 'Print Request', Icon: Printer, c: 'blue' },
                  { key: 'digital', label: 'Digital File', Icon: Layers, c: 'purple' },
                  { key: 'physical', label: 'Physical Item', Icon: Box, c: 'orange', req: true },
                ] as const).map(({ key, label, Icon, c, req }) => {
                  const disabled = !!req && !isPrinter;
                  const active = category === key;
                  const ac = { blue: 'border-blue-500 bg-blue-50 text-blue-800', purple: 'border-purple-500 bg-purple-50 text-purple-800', orange: 'border-orange-500 bg-orange-50 text-orange-800' };
                  const hc = { blue: 'hover:border-blue-200', purple: 'hover:border-purple-200', orange: 'hover:border-orange-200' };
                  return (
                    <button key={key} type="button" disabled={disabled}
                      onClick={() => { if (!disabled) { setCategory(key); setPreviewImages([]); } }}
                      className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all relative ${disabled ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : active ? ac[c] : `border-gray-200 text-gray-500 ${hc[c]}`}`}>
                      <Icon size={32} />
                      <span className={`font-black uppercase text-sm ${disabled ? 'mb-4' : ''}`}>{label}</span>
                      {disabled && <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest absolute bottom-3 left-0 right-0 text-center">Printer role required</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* PRICING MODE toggle */}
            {category === 'physical' && isPrinter && (
              <section>
                <SectionLabel step="" label="Pricing Mode" />
                <div className="flex rounded-2xl overflow-hidden border-2 border-gray-200 mt-4">
                  {([
                    { mode: 'auto', label: 'AUTO – Filament Manager', Icon: Settings2 },
                    { mode: 'manual', label: 'MANUAL – Full Control', Icon: Wrench },
                  ] as const).map(({ mode, label, Icon }) => (
                    <button key={mode} type="button" onClick={() => setPricingMode(mode)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-5 transition-all font-black text-sm ${pricingMode === mode ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 2. DETAILS */}
            <section className="space-y-4">
              <SectionLabel step="2" label="Basic Details" />
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
              <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} rows={4}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all resize-none" />
            </section>

            {/* 3. ATTACHMENTS */}
            <section className="space-y-4">
              <SectionLabel step="3" label="Attachments" />
              {category === 'digital' && (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <FileText className={`mb-3 ${projectFile ? 'text-green-600' : 'text-gray-400 group-hover:text-blue-500'}`} size={32} />
                  <span className="text-xs font-black uppercase text-gray-500">{projectFile ? projectFile.name : 'Upload 3D File (.STL)'}</span>
                  <input type="file" className="hidden" accept=".stl,.obj,.3mf,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                </label>
              )}
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                <span className="text-xs font-black uppercase text-gray-500">Upload Photos (Max 6)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              {previewImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewImages.map((file, idx) => (
                    <div key={idx} className="relative h-24 rounded-xl overflow-hidden group">
                      <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. SPECS */}
            <section className="space-y-4">
              <SectionLabel step="4" label="Specs" />
              {category === 'physical' && (
                <input type="text" placeholder="Dimensions (e.g. 15×15×10 cm)" value={dimensions}
                  onChange={e => setDimensions(e.target.value)} required
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all" />
              )}
              {!isPhysicalAuto && (
                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs pointer-events-none">QTY</span>
                    <input type="number" placeholder="1" min="1" value={manualStock} onChange={e => setManualStock(e.target.value)} required
                      className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
                  </div>
                  {category === 'physical' && (
                    <div className="grid grid-cols-3 gap-3">
                      <input type="text" placeholder="Material (PLA…)" value={manualMaterial} onChange={e => setManualMaterial(e.target.value)}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" />
                      <input type="text" placeholder="Color (Red…)" value={manualColor} onChange={e => setManualColor(e.target.value)}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" />
                      <div className="relative">
                        <input type="number" step="any" min="0" placeholder="Weight" value={manualWeight} onChange={e => setManualWeight(e.target.value)}
                          className="w-full p-4 pr-8 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">g</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 5. COLOR VARIANTS (auto physical) */}
            {isPhysicalAuto && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SectionLabel step="5" label="Color Variants" />
                    <p className="text-xs text-gray-400 font-medium mt-1">Each variant = its own filament, price & stock. Add multiple filaments for multi-color prints.</p>
                  </div>
                  <div className="flex -space-x-1 ml-4">
                    {variants.slice(0, 8).map(v => (
                      <div key={v.variantId}
                        className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: v.layers[0]?.filament?.color_hex || '#e5e7eb' }} />
                    ))}
                  </div>
                </div>

                {myFilaments.length === 0 ? (
                  <div className="p-5 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl text-center">
                    <p className="text-sm font-bold text-orange-600 mb-2">No filaments saved yet</p>
                    <Link href="/profile/filaments" className="text-xs font-black text-orange-700 underline">Go to My Filaments →</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* === VARIANT CARDS — inlined to avoid remount/dropdown bug === */}
                    {variants.map((v, vIdx) => {
                      const price = variantPrices[vIdx];
                      const isMulti = v.layers.length > 1;

                      return (
                        <div key={v.variantId} className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
                          {/* Header */}
                          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-all select-none"
                            onClick={() => updateVariant(v.variantId, { expanded: !v.expanded })}>
                            {/* Color swatches */}
                            <div className="flex -space-x-1.5 flex-shrink-0">
                              {v.layers.slice(0, 4).map((l, li) => (
                                <div key={l.layerId}
                                  className="w-8 h-8 rounded-lg border-2 border-white shadow transition-all"
                                  style={{ backgroundColor: l.filament?.color_hex || '#e5e7eb', zIndex: 4 - li }} />
                              ))}
                              {v.layers.length > 4 && (
                                <div className="w-8 h-8 rounded-lg border-2 border-white bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-500">+{v.layers.length - 4}</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-black text-gray-900 text-sm">Variant {vIdx + 1}</p>
                                {isMulti && <span className="text-[9px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Multi-color</span>}
                              </div>
                              <p className="text-xs text-gray-400 font-medium truncate">
                                {v.layers.map(l => l.filament?.color_name || '—').join(' + ')}
                                {price ? ` · ${fmt(price.totalEUR)}` : ' · configure below'}
                                {v.stock ? ` · qty ${v.stock}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {variants.length > 1 && (
                                <button type="button"
                                  onClick={e => { e.stopPropagation(); removeVariant(v.variantId); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {v.expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                            </div>
                          </div>

                          {/* Expanded body */}
                          {v.expanded && (
                            <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/30">
                              {/* Filament layers */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Filaments</span>
                                  <button type="button" onClick={() => addLayer(v.variantId)}
                                    className="flex items-center gap-1 text-xs font-black text-purple-600 hover:text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-50 transition-all">
                                    <Plus size={12} /> Add filament
                                  </button>
                                </div>

                                {v.layers.map((layer) => (
                                  <div key={layer.layerId} className="flex items-stretch gap-2">
                                    {/* Filament selector */}
                                    <div className="flex-1 relative">
                                      <button type="button"
                                        onClick={() => updateVariant(v.variantId, {
                                          openDropdownLayerId: v.openDropdownLayerId === layer.layerId ? null : layer.layerId
                                        })}
                                        className="w-full flex items-center gap-2 p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-orange-400 transition-all text-left">
                                        {layer.filament ? (
                                          <>
                                            <div className="w-6 h-6 rounded-md border flex-shrink-0" style={{ backgroundColor: layer.filament.color_hex }} />
                                            <div className="flex-1 min-w-0">
                                              <p className="font-black text-gray-900 text-xs truncate">{layer.filament.color_name}</p>
                                              {/* Show price_per_gram * 1000 DIRECTLY in EUR without conversion to avoid drift */}
                                              <p className="text-[10px] text-gray-400 truncate">
                                                {layer.filament.plastic_type} · {fmt(layer.filament.price_per_gram * 1000)}/kg
                                              </p>
                                            </div>
                                          </>
                                        ) : (
                                          <span className="text-gray-400 font-bold text-xs flex-1">Select filament…</span>
                                        )}
                                        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                                      </button>

                                      {v.openDropdownLayerId === layer.layerId && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 max-h-52 overflow-y-auto">
                                          {myFilaments.map(fil => (
                                            <button key={fil.id} type="button"
                                              onClick={() => {
                                                updateLayer(v.variantId, layer.layerId, { filament: fil });
                                                updateVariant(v.variantId, { openDropdownLayerId: null });
                                              }}
                                              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-orange-50 transition-all text-left ${layer.filament?.id === fil.id ? 'bg-orange-50' : ''}`}>
                                              <div className="w-5 h-5 rounded-md flex-shrink-0 border" style={{ backgroundColor: fil.color_hex }} />
                                              <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-900 text-xs truncate">{fil.color_name}</p>
                                                <p className="text-[10px] text-gray-400">{fil.plastic_type}</p>
                                              </div>
                                              <span className="text-[10px] font-bold text-gray-500 flex-shrink-0">{fmt(fil.price_per_gram * 1000)}/kg</span>
                                            </button>
                                          ))}
                                          <div className="border-t border-gray-100 mt-1 sticky bottom-0 bg-white">
                                            <Link href="/profile/filaments" className="flex items-center justify-center gap-2 py-3 px-3 text-[11px] font-black text-orange-600 hover:bg-orange-50 transition-all uppercase tracking-wider">
                                              <Settings2 size={14} /> ⚙️ Manage your filaments
                                            </Link>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Grams — use text input to avoid floating point issues */}
                                    <div className="relative w-28 flex-shrink-0">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="0"
                                        value={layer.grams}
                                        onChange={e => {
                                          // Allow only valid decimal input
                                          const val = e.target.value.replace(',', '.');
                                          if (/^\d*\.?\d*$/.test(val)) {
                                            updateLayer(v.variantId, layer.layerId, { grams: val });
                                          }
                                        }}
                                        className="w-full p-3 pr-7 bg-white border-2 border-orange-200 rounded-xl font-black text-sm outline-none focus:border-orange-500 transition-all"
                                      />
                                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orange-400 font-black text-[10px]">g</span>
                                    </div>

                                    {v.layers.length > 1 && (
                                      <button type="button" onClick={() => removeLayer(v.variantId, layer.layerId)}
                                        className="p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                                        <Minus size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Markup + Stock */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Calculator size={12} className="text-blue-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Profit</span>
                                    </div>
                                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px]">
                                      <button type="button" onClick={() => updateVariant(v.variantId, { markupType: 'percent' })}
                                        className={`px-2.5 py-1 font-black transition-all ${v.markupType === 'percent' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>%</button>
                                      <button type="button" onClick={() => updateVariant(v.variantId, { markupType: 'fixed' })}
                                        className={`px-2.5 py-1 font-black transition-all ${v.markupType === 'fixed' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>{currency}</button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-400 font-black">
                                      {v.markupType === 'percent' ? '%' : currency}
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder={v.markupType === 'percent' ? '50' : '10.00'}
                                      value={v.markupValue}
                                      onChange={e => {
                                        const val = e.target.value.replace(',', '.');
                                        if (/^\d*\.?\d*$/.test(val)) updateVariant(v.variantId, { markupValue: val });
                                      }}
                                      className="flex-1 p-2 bg-gray-50 border border-gray-100 rounded-lg font-black text-sm outline-none focus:border-blue-400 transition-all"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1 text-[9px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                                    <EyeOff size={10} className="flex-shrink-0" /> Hidden from customer
                                  </div>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Box size={12} className="text-gray-500" />
                                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Stock (qty)</span>
                                    </div>
                                    {(() => {
                                      // Calculate possible pieces based on stock
                                      let maxPieces = Infinity;
                                      let canCalc = false;
                                      for (const l of v.layers) {
                                        if (l.filament && l.filament.stock_grams !== null && l.grams) {
                                          const g = parseFloat(l.grams);
                                          if (g > 0) {
                                            maxPieces = Math.min(maxPieces, Math.floor(l.filament.stock_grams / g));
                                            canCalc = true;
                                          } else { canCalc = false; break; }
                                        } else { canCalc = false; break; }
                                      }
                                      if (canCalc && maxPieces !== Infinity && maxPieces >= 0) {
                                        return (
                                          <button type="button"
                                            onClick={() => updateVariant(v.variantId, { stock: maxPieces.toString() })}
                                            className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md hover:bg-orange-100 transition-all border border-orange-200 animate-pulse-subtle">
                                            Auto-fill: {maxPieces} pcs
                                          </button>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="1"
                                    value={v.stock}
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (/^\d*$/.test(val)) updateVariant(v.variantId, { stock: val });
                                    }}
                                    className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg font-black text-2xl outline-none focus:border-blue-400 transition-all"
                                  />
                                </div>
                              </div>

                              {/* Price breakdown */}
                              {price && (
                                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                                  <div className="flex justify-between items-center px-3 py-2 text-xs text-gray-500">
                                    <span>Material cost</span>
                                    <span className="font-bold text-gray-800">{fmt(price.materialEUR)}</span>
                                  </div>
                                  {price.markupEUR > 0 && (
                                    <div className="flex justify-between items-center px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                                      <span className="flex items-center gap-1"><EyeOff size={9} className="text-amber-400" /> Your profit</span>
                                      <span className="font-bold text-green-700">+{fmt(price.markupEUR)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center px-3 py-2.5 font-black text-sm bg-gradient-to-r from-blue-50 border-t border-blue-100">
                                    <span className="text-gray-700">Customer pays</span>
                                    <span className="text-blue-700 text-base">{fmt(price.totalEUR)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add variant */}
                    <button type="button" onClick={addVariant}
                      className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                      <Plus size={18} /> Add Color Variant
                    </button>

                    {/* Summary table */}
                    {variants.length > 1 && (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Palette size={14} className="text-blue-600" />
                          <span className="text-xs font-black uppercase text-blue-800 tracking-widest">All Variants Summary</span>
                        </div>
                        <div className="space-y-1.5">
                          {variants.map((v, i) => {
                            const p = variantPrices[i];
                            return (
                              <div key={v.variantId} className="flex items-center gap-2.5 bg-white/70 rounded-xl px-3 py-2">
                                <div className="flex -space-x-0.5">
                                  {v.layers.map(l => (
                                    <div key={l.layerId} className="w-5 h-5 rounded-sm border border-white/60 shadow-sm"
                                      style={{ backgroundColor: l.filament?.color_hex || '#ccc' }} />
                                  ))}
                                </div>
                                <span className="flex-1 text-xs font-bold text-blue-900 truncate">
                                  {v.layers.map(l => l.filament?.color_name || '?').join(' + ')}
                                </span>
                                <span className="text-xs font-black text-blue-800 tabular-nums">{p ? fmt(p.totalEUR) : '—'}</span>
                                <span className="text-[10px] text-blue-500 font-bold">×{v.stock || 0}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* FINAL PRICE */}
            <section>
              <SectionLabel step={isPhysicalAuto ? '6' : '5'} label="Final Price" />
              <div className="mt-3">
                {isPhysicalAuto ? (
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${validPrices.length > 0 ? 'bg-gray-900 border-gray-900' : 'bg-gray-100 border-gray-200'}`}>
                    {validPrices.length > 0 ? (
                      <>
                        {/* Per-variant price list */}
                        <div className="divide-y divide-gray-800">
                          {variants.map((v, i) => {
                            const p = variantPrices[i];
                            const colorName = v.layers.map((l: any) => l.filament?.color_name || '?').join(' + ');
                            return (
                              <div key={v.variantId} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex -space-x-1 flex-shrink-0">
                                  {v.layers.map((l: any) => (
                                    <div key={l.layerId} className="w-5 h-5 rounded border border-gray-700 shadow-sm"
                                      style={{ backgroundColor: l.filament?.color_hex || '#555' }} />
                                  ))}
                                </div>
                                <span className="flex-1 text-sm font-bold text-gray-300 truncate">{colorName || `Variant ${i + 1}`}</span>
                                <span className="text-sm text-gray-400 font-medium">×{v.stock || 0}</span>
                                <span className="text-base font-black text-white tabular-nums">
                                  {p ? fmt(p.totalEUR) : <span className="text-gray-500 text-xs">—</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-800">
                          <Zap size={12} className="text-green-400 fill-green-400 flex-shrink-0" />
                          <p className="text-xs text-green-400 font-bold">
                            {variants.length === 1
                              ? 'Auto-calculated from material + profit'
                              : `${validPrices.length}/${variants.length} variants configured — customer selects color in the store`}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 font-black text-lg p-6">Configure variants above to see the price</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl p-6 border-2 border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-gray-400">{currency}</span>
                      <input type="text" inputMode="decimal" placeholder="0.00"
                        value={manualPriceLocal}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val)) setManualPriceLocal(val);
                        }}
                        className="flex-1 bg-transparent outline-none font-black text-5xl text-gray-900 placeholder-gray-200"
                        required />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <button disabled={loading}
              className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center gap-3">
              {loading ? <Loader2 className="animate-spin" size={22} /> : 'Publish Listing'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// ─── SMALL HELPERS ─────────────────────────────────────────────────────────────
function SectionLabel({ step, label }: { step: string; label: string }) {
  return (
    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest">
      {step ? `${step}. ` : ''}{label}
    </label>
  );
}