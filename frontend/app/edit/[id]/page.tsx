'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import {
  Loader2, FileText, Image as ImageIcon, Box, Layers, Printer,
  X, Trash2, ChevronDown, EyeOff, Calculator, Zap, Settings2,
  Wrench, Plus, Minus, Palette, ChevronUp, Ruler, Save, ArrowLeft, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useCurrency } from '../../../context/CurrencyContext';

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
  stockTracking: 'auto' | 'manual';
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

type DimensionEntry = { id: string; label: string; value: string };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
type ManualLayer = {
  id: string;
  material: string;
  colorName: string;
  colorHex: string;
  weight: string;
};

type ManualVariant = {
  id: string;
  layers: ManualLayer[];
  priceLocal: string;
  stock: string;
  expanded: boolean;
};

const uid = () => Math.random().toString(36).slice(2);

const defaultVariant = (): ColorVariant => ({
  variantId: uid(),
  layers: [{ layerId: uid(), filament: null, grams: '' }],
  markupType: 'percent',
  markupValue: '',
  stock: '1',
  stockTracking: 'auto',
  expanded: true,
  openDropdownLayerId: null,
});

const defaultManualLayer = (): ManualLayer => ({
  id: uid(),
  material: 'PLA',
  colorName: '',
  colorHex: '#3b82f6',
  weight: '',
});

const defaultManualVariant = (): ManualVariant => ({
  id: uid(),
  layers: [defaultManualLayer()],
  priceLocal: '',
  stock: '1',
  expanded: true,
});

function toLocalDisplay(eurAmount: number, currency: string, rates: Record<string, number> | null): string {
  const converted = currency !== 'EUR' && rates?.[currency]
    ? eurAmount * rates[currency]
    : eurAmount;
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(converted * 100) / 100);
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { currency, rates, formatPrice } = useCurrency();

  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('digital');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [pricingMode, setPricingMode] = useState<'auto' | 'manual'>('auto');

  // Common
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dimensionEntries, setDimensionEntries] = useState<DimensionEntry[]>([
    { id: uid(), label: 'Width', value: '' },
    { id: uid(), label: 'Height', value: '' },
    { id: uid(), label: 'Depth', value: '' },
  ]);

  const addDimension = () => setDimensionEntries(prev => [...prev, { id: uid(), label: '', value: '' }]);
  const removeDimension = (id: string) => setDimensionEntries(prev => prev.length > 1 ? prev.filter(d => d.id !== id) : prev);
  const updateDimension = (id: string, patch: Partial<DimensionEntry>) =>
    setDimensionEntries(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  const serializeDimensions = () =>
    dimensionEntries
      .filter(d => d.value.trim())
      .map(d => `${d.label || 'Dim'}: ${d.value} mm`)
      .join(', ');

  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  // Manual mode
  const [manualMaterial, setManualMaterial] = useState('');
  const [manualColor, setManualColor] = useState('');
  const [manualColorHex, setManualColorHex] = useState('#888888');
  const [manualWeight, setManualWeight] = useState('');
  const [manualPriceLocal, setManualPriceLocal] = useState('');
  const [manualStock, setManualStock] = useState('1');
  const [manualVariants, setManualVariants] = useState<ManualVariant[]>([defaultManualVariant()]);

  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auto mode
  const [myFilaments, setMyFilaments] = useState<Filament[]>([]);
  const [variants, setVariants] = useState<ColorVariant[]>([defaultVariant()]);

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      
      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      const roles = profile?.roles || [];
      setUserRoles(roles);

      let activeFilaments: Filament[] = [];
      if (roles.includes('printer')) {
        const { data: fils } = await supabase.from('filaments').select('*')
          .eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
        activeFilaments = fils || [];
        setMyFilaments(activeFilaments);
      }

      const { data: offerData, error } = await supabase.from('offers').select('*').eq('id', params.id).single();
      if (error || !offerData) { alert('Offer not found'); router.push('/profile'); return; }
      if (offerData.user_id !== user.id) { alert('Unauthorized'); router.push('/profile'); return; }

      setCategory(offerData.category);
      setTitle(offerData.title);
      setDescription(offerData.description || '');
      setExistingImages(offerData.image_urls || []);
      
      if (offerData.dimensions) {
        const parsed = offerData.dimensions.split(',').map((d: string) => {
          const match = d.match(/^(.*?):\s*(.*?)\s*mm$/);
          if (match) return { id: uid(), label: match[1].trim(), value: match[2].trim() };
          return null;
        }).filter(Boolean) as DimensionEntry[];
        if (parsed.length > 0) setDimensionEntries(parsed);
      }

      if (offerData.color_variants && offerData.color_variants.length > 0) {
        // Decide pricing mode based on the first variant
        const firstVar = offerData.color_variants[0];
        // If 'manual' flag is set OR any layer is missing filament_id, treat as manual
        // Also treat as manual if there are no layers defined yet
        const hasMissingFilamentIds = (firstVar.layers || []).length === 0 || (firstVar.layers || []).some((l: any) => !l.filament_id);
        const isManualEntry = !!firstVar.manual || hasMissingFilamentIds;
        
        if (isManualEntry) {
           setPricingMode('manual');
           const localPrice = ((firstVar.priceEUR || offerData.price || 0) * (rates?.[currency] || 1)).toFixed(2);
           setManualPriceLocal(localPrice);
           setManualStock((offerData.stock !== undefined ? offerData.stock : '1').toString());
           
           setManualVariants(offerData.color_variants.map((cv: any) => ({
             id: cv.variantId || uid(),
             layers: (cv.layers || []).map((l: any) => ({
               id: uid(),
               material: l.plastic_type || offerData.material || '',
               colorName: l.color_name || '',
               colorHex: l.color_hex || '#888888',
               weight: (l.grams !== undefined ? l.grams : l.weight)?.toString() || ''
             })),
             priceLocal: ((cv.priceEUR || offerData.price || 0) * (rates?.[currency] || 1)).toFixed(2),
             stock: (cv.stock !== undefined ? cv.stock : '1').toString(),
             expanded: false
           })));
        } else {
           // Auto pricing (filament tracking)
           setPricingMode('auto');
           
           // Collect all unique filament IDs mentioned in variants
           const savedFilamentIds = new Set<string>();
           offerData.color_variants.forEach((cv: any) => {
             (cv.layers || []).forEach((l: any) => {
               if (l.filament_id) savedFilamentIds.add(l.filament_id);
             });
           });

           // Ensure we have current data for all these filaments (even if archived/not active)
           const activeById = new Map(activeFilaments.map(f => [f.id, f]));
           const missingIds = Array.from(savedFilamentIds).filter(id => !activeById.has(id));
           
           let allFilaments = [...activeFilaments];
           if (missingIds.length > 0) {
             const { data: extra } = await supabase.from('filaments').select('*').in('id', missingIds);
             if (extra) {
               allFilaments = [...allFilaments, ...extra];
               // De-duplicate just in case
               allFilaments = allFilaments.filter((f, i, a) => a.findIndex(x => x.id === f.id) === i);
               setMyFilaments(allFilaments);
             }
           }

           const filamentMap = new Map<string, Filament>();
           allFilaments.forEach(f => filamentMap.set(f.id, f));

           const restored = offerData.color_variants.map((cv: any, idx: number) => ({
             variantId: cv.variantId || uid(),
             layers: (cv.layers || []).map((l: any) => ({
               layerId: uid(),
               filament: l.filament_id ? (filamentMap.get(l.filament_id) ?? null) : null,
               grams: (l.grams !== undefined ? l.grams : l.weight)?.toString() || ''
             })),
             markupType: cv.markupType || 'percent',
             markupValue: cv.markupValue?.toString() || '',
             stock: (cv.stock !== undefined ? cv.stock : '1').toString(),
             stockTracking: cv.stockTracking || 'auto',
             expanded: idx === 0,
             openDropdownLayerId: null
           }));
           setVariants(restored);
        }
      } else {
        // No color variants (simple listing) - default to manual for simplicity in editing
        setPricingMode('manual');
        const rate = (currency !== 'EUR' && rates?.[currency]) ? rates[currency] : 1;
        const localPrice = (offerData.price * rate).toFixed(2);
        setManualPriceLocal(localPrice);
        setManualStock(offerData.stock?.toString() || '1');
        setManualMaterial(offerData.material || '');
        setManualColor(offerData.color_name || '');
        setManualColorHex(offerData.color || '#888888');
        setManualWeight(offerData.weight || '');
        
        // Also initialize manualVariants for physical category
        if (offerData.category === 'physical') {
           setManualVariants([{
             id: uid(),
             layers: [{
               id: uid(),
               material: offerData.material || '',
               colorName: offerData.color_name || '',
               colorHex: offerData.color || '#888888',
               weight: offerData.weight || ''
             }],
             priceLocal: localPrice,
             stock: offerData.stock?.toString() || '1',
             expanded: true
           }]);
        }
      }
      setLoading(false);
    };
    if (currency) initData();
  }, [params.id, router, currency, rates]);

  // Mutations
  const updateVariant = (id: string, patch: Partial<ColorVariant>) => setVariants(prev => prev.map(v => v.variantId === id ? { ...v, ...patch } : v));
  const updateLayer = (vId: string, lId: string, patch: Partial<FilamentLayer>) => setVariants(prev => prev.map(v => v.variantId === vId ? { ...v, layers: v.layers.map(l => l.layerId === lId ? { ...l, ...patch } : l) } : v));
  const addLayer = (vId: string) => setVariants(prev => prev.map(v => v.variantId === vId ? { ...v, layers: [...v.layers, { layerId: uid(), filament: null, grams: '' }] } : v));
  const removeLayer = (vId: string, lId: string) => setVariants(prev => prev.map(v => v.variantId === vId ? { ...v, layers: v.layers.filter(l => l.layerId !== lId) } : v));
  const addVariant = () => setVariants(prev => [...prev.map(v => ({ ...v, expanded: false })), defaultVariant()]);
  const removeVariant = (id: string) => setVariants(prev => prev.length > 1 ? prev.filter(v => v.variantId !== id) : prev);

  const updateManualVariant = (id: string, patch: Partial<ManualVariant>) => setManualVariants(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));
  const updateManualLayer = (vId: string, lId: string, patch: Partial<ManualLayer>) => setManualVariants(prev => prev.map(v => v.id === vId ? { ...v, layers: v.layers.map(l => l.id === lId ? { ...l, ...patch } : l) } : v));
  const addManualLayer = (vId: string) => setManualVariants(prev => prev.map(v => v.id === vId ? { ...v, layers: [...v.layers, defaultManualLayer()] } : v));
  const removeManualLayer = (vId: string, lId: string) => setManualVariants(prev => prev.map(v => v.id === vId ? { ...v, layers: v.layers.filter(l => l.id !== lId) } : v));
  const addManualVariant = () => setManualVariants(prev => [...prev.map(v => ({ ...v, expanded: false })), defaultManualVariant()]);
  const removeManualVariant = (id: string) => setManualVariants(prev => prev.length > 1 ? prev.filter(v => v.id !== id) : prev);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (newFiles.length + previewImages.length + existingImages.length > 6) { setFormError('Max 6 photos.'); return; }
      setPreviewImages(prev => [...prev, ...newFiles]);
    }
  };
  const removeImage = (i: number) => setPreviewImages(prev => prev.filter((_, idx) => idx !== i));

  const computeVariantEUR = useCallback((v: ColorVariant) => {
    let materialEUR = 0;
    for (const l of v.layers) {
      if (!l.filament || !l.grams) return null;
      materialEUR += parseFloat(l.grams) * l.filament.price_per_gram;
    }
    const mv = parseFloat(v.markupValue);
    let markupEUR = 0;
    if (!isNaN(mv) && mv > 0) {
      if (v.markupType === 'percent') markupEUR = materialEUR * (mv / 100);
      else markupEUR = (currency !== 'EUR' && rates?.[currency]) ? mv / rates[currency] : mv;
    }
    return { materialEUR, markupEUR, totalEUR: materialEUR + markupEUR };
  }, [currency, rates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of previewImages) {
        const ext = file.name.split('.').pop();
        const p = `previews/${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, file);
        if (error) throw error;
        imageUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl);
      }
      const finalImages = [...existingImages, ...imageUrls];

      let dbPrice: number, dbStock = 1, dbMaterial: any = null, dbColor: any = null, dbColorName: any = null, dbWeight: any = null, dbFilamentId: any = null;
      let colorVariantsPayload: any[] | undefined;

      if (category === 'physical') {
        if (pricingMode === 'auto') {
          const prices = variants.map(v => computeVariantEUR(v));
          dbPrice = Math.min(...prices.map(p => p?.totalEUR || 999999));
          const resolveStock = (v: ColorVariant) => {
            if (v.stockTracking === 'manual') return parseInt(v.stock) || 0;
            let maxP = Infinity; let ok = false;
            for (const l of v.layers) {
              if (l.filament && l.filament.stock_grams !== null && l.grams) {
                const g = parseFloat(l.grams);
                if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                else { ok = false; break; }
              } else { ok = false; break; }
            }
            return ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
          };
          dbStock = variants.reduce((s, v) => s + resolveStock(v), 0);
          colorVariantsPayload = variants.map((v, i) => ({
            variantId: v.variantId, label: v.layers.map(l => l.filament?.color_name).join(' + '),
            priceEUR: prices[i]?.totalEUR, stock: resolveStock(v), stockTracking: v.stockTracking,
            markupType: v.markupType, markupValue: v.markupValue, primaryColor: v.layers[0]?.filament?.color_hex,
            layers: v.layers.map(l => ({ filament_id: l.filament?.id, grams: l.grams, color_hex: l.filament?.color_hex, color_name: l.filament?.color_name, plastic_type: l.filament?.plastic_type }))
          }));
        } else {
          const pricesEUR = manualVariants.map(v => (parseFloat(v.priceLocal) || 0) / (rates?.[currency] || 1));
          dbPrice = Math.min(...pricesEUR);
          dbStock = manualVariants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
          colorVariantsPayload = manualVariants.map((v, i) => ({
            manual: true, variantId: v.id, label: v.layers.map(l => l.colorName).join(' + '),
            priceEUR: pricesEUR[i], stock: parseInt(v.stock) || 0, primaryColor: v.layers[0].colorHex,
            layers: v.layers.map(l => ({ color_hex: l.colorHex, color_name: l.colorName, plastic_type: l.material, grams: l.weight }))
          }));
        }
      } else {
        dbPrice = (parseFloat(manualPriceLocal) || 0) / (rates?.[currency] || 1);
        dbStock = category === 'digital' ? 999999 : (parseInt(manualStock) || 1);
      }

      const { error: dbErr } = await supabase.from('offers').update({
        title, description, price: dbPrice, stock: dbStock, category,
        image_urls: finalImages, image_url: finalImages[0] || null,
        dimensions: serializeDimensions() || null,
        color_variants: colorVariantsPayload || null
      }).eq('id', params.id);
      if (dbErr) throw dbErr;
      router.push(`/offer/${params.id}`);
    } catch (err: any) { setFormError(err.message); setLoading(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  const isPhysicalAuto = category === 'physical' && pricingMode === 'auto';
  const isPhysicalManual = category === 'physical' && pricingMode === 'manual';
  const variantPrices = variants.map(v => computeVariantEUR(v));
  const fmt = (eur: number) => toLocalDisplay(eur, currency, rates);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center text-gray-900 font-sans">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-gray-900 p-8 text-white relative">
          <Link href={`/offer/${params.id}`} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-xs font-bold uppercase tracking-widest mb-4">
            <ArrowLeft size={14} /> Back to Listing
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-wide">Edit Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium truncate">Editing: <span className="text-white font-bold">"{title}"</span></p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            <section className="space-y-4">
              <SectionLabel label="1. Listing Type" />
              <div className="grid grid-cols-3 gap-4 pointer-events-none">
                 <div className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-opacity ${category === 'job' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 text-gray-300 opacity-40'}`}><Printer size={32}/><span className="font-black uppercase text-[10px]">Print Request</span></div>
                 <div className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-opacity ${category === 'digital' ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-100 text-gray-300 opacity-40'}`}><Layers size={32}/><span className="font-black uppercase text-[10px]">Digital File</span></div>
                 <div className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-opacity ${category === 'physical' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-100 text-gray-300 opacity-40'}`}><Box size={32}/><span className="font-black uppercase text-[10px]">Physical Item</span></div>
              </div>
            </section>
            {category === 'physical' && userRoles.includes('printer') && (
              <section className="bg-blue-50/20 p-8 rounded-3xl border-2 border-blue-100/50 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="block text-xs font-black uppercase text-gray-900 tracking-wider">Pricing Mode</label>
                    <p className="text-[11px] text-gray-500 font-bold leading-relaxed max-w-[280px]">
                      {pricingMode === 'auto' 
                        ? "AUTO: Price is calculated based on filament weight and your profit margin."
                        : "MANUAL: You set the final price and stock levels yourself for each variant."}
                    </p>
                  </div>
                  <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-200">
                    <button type="button" onClick={() => setPricingMode('auto')} className={`flex items-center gap-2 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${pricingMode === 'auto' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}><Settings2 size={14}/> AUTO</button>
                    <button type="button" onClick={() => setPricingMode('manual')} className={`flex items-center gap-2 py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${pricingMode === 'manual' ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}><Wrench size={14}/> MANUAL</button>
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-4">
              <SectionLabel label="2. Basic Details" />
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm" />
              <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all resize-none shadow-sm" />
              
              {pricingMode === 'manual' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <SectionLabel label={`Price (${currency})`} />
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">{currency}</span>
                      <input 
                        type="text" 
                        value={manualPriceLocal} 
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val)) {
                            setManualPriceLocal(val);
                            if (category === 'physical' && manualVariants.length > 0) {
                              updateManualVariant(manualVariants[0].id, { priceLocal: val });
                            }
                          }
                        }} 
                        className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-black text-2xl text-blue-600 outline-none focus:border-blue-500 shadow-sm transition-all" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <SectionLabel label="Stock (qty)" />
                    <input 
                      type="text" 
                      value={manualStock} 
                      onChange={e => {
                        if (/^\d*$/.test(e.target.value)) {
                          setManualStock(e.target.value);
                          if (category === 'physical' && manualVariants.length > 0) {
                            updateManualVariant(manualVariants[0].id, { stock: e.target.value });
                          }
                        }
                      }} 
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-2xl outline-none focus:border-blue-500 shadow-sm transition-all text-gray-700" 
                      placeholder="1"
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <SectionLabel label="3. Attachments" />
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                <span className="text-xs font-black uppercase text-gray-500">Add Photos (Max 6 Total)</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {existingImages.map((url, idx) => (
                    <div key={`old-${idx}`} className="relative h-24 rounded-xl overflow-hidden group border border-gray-200">
                      <img src={url} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all"><Trash2 size={18} /></button>
                      {idx === 0 && <span className="absolute bottom-1 left-1 text-[8px] font-black bg-black/70 text-white px-1.5 py-0.5 rounded-full uppercase">Main</span>}
                    </div>
                  ))}
                {previewImages.map((file, idx) => (
                    <div key={`new-${idx}`} className="relative h-24 rounded-xl overflow-hidden group border-2 border-blue-400">
                      <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(idx)} className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all"><Trash2 size={18} /></button>
                    </div>
                ))}
              </div>
            </section>

            {(category === 'physical' || category === 'job' || category === 'digital') && (
              <section className="space-y-4">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Ruler size={14} className="text-gray-400" />
                      <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Dimensions</span>
                    </div>
                    <button type="button" onClick={addDimension} className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-blue-100 transition-all uppercase tracking-widest"><Plus size={11}/> Add dimension</button>
                 </div>
                 <div className="space-y-2">
                   {dimensionEntries.map((dim, idx) => (
                     <div key={dim.id} className="flex items-center gap-2">
                       <input type="text" value={dim.label} onChange={e => updateDimension(dim.id, { label: e.target.value })} placeholder="Label" className="w-24 p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 transition-all uppercase"/>
                       <div className="relative flex-1">
                         <input type="text" value={dim.value} onChange={e => updateDimension(dim.id, { value: e.target.value.replace(',', '.') })} placeholder="0" className="w-full p-3 pr-10 bg-white border-2 border-orange-200 rounded-xl font-black text-sm outline-none focus:border-orange-500 transition-all"/>
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 font-black text-[10px]">mm</span>
                       </div>
                      </div>
                    ))}
                  </div>
                  {category === 'digital' && (
                   <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
                     <AlertTriangle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                     <p className="text-[10px] font-medium text-blue-700 leading-relaxed uppercase">
                       These are <span className="font-black">reference dimensions</span>. Buyers can change them proportionally during negotiation.
                     </p>
                   </div>
                 )}
              </section>
            )}

            {isPhysicalAuto && (
              <section className="space-y-4">
                <SectionLabel label="5. Color Variants (Calculated Pricing)" />
                <div className="space-y-3">
                  {variants.map((v, vIdx) => {
                    const price = variantPrices[vIdx];
                    let maxP = Infinity; let ok = false;
                    for (const l of v.layers) {
                      if (l.filament && l.filament.stock_grams !== null && l.grams) {
                        const g = parseFloat(l.grams);
                        if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                        else { ok = false; break; }
                      } else { ok = false; break; }
                    }
                    const calculatedStock = ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
                    
                    return (
                      <div key={v.variantId} className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
                        <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-all" onClick={() => updateVariant(v.variantId, { expanded: !v.expanded })}>
                           <div className="w-8 h-8 rounded-lg border-2 border-white shadow" style={{ backgroundColor: v.layers[0]?.filament?.color_hex || '#eee' }} />
                           <div className="flex-1">
                             <p className="font-black text-gray-900 text-sm">Variant {vIdx + 1} · {price ? fmt(price.totalEUR) : '...'} · qty {v.stockTracking === 'manual' ? v.stock : calculatedStock}</p>
                             <p className="text-[10px] text-gray-400 font-bold uppercase">{v.layers.map(l => l.filament?.color_name || '—').join(' + ')}</p>
                           </div>
                           {v.expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                        </div>
                        {v.expanded && (
                           <div className="p-4 bg-gray-50/30 border-t border-gray-100 space-y-4">
                              <div className="space-y-3">
                                {v.layers.map((l, lIdx) => (
                                  <div key={l.layerId} className="flex items-stretch gap-2">
                                     <div className="flex-1 relative">
                                        <button type="button" onClick={() => updateVariant(v.variantId, { openDropdownLayerId: v.openDropdownLayerId === l.layerId ? null : l.layerId })} className="w-full h-11 flex items-center gap-2 px-3 bg-white border border-gray-200 rounded-xl text-left shadow-sm">
                                           {l.filament ? <><div className="w-5 h-5 rounded border" style={{ backgroundColor: l.filament.color_hex }} /><span className="text-xs font-black truncate">{l.filament.color_name}</span></> : <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Select Filament...</span>}
                                        </button>
                                        {v.openDropdownLayerId === l.layerId && (
                                           <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-[60] max-h-40 overflow-auto">
                                              {myFilaments.map(fil => (
                                                <div key={fil.id} onClick={() => { updateVariant(v.variantId, { layers: v.layers.map(innerL => innerL.layerId === l.layerId ? { ...innerL, filament: fil } : innerL), openDropdownLayerId: null }); }} 
                                                     className="p-2.5 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-all border-b last:border-0 border-gray-50">
                                                  <div className="w-4 h-4 rounded-full border border-gray-100" style={{ backgroundColor: fil.color_hex }} />
                                                  <span className="text-[11px] font-bold text-gray-700">{fil.color_name} <span className="text-gray-400 font-medium tracking-tighter">({fil.plastic_type})</span></span>
                                                </div>
                                              ))}
                                           </div>
                                        )}
                                     </div>
                                     <div className="relative w-24">
                                        <input type="text" value={l.grams} onChange={e => updateLayer(v.variantId, l.layerId, { grams: e.target.value.replace(',', '.') })} placeholder="0" className="w-full h-11 p-3 pr-7 bg-white border-2 border-orange-100 rounded-xl font-black text-sm outline-none focus:border-orange-500 transition-all text-orange-600 shadow-sm" />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-orange-400 font-black text-[10px]">g</span>
                                     </div>
                                     {v.layers.length > 1 && (
                                       <button type="button" onClick={() => removeLayer(v.variantId, l.layerId)} className="h-11 px-3 rounded-xl bg-white border-2 border-gray-100 text-gray-300 hover:text-red-400 transition-all"><Minus size={14}/></button>
                                     )}
                                  </div>
                                ))}
                                <button type="button" onClick={() => addLayer(v.variantId)} className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[9px] font-black uppercase text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-all tracking-widest">+ Add color/material</button>
                              </div>

                              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100/50">
                                 <div className="bg-white border-2 border-blue-50 rounded-xl p-3 space-y-2">
                                   <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Calculator size={14} className="text-blue-500" />
                                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Profit / Markup</span>
                                      </div>
                                      <div className="flex rounded-md border border-gray-200 overflow-hidden text-[10px]">
                                        <button type="button" onClick={() => updateVariant(v.variantId, { markupType: 'percent' })}
                                          className={`px-2 py-1 font-black transition-all ${v.markupType === 'percent' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>%</button>
                                        <button type="button" onClick={() => updateVariant(v.variantId, { markupType: 'fixed' })}
                                          className={`px-2 py-1 font-black transition-all ${v.markupType === 'fixed' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}>{currency}</button>
                                      </div>
                                   </div>
                                   <input type="text" value={v.markupValue} onChange={e => updateVariant(v.variantId, { markupValue: e.target.value.replace(',', '.') })} placeholder="10.00" className="w-full p-2 bg-gray-50 border border-gray-100 rounded-lg font-black text-xs outline-none focus:border-blue-500 transition-all" />
                                 </div>

                                 <div className="bg-white border-2 border-gray-100 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <Box size={14} className="text-gray-500" />
                                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Stock</span>
                                      </div>
                                      <div onClick={() => updateVariant(v.variantId, { stockTracking: v.stockTracking === 'auto' ? 'manual' : 'auto' })}
                                           className="relative w-16 h-5 bg-gray-100 rounded-full cursor-pointer flex items-center p-0.5 border border-gray-200">
                                         <div className={`absolute h-4 w-[calc(50%-1px)] bg-gray-900 rounded-full shadow-sm transition-all duration-300 ${v.stockTracking === 'manual' ? 'translate-x-[calc(100%-1px)]' : 'translate-x-0'}`} />
                                         <span className={`flex-1 text-center text-[6px] font-black z-10 ${v.stockTracking === 'auto' ? 'text-white' : 'text-gray-400'}`}>AUTO</span>
                                         <span className={`flex-1 text-center text-[6px] font-black z-10 ${v.stockTracking === 'manual' ? 'text-white' : 'text-gray-400'}`}>MAN</span>
                                      </div>
                                    </div>
                                    {v.stockTracking === 'auto' ? (
                                      <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-center min-h-[34px] flex items-center justify-center text-[11px] font-black text-blue-700">~ {calculatedStock} pcs</div>
                                    ) : (
                                      <input type="text" value={v.stock} onChange={e => updateVariant(v.variantId, { stock: e.target.value })} className="w-full p-2 h-[34px] bg-gray-50 border border-gray-100 rounded-lg font-black text-xs outline-none focus:border-blue-500 transition-all" />
                                    )}
                                 </div>
                              </div>

                              {price && (
                                <div className="bg-white border-2 border-blue-100 rounded-xl overflow-hidden mt-1 shadow-sm">
                                  <div className="flex justify-between items-center px-3 py-1.5 text-[10px] text-gray-500">
                                    <span>Material Cost</span>
                                    <span className="font-bold text-gray-800">{fmt(price.materialEUR)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-3 py-1.5 text-[10px] text-gray-500 border-t border-gray-100">
                                    <span className="flex items-center gap-1">Your Profit (markup)</span>
                                    <span className="font-black text-green-700">+{fmt(price.markupEUR)}</span>
                                  </div>
                                  <div className="flex justify-between items-center px-3 py-2 text-xs bg-blue-50 border-t border-blue-100">
                                    <span className="font-black text-gray-900 uppercase tracking-tighter">Total Price</span>
                                    <span className="font-black text-blue-700 text-sm">{fmt(price.totalEUR)}</span>
                                  </div>
                                </div>
                              )}
                           </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={addVariant} className="w-full py-3.5 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-black text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-inner"><Plus size={16}/> Add Color Variant</button>
                </div>
              </section>
            )}

            {isPhysicalManual && (
               <section className="space-y-4">
                  <SectionLabel label="Manual Variants" />
                <div className="space-y-3">
                   {manualVariants.map((v, vIdx) => {
                      const totalWeight = v.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0);
                      return (
                        <div key={v.id} className="border-2 border-gray-100 rounded-2xl p-4 bg-white space-y-4">
                           <div className="flex items-center justify-between cursor-pointer" onClick={() => updateManualVariant(v.id, { expanded: !v.expanded })}>
                              <div>
                                <span className="text-xs font-black uppercase">Variant {vIdx+1}</span>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">{v.layers.map(l => l.colorName || '—').join(' + ')} · {totalWeight}g</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); removeManualVariant(v.id); }} className="text-red-400 p-1 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                {v.expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                              </div>
                           </div>

                           {v.expanded && (
                             <div className="space-y-4 pt-4 border-t border-gray-50">
                               <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                   <SectionLabel label="Layers (Colors & Materials)" />
                                   <button type="button" onClick={() => addManualLayer(v.id)} className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase"><Plus size={12}/> Add layer</button>
                                 </div>
                                 {v.layers.map((layer, lIdx) => (
                                   <div key={layer.id} className="p-3 bg-gray-50 rounded-xl space-y-3 relative">
                                      {v.layers.length > 1 && (
                                        <button type="button" onClick={() => removeManualLayer(v.id, layer.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500"><X size={14}/></button>
                                      )}
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                          <SectionLabel label="Color Name" />
                                          <input type="text" value={layer.colorName} onChange={e => updateManualLayer(v.id, layer.id, { colorName: e.target.value })} className="w-full p-2.5 mt-1 bg-white border border-gray-200 rounded-lg font-bold text-xs" placeholder="e.g. Silk Green" />
                                        </div>
                                        <div>
                                          <SectionLabel label="HEX Color" />
                                          <div className="flex items-center gap-2 mt-1">
                                            <input type="text" value={layer.colorHex} onChange={e => updateManualLayer(v.id, layer.id, { colorHex: e.target.value })} className="flex-1 p-2 bg-white border border-gray-200 rounded-lg font-mono text-[10px] uppercase font-bold" />
                                            <input type="color" value={layer.colorHex.length === 7 ? layer.colorHex : '#3b82f6'} onChange={e => updateManualLayer(v.id, layer.id, { colorHex: e.target.value })} className="w-8 h-8 rounded border-0 cursor-pointer" />
                                          </div>
                                        </div>
                                        <div>
                                          <SectionLabel label="Material" />
                                          <input type="text" value={layer.material} onChange={e => updateManualLayer(v.id, layer.id, { material: e.target.value })} className="w-full p-2 mt-1 bg-white border border-gray-200 rounded-lg font-bold text-xs" placeholder="PLA" />
                                        </div>
                                        <div>
                                          <SectionLabel label="Weight (g)" />
                                          <input type="text" value={layer.weight} onChange={e => updateManualLayer(v.id, layer.id, { weight: e.target.value.replace(',', '.') })} className="w-full p-2 mt-1 bg-white border border-gray-200 rounded-lg font-bold text-xs" placeholder="0" />
                                        </div>
                                      </div>
                                   </div>
                                 ))}
                               </div>

                               <div className="grid grid-cols-2 gap-3">
                                  <div><span className="text-[9px] font-black uppercase text-gray-400">Price ({currency})</span><input type="text" value={v.priceLocal} onChange={e => updateManualVariant(v.id, { priceLocal: e.target.value.replace(',', '.') })} className="w-full p-3 bg-gray-50 border rounded-xl font-black text-sm"/></div>
                                  <div><span className="text-[9px] font-black uppercase text-gray-400">Stock</span><input type="text" value={v.stock} onChange={e => updateManualVariant(v.id, { stock: e.target.value })} className="w-full p-3 bg-gray-50 border rounded-xl font-black text-sm"/></div>
                               </div>
                             </div>
                           )}
                        </div>
                      );
                   })}
                   <button type="button" onClick={addManualVariant} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-black text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-all"><Plus size={14}/> Add Manual Variant</button>
                </div>
               </section>
            )}

            {formError && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-bold text-xs uppercase tracking-widest italic animate-bounce">⚠️ {formError}</div>}

            <button disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center gap-3">
              {loading ? <Loader2 className="animate-spin" size={22} /> : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <label className="block text-[11px] font-black uppercase text-gray-600 tracking-widest">{label}</label>;
}