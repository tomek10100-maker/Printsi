'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, Image as ImageIcon, Box, Layers, Printer,
  X, Trash2, ChevronDown, EyeOff, Calculator, Zap, Settings2,
  Wrench, Plus, Minus, Palette, ChevronUp, Save, ArrowLeft, Package, AlertTriangle
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';

const BUCKET_NAME = 'printsi-files1';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Filament = {
  id: string;
  plastic_type: string;
  color_name: string;
  color_hex: string;
  brand: string | null;
  price_per_gram: number;
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

const BASIC_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
  orange: '#ffa500', brown: '#a52a2a', pink: '#ffc0cb', purple: '#800080',
  navy: '#000080', lime: '#00ff00', maroon: '#800000', olive: '#808000', teal: '#008080',
  silver: '#c0c0c0', gold: '#ffd700'
};

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

function toLocalDisplay(eurAmount: number, currency: string, rates: Record<string, number> | null): string {
  const converted = currency !== 'EUR' && rates?.[currency] ? eurAmount * rates[currency] : eurAmount;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.round(converted * 100) / 100);
}

function SectionLabel({ step, label }: { step?: string; label: string }) {
  return (
    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-widest">
      {step ? `${step}. ` : ''}{label}
    </label>
  );
}

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const { currency, rates, formatPrice } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Original offer data
  const [offer, setOffer] = useState<any>(null);
  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('digital');
  const [pricingMode, setPricingMode] = useState<'auto' | 'manual'>('manual');

  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');

  // Manual mode
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualColorHex, setManualColorHex] = useState('#888888');
  const [manualWeight, setManualWeight] = useState('');
  const [manualPriceLocal, setManualPriceLocal] = useState('');
  const [manualStock, setManualStock] = useState('1');

  // Auto mode (filament variants)
  const [myFilaments, setMyFilaments] = useState<Filament[]>([]);
  const [variants, setVariants] = useState<ColorVariant[]>([defaultVariant()]);

  // Images
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);

  const isPrinter = userRoles.includes('printer');
  const isPhysicalAuto = category === 'physical' && pricingMode === 'auto';

  // ─── PRICE CALC ─────────────────────────────────────────────────────────────
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

  const fmt = (eur: number) => toLocalDisplay(eur, currency, rates);

  // Pre-compute variant prices
  const variantPrices = variants.map(v => computeVariantEUR(v));
  const validPrices = variantPrices.filter(Boolean) as { materialEUR: number; markupEUR: number; totalEUR: number }[];

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      const roles = profile?.roles || [];
      setUserRoles(roles);

      // Fetch active filaments once (for printers)
      let activeFilaments: Filament[] = [];
      if (roles.includes('printer')) {
        const { data: fils } = await supabase
          .from('filaments').select('*')
          .eq('user_id', user.id).eq('is_active', true)
          .order('created_at', { ascending: false });
        activeFilaments = fils || [];
        setMyFilaments(activeFilaments);
      }

      const { data: offerData, error } = await supabase
        .from('offers').select('*').eq('id', params.id).single();

      if (error || !offerData) {
        alert('Offer not found'); router.push('/profile'); return;
      }
      if (offerData.user_id !== user.id) {
        alert('You can only edit your own offers.'); router.push('/profile'); return;
      }

      setOffer(offerData);
      setCategory(offerData.category);
      setTitle(offerData.title);
      setDescription(offerData.description || '');
      setDimensions(offerData.dimensions || '');
      setManualMaterial(offerData.material || '');
      setManualColor(offerData.color_name || offerData.color || '');
      // Try to parse out the hex color, default to #888888 if it isn't hex or doesn't exist
      setManualColorHex((offerData.color && offerData.color.startsWith('#')) ? offerData.color : '#888888');
      setManualWeight(offerData.weight || '');
      setExistingImages(offerData.image_urls || []);

      // Restore color_variants with pre-populated filament objects
      if (offerData.color_variants && offerData.color_variants.length > 0 && roles.includes('printer')) {
        setPricingMode('auto');

        // Collect filament IDs saved in layers
        const savedFilamentIds = new Set<string>();
        for (const cv of offerData.color_variants) {
          for (const l of cv.layers || []) {
            if (l.filament_id) savedFilamentIds.add(l.filament_id);
          }
        }

        // Start with active filaments, then pull in any archived ones if needed
        const activeById = new Map(activeFilaments.map(f => [f.id, f]));
        const missingIds = Array.from(savedFilamentIds).filter(id => !activeById.has(id));

        let allFilaments = [...activeFilaments];
        if (missingIds.length > 0) {
          const { data: extra } = await supabase
            .from('filaments').select('*').in('id', missingIds);
          if (extra) allFilaments = [...extra, ...allFilaments]; // archived first, then active for ordering
          setMyFilaments(allFilaments.filter((f, i, a) => a.findIndex(x => x.id === f.id) === i));
        }

        // Build lookup map
        const filamentMap = new Map<string, Filament>();
        for (const f of allFilaments) filamentMap.set(f.id, f);

        // Reconstruct variants with real filament objects
        const restored: ColorVariant[] = offerData.color_variants.map((cv: any, cvIdx: number) => ({
          variantId: uid(),
          layers: (cv.layers && cv.layers.length > 0 ? cv.layers : [{ filament_id: null, grams: '0' }])
            .map((l: any) => ({
              layerId: uid(),
              filament: l.filament_id ? (filamentMap.get(l.filament_id) ?? null) : null,
              grams: l.grams?.toString() || '',
            })),
          markupType: cv.markupType || 'percent',
          markupValue: cv.markupValue?.toString() || '',
          stock: cv.stock?.toString() || '1',
          expanded: cvIdx === 0, // expand first variant so user immediately sees pre-filled data
          openDropdownLayerId: null,
        }));

        setVariants(restored.length > 0 ? restored : [defaultVariant()]);
      } else {
        setPricingMode('manual');
        const rate = (currency !== 'EUR' && rates?.[currency]) ? rates[currency] : 1;
        setManualPriceLocal((offerData.price * rate).toFixed(2));
        setManualStock(offerData.stock?.toString() || '1');
      }

      setLoading(false);
    };

    if (currency) initData();
  }, [params.id, router, currency, rates]);


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

  // ─── IMAGES ───────────────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + newImages.length + existingImages.length > 6) {
        alert('Max 6 photos allowed.'); return;
      }
      setNewImages(prev => [...prev, ...files]);
    }
  };

  // ─── SUBMIT ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { alert('Title is required.'); return; }
    if (!user?.id || !offer) return;

    setSaving(true);
    try {
      // Upload new images
      let uploadedUrls: string[] = [];
      for (const file of newImages) {
        const ext = file.name.split('.').pop();
        const path = `previews/${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file);
        if (error) throw error;
        uploadedUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(path).data.publicUrl);
      }
      const finalImages = [...existingImages, ...uploadedUrls];

      if (category !== 'job' && finalImages.length === 0) {
        alert('You must have at least one photo.'); setSaving(false); return;
      }

      let updates: any = {
        title, description,
        dimensions: dimensions || null,
        image_urls: finalImages,
        image_url: finalImages[0] || null,
      };

      if (isPhysicalAuto) {
        // Validate all variants
        for (const v of variants) {
          if (!computeVariantEUR(v)) { alert('Complete all filament & weight fields in every variant.'); setSaving(false); return; }
        }
        const prices = variants.map(v => computeVariantEUR(v)!);
        const minPrice = Math.min(...prices.map(p => p.totalEUR));
        const totalStock = variants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
        const firstLayer = variants[0].layers[0];

        const colorVariantsPayload = variants.map((v, i) => ({
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

        updates = {
          ...updates,
          price: minPrice,
          stock: totalStock,
          material: firstLayer?.filament?.plastic_type || null,
          color: firstLayer?.filament?.color_hex || null,
          color_name: firstLayer?.filament?.color_name || null,
          weight: variants[0].layers.reduce((s, l) => s + (parseFloat(l.grams) || 0), 0).toString(),
          color_variants: colorVariantsPayload,
        };
      } else {
        if (!manualPriceLocal) { alert('Price is required.'); setSaving(false); return; }
        const priceEUR = (currency !== 'EUR' && rates?.[currency])
          ? parseFloat(manualPriceLocal) / rates[currency]
          : parseFloat(manualPriceLocal);
        updates = {
          ...updates,
          price: priceEUR,
          stock: parseInt(manualStock) || 1,
          material: manualMaterial || null,
          color: manualColorHex || null,
          color_name: manualColor || null,
          weight: manualWeight || null,
        };
      }

      const { error } = await supabase.from('offers').update(updates).eq('id', params.id);
      if (error) throw error;

      router.push(`/offer/${params.id}`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center text-gray-900 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

        {/* HEADER */}
        <div className="bg-gray-900 p-8 text-white relative">
          <Link href={`/offer/${params.id}`} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition">
            <X size={20} />
          </Link>
          <Link href={`/offer/${params.id}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-xs font-bold uppercase tracking-widest mb-4">
            <ArrowLeft size={14} /> Back to Listing
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-wide">Edit Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium truncate">
            Editing: <span className="text-white font-bold">"{title}"</span>
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">

            {/* CATEGORY (read-only) */}
            <section>
              <SectionLabel step="1" label="Listing Type" />
              <div className="mt-3 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-center gap-3">
                {category === 'job' ? <Printer size={20} className="text-blue-500" /> :
                  category === 'digital' ? <Layers size={20} className="text-purple-500" /> :
                    <Box size={20} className="text-orange-500" />}
                <span className="font-black uppercase text-sm text-blue-900">
                  {category === 'job' ? 'Print Request' : category === 'digital' ? 'Digital File' : 'Physical Item'}
                </span>
                <span className="ml-auto text-xs font-bold text-blue-400">(Cannot be changed)</span>
              </div>
            </section>

            {/* PRICING MODE (only for physical + printer) */}
            {category === 'physical' && isPrinter && (
              <section>
                <SectionLabel label="Pricing Mode" />
                <div className="flex rounded-2xl overflow-hidden border-2 border-gray-200 mt-3">
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
                {pricingMode === 'auto' && offer?.color_variants?.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-bold">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-500" />
                    This listing has saved variants. Re-select your filaments below to update the pricing.
                  </div>
                )}
              </section>
            )}

            {/* BASIC DETAILS */}
            <section className="space-y-4">
              <SectionLabel step="2" label="Basic Details" />
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
              <textarea 
                placeholder={category === 'job' ? 'Describe your project in detail. Mention the purpose, strength requirements, and any specifics to help the printer achieve the best result for you...' : 'Description'} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={4}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all resize-none" />
            </section>

            {/* IMAGES */}
            {category !== 'job' && (
              <section className="space-y-4">
                <SectionLabel step="3" label="Photos" />
                <div className="grid grid-cols-3 gap-3">
                  {existingImages.map((url, idx) => (
                    <div key={`old-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-200">
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all">
                        <Trash2 size={20} />
                      </button>
                      {idx === 0 && <span className="absolute bottom-2 left-2 text-[9px] font-black bg-black/70 text-white px-2 py-0.5 rounded-full uppercase">Main</span>}
                    </div>
                  ))}
                  {newImages.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden group border-2 border-blue-500">
                      <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => setNewImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                  {existingImages.length + newImages.length < 6 && (
                    <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-500">
                      <ImageIcon size={24} />
                      <span className="text-[10px] font-black uppercase mt-1">Add Photo</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                    </label>
                  )}
                </div>
              </section>
            )}

            {/* SPECS */}
            <section className="space-y-4">
              <SectionLabel step="4" label="Specs" />
              {category === 'physical' && (
                <input type="text" placeholder="Dimensions (e.g. 15×15×10 cm)" value={dimensions}
                  onChange={e => setDimensions(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all" />
              )}
              {!isPhysicalAuto && (
                <div className="space-y-3">
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs pointer-events-none">QTY</span>
                    <input type="number" placeholder="1" min="0" value={manualStock} onChange={e => setManualStock(e.target.value)}
                      className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
                  </div>
                  {(category === 'physical' || category === 'job') && (
                    <div className={`grid gap-3 ${category === 'physical' ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3'}`}>
                      <input type="text" placeholder={category === 'job' ? "Preferred Material (optional)" : "Material (PLA…)"} value={manualMaterial} onChange={e => setManualMaterial(e.target.value)}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all min-w-0" />
                      
                      <input type="text" placeholder={category === 'job' ? "Color Name (e.g. Red, Black...)" : "Color Name (Red…)"} value={manualColor} 
                        onChange={e => {
                          setManualColor(e.target.value);
                          const lower = e.target.value.toLowerCase().trim();
                          if (BASIC_COLORS[lower]) setManualColorHex(BASIC_COLORS[lower]);
                        }}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all min-w-0" />

                      <div className="relative isolate">
                        <div className="absolute -top-6 right-0 flex items-center gap-1 text-[10px] font-black text-orange-500 uppercase tracking-tighter animate-bounce-v-simple pointer-events-none">
                            Click to adjust <span className="text-xs">↓</span>
                        </div>
                        <div className="flex items-center gap-2 h-full">
                          <div className="flex items-center gap-1 flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 overflow-hidden focus-within:border-orange-400 focus-within:bg-white transition-all h-full min-h-[56px] min-w-[70px]">
                            <span className="text-gray-400 font-bold text-sm">#</span>
                            <input type="text" value={manualColorHex.replace('#', '')} onChange={e => {
                              const val = e.target.value;
                              setManualColorHex(val.startsWith('#') ? val : '#' + val);
                            }} maxLength={6} placeholder="HEX" className="w-full py-3 bg-transparent font-mono font-bold text-sm outline-none uppercase" />
                          </div>
                          <input type="color" value={manualColorHex.startsWith('#') && manualColorHex.length === 7 ? manualColorHex : '#888888'} onChange={e => { setManualColorHex(e.target.value); if(!BASIC_COLORS[manualColor.toLowerCase().trim()]) setManualColor('Custom Color'); }}
                            className="w-14 min-h-[56px] h-full rounded-xl border-2 border-orange-200 cursor-pointer overflow-hidden flex-shrink-0 hover:scale-105 hover:shadow-md transition-all shadow-sm shadow-orange-200" title="Click to open color picker" />
                        </div>
                      </div>

                      {category === 'physical' && (
                        <div className="relative">
                          <input type="number" step="any" min="0" placeholder="Weight" value={manualWeight} onChange={e => setManualWeight(e.target.value)}
                            className="w-full p-4 pr-8 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all min-w-0" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">g</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* COLOR VARIANTS (auto physical) */}
            {isPhysicalAuto && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SectionLabel step="5" label="Color Variants" />
                    <p className="text-xs text-gray-400 font-medium mt-1">Re-select filaments to update pricing. Each variant = its own filament, price & stock.</p>
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
                    {variants.map((v, vIdx) => {
                      const price = variantPrices[vIdx];
                      const isMulti = v.layers.length > 1;
                      return (
                        <div key={v.variantId} className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
                          {/* Header */}
                          <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-all select-none"
                            onClick={() => updateVariant(v.variantId, { expanded: !v.expanded })}>
                            <div className="flex -space-x-1.5 flex-shrink-0">
                              {v.layers.slice(0, 4).map((l, li) => (
                                <div key={l.layerId} className="w-8 h-8 rounded-lg border-2 border-white shadow"
                                  style={{ backgroundColor: l.filament?.color_hex || '#e5e7eb', zIndex: 4 - li }} />
                              ))}
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
                                <button type="button" onClick={e => { e.stopPropagation(); removeVariant(v.variantId); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                                  <Trash2 size={14} />
                                </button>
                              )}
                              {v.expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                            </div>
                          </div>

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
                                              <p className="text-[10px] text-gray-400 truncate">{layer.filament.plastic_type} · {fmt(layer.filament.price_per_gram * 1000)}/kg</p>
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
                                          <div className="border-t border-gray-100 sticky bottom-0 bg-white">
                                            <Link href="/profile/filaments" className="flex items-center justify-center gap-2 py-3 px-3 text-[11px] font-black text-orange-600 hover:bg-orange-50 transition-all uppercase tracking-wider">
                                              <Settings2 size={14} /> Manage filaments
                                            </Link>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="relative w-28 flex-shrink-0">
                                      <input type="text" inputMode="decimal" placeholder="0" value={layer.grams}
                                        onChange={e => {
                                          const val = e.target.value.replace(',', '.');
                                          if (/^\d*\.?\d*$/.test(val)) updateLayer(v.variantId, layer.layerId, { grams: val });
                                        }}
                                        className="w-full p-3 pr-7 bg-white border-2 border-orange-200 rounded-xl font-black text-sm outline-none focus:border-orange-500 transition-all" />
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
                                    <span className="text-[10px] text-gray-400 font-black">{v.markupType === 'percent' ? '%' : currency}</span>
                                    <input type="text" inputMode="decimal"
                                      placeholder={v.markupType === 'percent' ? '50' : '10.00'}
                                      value={v.markupValue}
                                      onChange={e => {
                                        const val = e.target.value.replace(',', '.');
                                        if (/^\d*\.?\d*$/.test(val)) updateVariant(v.variantId, { markupValue: val });
                                      }}
                                      className="flex-1 p-2 bg-gray-50 border border-gray-100 rounded-lg font-black text-sm outline-none focus:border-blue-400 transition-all" />
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
                                      let maxPieces = Infinity;
                                      let canCalc = false;
                                      for (const l of v.layers) {
                                        if (l.filament && l.filament.stock_grams !== null && l.grams) {
                                          const g = parseFloat(l.grams);
                                          if (g > 0) { maxPieces = Math.min(maxPieces, Math.floor(l.filament.stock_grams / g)); canCalc = true; }
                                          else { canCalc = false; break; }
                                        } else { canCalc = false; break; }
                                      }
                                      if (canCalc && maxPieces !== Infinity && maxPieces >= 0) {
                                        return (
                                          <button type="button" onClick={() => updateVariant(v.variantId, { stock: maxPieces.toString() })}
                                            className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md hover:bg-orange-100 transition-all border border-orange-200">
                                            Auto-fill: {maxPieces} pcs
                                          </button>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <input type="text" inputMode="numeric" placeholder="1" value={v.stock}
                                    onChange={e => { const val = e.target.value; if (/^\d*$/.test(val)) updateVariant(v.variantId, { stock: val }); }}
                                    className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg font-black text-2xl outline-none focus:border-blue-400 transition-all" />
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

                    <button type="button" onClick={addVariant}
                      className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                      <Plus size={18} /> Add Color Variant
                    </button>

                    {/* Variants summary */}
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
                        <div className="divide-y divide-gray-800">
                          {variants.map((v, i) => {
                            const p = variantPrices[i];
                            const colorName = v.layers.map(l => l.filament?.color_name || '?').join(' + ');
                            return (
                              <div key={v.variantId} className="flex items-center gap-3 px-5 py-3">
                                <div className="flex -space-x-1 flex-shrink-0">
                                  {v.layers.map((l) => (
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
                        required={!isPhysicalAuto} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* SAVE BUTTON */}
            <button disabled={saving}
              className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center gap-3">
              {saving ? <Loader2 className="animate-spin" size={22} /> : <><Save size={20} /> Save Changes</>}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}