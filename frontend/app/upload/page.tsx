'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, FileText, Image as ImageIcon, Box, Layers, Printer,
  X, Trash2, ChevronDown, EyeOff, Calculator, Zap, Settings2,
  Wrench, Plus, Minus, Palette, ChevronUp, Ruler, AlertTriangle,
  Tag, MessageCircle, Handshake, CheckCircle
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

const POPULAR_MATERIALS = [
  { 
    name: 'PLA', 
    fullName: 'Polylactic Acid',
    desc: 'Great for decorative models and prototypes that don\'t need to withstand heat. It provides a smooth, colorful finish with sharp details, but may warp if left in a hot car. Safe for indoor use and eco-friendly.' 
  },
  { 
    name: 'PLA+', 
    fullName: 'Tough PLA / PLA+',
    desc: 'A more durable version of PLA that is less likely to break if dropped. It maintains the beautiful surface finish of standard PLA while offering better impact resistance for functional parts that will be handled frequently.' 
  },
  { 
    name: 'PETG', 
    fullName: 'Polyethylene Terephthalate Glycol',
    desc: 'Excellent for durable parts that might come into contact with water or mild chemicals. It is much more heat-resistant than PLA and won\'t become brittle over time, making it ideal for kitchen items or light outdoor use.' 
  },
  { 
    name: 'ABS', 
    fullName: 'Acrylonitrile Butadiene Styrene',
    desc: 'A rugged, industrial plastic that can take a beating and survive high temperatures. It feels solid and high-quality, similar to LEGO bricks, and can be sanded or painted easily. Best for mechanical parts facing moderate heat.' 
  },
  { 
    name: 'ASA', 
    fullName: 'Acrylonitrile Styrene Acrylate',
    desc: 'The best choice for anything that will live permanently outdoors. It offers the same strength as ABS but is exceptionally resistant to sunlight, ensuring your parts won\'t turn yellow or become brittle in the sun. Tough and weather-proof.' 
  },
  { 
    name: 'TPU', 
    fullName: 'Thermoplastic Polyurethane / Flexible',
    desc: 'A unique rubber-like material that is virtually indestructible and highly flexible. Parts can be squeezed and stretched without breaking, offering excellent grip and shock absorption. Ideal for phone cases, gaskets, or wearable items.' 
  },
  { 
    name: 'PA', 
    fullName: 'Nylon / Polyamide',
    desc: 'An ultra-tough engineering plastic exceptionally resistant to wear and friction. It feels slightly slippery and is very hard to break, making it the top choice for moving parts like gears or sliders. Built for intense, long-term use.' 
  },
  { 
    name: 'PC', 
    fullName: 'Polycarbonate',
    desc: 'The ultimate material for impact resistance and extreme heat. It is nearly as strong as metal and can withstand very high temperatures without losing its shape. Perfect for safety equipment or high-performance structural parts.' 
  },
  { 
    name: 'Resin (Std)', 
    fullName: 'Standard Resin',
    desc: 'Provides a level of detail and surface smoothness that is unmatched by other methods. It captures the finest textures and sharpest edges, making it the gold standard for miniatures and jewelry. Note that it can be brittle if dropped.' 
  },
  { 
    name: 'Other', 
    fullName: 'Custom / Other Material',
    desc: 'Select this if your project requires a specialized material like wood-fill, glow-in-the-dark, or high-performance carbon-fiber. This allows for unique aesthetic effects or specific properties not covered by standard options.' 
  }
];

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
  // Dimensions: structured list of { label, value } entries, serialized to string on submit
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

  // Manual mode
  const [manualMaterial, setManualMaterial] = useState('');
  const [customMaterialName, setCustomMaterialName] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [manualColor, setManualColor] = useState('');
  const [manualColorHex, setManualColorHex] = useState('#888888');
  const [manualWeight, setManualWeight] = useState('');
  const [manualPriceLocal, setManualPriceLocal] = useState('');
  const [manualStock, setManualStock] = useState('1');
  const [manualVariants, setManualVariants] = useState<ManualVariant[]>([defaultManualVariant()]);

  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (formError) {
      const timer = setTimeout(() => setFormError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [formError]);

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
      if (newFiles.length + previewImages.length > 6) {
        setFormError('Max 6 photos allowed.');
        return;
      }
      setPreviewImages(prev => [...prev, ...newFiles]);
      setFormError('');
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

  const updateManualVariant = (id: string, patch: Partial<ManualVariant>) =>
    setManualVariants(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v));

  const updateManualLayer = (variantId: string, layerId: string, patch: Partial<ManualLayer>) =>
    setManualVariants(prev => prev.map(v => {
      if (v.id !== variantId) return v;
      return { ...v, layers: v.layers.map(l => l.id === layerId ? { ...l, ...patch } : l) };
    }));

  const addManualLayer = (variantId: string) =>
    setManualVariants(prev => prev.map(v => v.id === variantId ? { ...v, layers: [...v.layers, defaultManualLayer()] } : v));

  const removeManualLayer = (variantId: string, layerId: string) =>
    setManualVariants(prev => prev.map(v => v.id === variantId ? { ...v, layers: v.layers.filter(l => l.id !== layerId) } : v));

  const addManualVariant = () => setManualVariants(prev => [
    ...prev.map(v => ({ ...v, expanded: false })),
    defaultManualVariant(),
  ]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDimensionEntries([
      { id: uid(), label: 'Width', value: '' },
      { id: uid(), label: 'Height', value: '' },
      { id: uid(), label: 'Depth', value: '' },
    ]);
    setProjectFile(null);
    setPreviewImages([]);
    setManualMaterial('');
    setCustomMaterialName('');
    setCustomInstructions('');
    setIsNegotiable(false);
    setManualColor('');
    setManualColorHex('#888888');
    setManualWeight('');
    setManualPriceLocal('');
    setManualStock('1');
    setManualVariants([defaultManualVariant()]);
    setVariants([defaultVariant()]);
    setSubmitSuccess(false);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeManualVariant = (id: string) =>
    setManualVariants(prev => prev.length > 1 ? prev.filter(v => v.id !== id) : prev);

  // ─── SUBMIT ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title) { setFormError('Title is required.'); return; }
    if (previewImages.length === 0) { setFormError('Please upload at least 1 photo.'); return; }
    if ((category === 'digital' || category === 'job') && !projectFile) { setFormError('3D File is required.'); return; }
    if (!user?.id) return;

    if (category === 'physical') {
      const dimStr = serializeDimensions();
      if (!dimStr) { setFormError('Please enter at least one dimension.'); return; }
      if (pricingMode === 'auto') {
        for (const v of variants) {
          if (!computeVariantEUR(v)) { setFormError('Complete all filament & weight fields in every variant.'); return; }
        }
      } else {
        // Manual variants validation
        for (const v of manualVariants) {
          if (!v.priceLocal || parseFloat(v.priceLocal) <= 0) { setFormError('Each variant must have a valid price.'); return; }
          for (const l of v.layers) {
            if (!l.colorHex) { setFormError('Complete all color fields in every layer.'); return; }
          }
        }
      }
    } else if (!isNegotiable) {
      if (!manualPriceLocal) { setFormError('Price is required.'); return; }
    }

    setLoading(true);
    try {
      let projUrl: string | null = null;
      const imageUrls: string[] = [];

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

      if (category === 'physical') {
        if (pricingMode === 'auto') {
          const prices = variants.map(v => computeVariantEUR(v)!);
          const resolveStock = (v: ColorVariant) => {
            if (v.stockTracking === 'manual') return parseInt(v.stock) || 0;
            let maxP = Infinity;
            let ok = false;
            for (const l of v.layers) {
              if (l.filament && l.filament.stock_grams !== null && l.grams) {
                const g = parseFloat(l.grams);
                if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                else { ok = false; break; }
              } else { ok = false; break; }
            }
            return ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
          };

          dbPrice = Math.min(...prices.map(p => p.totalEUR));
          dbStock = variants.reduce((s, v) => s + resolveStock(v), 0);
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
            stock: resolveStock(v),
            stockTracking: v.stockTracking,
            primaryColor: v.layers[0]?.filament?.color_hex || '#888',
            isMultiColor: v.layers.length > 1,
          }));
        } else {
          // MANUAL VARIANTS for Physical
          const pricesEUR = manualVariants.map(v => (parseFloat(v.priceLocal) || 0) / (rates?.[currency] || 1));
          dbPrice = Math.min(...pricesEUR);
          dbStock = manualVariants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);

          const v0 = manualVariants[0];
          const l0 = v0.layers[0];
          dbMaterial = l0.material || null;
          dbColor = l0.colorHex || null;
          dbColorName = l0.colorName || null;
          dbWeight = v0.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0).toString();

          colorVariantsPayload = manualVariants.map((v, i) => ({
            variantId: v.id,
            label: v.layers.map(l => l.colorName).filter(Boolean).join(' + ') || `Variant ${i + 1}`,
            color_name: v.layers[0]?.colorName || null,
            plastic_type: v.layers[0]?.material || null,
            layers: v.layers.map(l => ({
              color_hex: l.colorHex,
              color_name: l.colorName,
              plastic_type: l.material,
              grams: l.weight,
            })),
            priceEUR: pricesEUR[i],
            stock: parseInt(v.stock) || 0,
            weight: v.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0).toString(),
            primaryColor: v.layers[0]?.colorHex || '#888',
            isMultiColor: v.layers.length > 1,
            manual: true,
          }));
        }
      } else {
        // Digital or Job
        dbPrice = isNegotiable ? 0 : manualPriceEUR!;
        dbMaterial = manualMaterial === 'Other' ? customMaterialName : (manualMaterial || null);
        dbColor = manualColorHex || null;
        dbColorName = manualColor || null;
        dbWeight = manualWeight || null;
        dbStock = category === 'digital' ? 999999 : (parseInt(manualStock) || 1);
      }

      // Try insert with color_variants, fall back without if column missing
      const finalDimensions = (category === 'physical' || category === 'job') ? serializeDimensions() || null : null;
      const basePayload = {
        title, description, price: dbPrice, category,
        material: dbMaterial, color: dbColor, color_name: dbColorName,
        weight: dbWeight, dimensions: finalDimensions,
        custom_instructions: category === 'job' ? customInstructions : null,
        is_negotiable: category === 'job' ? isNegotiable : false,
        stock: dbStock, file_url: projUrl,
        image_url: imageUrls[0] || null, image_urls: imageUrls,
        user_id: user.id, filament_id: dbFilamentId, created_at: new Date(),
        is_custom: false, // Ensure it shows in standard gallery
      };

      // --- ROBUST INSERTION WITH FALLBACKS ---
      // We try to insert with all new features. If columns are missing in Supabase, we fall back.
      let payload: any = { ...basePayload };
      if (colorVariantsPayload) payload.color_variants = colorVariantsPayload;

      let { error: dbErr } = await supabase.from('offers').insert(payload);

      if (dbErr) {
        console.warn("Primary insert failed, attempting fallbacks:", dbErr.message);
        
        // Check if new negotiation/instruction columns are missing
        if (dbErr.message?.includes('custom_instructions') || dbErr.message?.includes('is_negotiable')) {
          const { custom_instructions, is_negotiable, ...retry1Payload }: any = { 
            ...basePayload, 
            ...(colorVariantsPayload ? { color_variants: colorVariantsPayload } : {}) 
          };
          
          const { error: err1 } = await supabase.from('offers').insert(retry1Payload);
          dbErr = err1;
        }

        // Check if color_variants column is missing (old fallback)
        if (dbErr && dbErr.message?.includes('color_variants')) {
          const { color_variants, custom_instructions, is_negotiable, ...retry2Payload }: any = basePayload;
          
          const { error: err2 } = await supabase.from('offers').insert(retry2Payload);
          dbErr = err2;
        }
        
        if (dbErr) throw dbErr;
      }

      setSubmitSuccess(true);
    } catch (err: any) {
      setFormError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const isPhysicalAuto = category === 'physical' && pricingMode === 'auto';
  const isPhysicalManual = category === 'physical' && pricingMode === 'manual';
  const isPrinter = userRoles.includes('printer');

  // Precompute prices for Auto/Manual
  const variantPrices = variants.map(v => computeVariantEUR(v));
  const manualPricesEUR = manualVariants.map(v => (parseFloat(v.priceLocal) || 0) / (rates?.[currency] || 1));

  const minPriceEUR = (() => {
    if (category !== 'physical') return manualPriceEUR;
    if (pricingMode === 'auto') {
      const valid = variantPrices.filter(Boolean) as { totalEUR: number }[];
      return valid.length ? Math.min(...valid.map(p => p.totalEUR)) : null;
    } else {
      return manualPricesEUR.length ? Math.min(...manualPricesEUR) : null;
    }
  })();

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
                  { key: 'job', label: 'Print Request', Icon: Printer, c: 'blue', requiredRole: null, roleLabel: '' },
                  { key: 'digital', label: 'Digital File', Icon: Layers, c: 'orange', requiredRole: 'designer', roleLabel: 'CAD Designer' },
                  { key: 'physical', label: 'Physical Item', Icon: Box, c: 'emerald', requiredRole: 'printer', roleLabel: 'Printer' },
                ] as const).map(({ key, label, Icon, c, requiredRole, roleLabel }) => {
                  const disabled = !!requiredRole && !userRoles.includes(requiredRole);
                  const active = category === key;
                  const ac: any = { 
                    blue: 'border-blue-500 bg-blue-50 text-blue-800', 
                    purple: 'border-purple-500 bg-purple-50 text-purple-800', 
                    orange: 'border-orange-500 bg-orange-50 text-orange-800',
                    emerald: 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  };
                  const hc: any = { 
                    blue: 'hover:border-blue-200', 
                    purple: 'hover:border-purple-200', 
                    orange: 'hover:border-orange-200',
                    emerald: 'hover:border-emerald-200'
                  };
                  return (
                    <button key={key} type="button" disabled={disabled}
                      onClick={() => { if (!disabled) { setCategory(key); setPreviewImages([]); } }}
                      className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all relative ${disabled ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : active ? ac[c] : `border-gray-200 text-gray-500 ${hc[c]}`}`}>
                      <Icon size={32} />
                      <span className={`font-black uppercase text-sm ${disabled ? 'mb-4' : ''}`}>{label}</span>
                      {disabled && (
                        <div className="absolute bottom-3 left-0 right-0 text-center flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{roleLabel} role required</span>
                          <Link href="/settings" className="text-[8px] font-black text-blue-500/80 hover:text-blue-600 underline transition-colors uppercase tracking-tight">
                            Change in Profile Settings
                          </Link>
                        </div>
                      )}
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
                    { mode: 'auto', label: 'AUTO – Calc from Filaments', Icon: Settings2 },
                    { mode: 'manual', label: 'MANUAL – Hand-entered Variants', Icon: Wrench },
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
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required title="Please fill out this field"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
              <textarea
                placeholder={category === 'job' ? 'Describe your project in detail. Mention the purpose, strength requirements, and any specifics to help the printer achieve the best result for you...' : 'Description'}
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all resize-none" />
              
              {category === 'job' && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Settings2 size={16} className="text-gray-400" />
                    <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Custom Adjustments</span>
                  </div>
                  <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Please adjust the mounting holes to 5mm for a better fit, or change the shell thickness to ensure it fits perfectly inside my enclosure..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all min-h-[100px] resize-none shadow-inner"
                  />
                  <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-xl flex items-start gap-2.5 mt-1">
                    <Zap size={14} className="text-blue-500 mt-0.5" />
                    <p className="text-[10px] text-blue-600 font-bold leading-normal">
                      The service provider will review these instructions and confirm their feasibility during the offer negotiation process.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* 3. ATTACHMENTS */}
            <section className="space-y-4">
              <SectionLabel step="3" label="Attachments" />
              {(category === 'digital' || category === 'job') && (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <FileText className={`mb-3 ${projectFile ? 'text-green-600' : 'text-gray-400 group-hover:text-blue-500'}`} size={32} />
                  <span className="text-xs font-black uppercase text-gray-500">{projectFile ? projectFile.name : 'Upload 3D File (.STL)'}</span>
                  <input type="file" className="hidden" accept=".stl,.obj,.3mf,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                </label>
              )}
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                <span className="text-xs font-black uppercase text-gray-500">Upload Photos (Required, Max 6)</span>
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

              {/* Dimensions block — shown for physical, digital & job */}
              {(category === 'physical' || category === 'job' || category === 'digital') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ruler size={14} className="text-gray-400" />
                      <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Dimensions</span>
                    </div>
                    <button type="button" onClick={addDimension}
                      className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-blue-100 transition-all uppercase tracking-widest">
                      <Plus size={11} /> Add dimension
                    </button>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                      <Ruler size={18} />
                    </div>
                    <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                      {category === 'job' ? (
                        <>
                          <strong className="block uppercase tracking-wider text-[10px] mb-0.5">Specifications Matter</strong>
                          Provide the exact dimensions of your model so printers can calculate material costs accurately and confirm it fits within their machine's build volume.
                        </>
                      ) : (
                        <>
                          <strong className="block uppercase tracking-wider text-[10px] mb-0.5">Scale Matters</strong>
                          Provide dimensions that are important for the buyer or may be significant for the final product. Being precise helps buyers understand the scale and ensures a perfect fit.
                        </>
                      )}
                    </p>
                  </div>

                  {category === 'job' && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                        <AlertTriangle size={18} />
                      </div>
                      <div className="flex-1">
                        <strong className="block uppercase tracking-wider text-[10px] text-red-800 mb-0.5 font-black">Proportions Warning</strong>
                        <p className="text-[11px] text-red-700 font-bold leading-relaxed">
                          Carefully check your values. If the dimensions you provide do not match the original aspect ratio of your 3D file, the final print will be stretched or distorted to fit those measurements.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {dimensionEntries.map((dim, idx) => (
                      <div key={dim.id} className="flex items-center gap-2">
                        {/* Label */}
                        <input
                          type="text"
                          value={dim.label}
                          onChange={e => updateDimension(dim.id, { label: e.target.value })}
                          placeholder={idx === 0 ? 'Width' : idx === 1 ? 'Height' : idx === 2 ? 'Depth' : 'Label'}
                          className="w-24 flex-shrink-0 p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                        {/* Value */}
                        <div className="relative flex-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={dim.value}
                            onChange={e => {
                              const val = e.target.value.replace(',', '.');
                              if (/^\d*\.?\d*$/.test(val)) updateDimension(dim.id, { value: val });
                            }}
                            placeholder="0"
                            className="w-full p-3 pr-12 bg-white border-2 border-orange-200 rounded-xl font-black text-sm outline-none focus:border-orange-500 transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 font-black text-[10px]">mm</span>
                        </div>
                        {/* Remove */}
                        {dimensionEntries.length > 1 && (
                          <button type="button" onClick={() => removeDimension(dim.id)}
                            className="p-2.5 rounded-xl bg-white border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                            <Minus size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {serializeDimensions() && (
                    <p className="text-[10px] text-gray-400 font-bold bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                      📐 {serializeDimensions()}
                    </p>
                  )}
                </div>
              )}

              {!isPhysicalAuto && (
                <div className="space-y-4">
                  {category === 'physical' ? (
                    <p className="text-xs text-blue-500 font-bold bg-blue-50 p-3 rounded-xl border border-blue-100">
                      Configure your manual variants in the section below.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {category !== 'digital' && category !== 'job' && (
                        <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs pointer-events-none">QTY</span>
                          <input type="number" placeholder="1" min="1" value={manualStock} onChange={e => setManualStock(e.target.value)} onWheel={(e) => e.currentTarget.blur()} required title="Please fill out this field"
                            className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" />
                        </div>
                      )}
                      {category === 'job' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                             <div className="flex items-center gap-2">
                               <Wrench size={14} className="text-gray-400" />
                               <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">Required Material</span>
                             </div>
                             <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider animate-pulse">Click to learn about materials</span>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {POPULAR_MATERIALS.map((m) => (
                              <button
                                key={m.name}
                                type="button"
                                onClick={() => {
                                  setManualMaterial(m.name);
                                  if (m.name !== 'Other') setCustomMaterialName('');
                                }}
                                className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${
                                  manualMaterial === m.name 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.02]' 
                                    : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-600'
                                }`}
                              >
                                {m.name}
                              </button>
                            ))}
                          </div>

                          <div className={`grid transition-all duration-500 ease-in-out ${manualMaterial === 'Other' ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                               <input 
                                 type="text" 
                                 placeholder="Enter custom material name (e.g. PEEK, Wood PLA...)" 
                                 value={customMaterialName}
                                 onChange={e => setCustomMaterialName(e.target.value)}
                                 className="w-full p-4 bg-white border-2 border-blue-100 rounded-2xl font-bold text-gray-900 outline-none focus:border-blue-600 transition-all shadow-sm"
                               />
                            </div>
                          </div>

                          <div className={`grid transition-all duration-500 ease-in-out ${manualMaterial ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                               <div className="bg-gray-900 rounded-2xl p-5 border border-white/10">
                                 <div className="flex items-center justify-between mb-2">
                                   <span className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Material Properties</span>
                                   <span className="text-white text-xs font-black uppercase tracking-tight">
                                     {POPULAR_MATERIALS.find(m => m.name === manualMaterial)?.fullName}
                                   </span>
                                 </div>
                                 <p className="text-gray-400 text-xs font-medium leading-relaxed italic">
                                   "{POPULAR_MATERIALS.find(m => m.name === manualMaterial)?.desc}"
                                 </p>
                               </div>
                            </div>
                          </div>
                        </div>
                      )}
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

                      let calculatedStock = 0;
                      if (v.stockTracking === 'manual') {
                        calculatedStock = parseInt(v.stock) || 0;
                      } else {
                        let maxP = Infinity;
                        let ok = false;
                        for (const l of v.layers) {
                          if (l.filament && l.filament.stock_grams !== null && l.grams) {
                            const g = parseFloat(l.grams);
                            if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                            else { ok = false; break; }
                          } else { ok = false; break; }
                        }
                        calculatedStock = ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
                      }

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
                                 · qty {calculatedStock}
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
                                                {layer.filament.plastic_type} · {fmt(layer.filament.price_per_gram * 1000)}/kg · <span className="text-orange-500 font-bold">{Math.round(layer.filament.stock_grams || 0)}g left</span>
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
                                              <div className="flex flex-col items-end flex-shrink-0">
                                                <span className="text-[10px] font-bold text-gray-500">{fmt(fil.price_per_gram * 1000)}/kg</span>
                                                <span className="text-[9px] font-black text-orange-500">{Math.round(fil.stock_grams || 0)}g left</span>
                                              </div>
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
                                    <div 
                                      onClick={() => updateVariant(v.variantId, { stockTracking: v.stockTracking === 'auto' ? 'manual' : 'auto' })}
                                      className="relative w-28 h-7 bg-gray-100 rounded-full cursor-pointer flex items-center p-1 group transition-all hover:bg-gray-200 border border-gray-200"
                                    >
                                      <div 
                                        className={`absolute h-5 w-[calc(50%-2px)] bg-gray-900 rounded-full shadow-sm transition-all duration-300 ease-in-out ${v.stockTracking === 'manual' ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'}`}
                                      />
                                      <span className={`flex-1 text-center text-[8px] font-black z-10 transition-colors duration-300 ${v.stockTracking === 'auto' ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`}>AUTO</span>
                                      <span className={`flex-1 text-center text-[8px] font-black z-10 transition-colors duration-300 ${v.stockTracking === 'manual' ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'}`}>MANUAL</span>
                                    </div>
                                  </div>

                                  {(() => {
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

                                    if (v.stockTracking === 'auto') {
                                      return (
                                        <div className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg text-center flex items-center justify-center min-h-[42px]">
                                          <span className="text-sm font-black text-blue-700">
                                            {canCalc && maxPieces !== Infinity && maxPieces >= 0 ? `~ ${maxPieces} pcs` : 'Select filament & weight'}
                                          </span>
                                        </div>
                                      );
                                    }

                                    return (
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
                                    );
                                  })()}
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

            {/* 5. MANUAL COLOR VARIANTS (manual physical) */}
            {isPhysicalManual && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <SectionLabel step="5" label="Manual Color Variants" />
                    <p className="text-xs text-gray-400 font-medium mt-1">Add each variant manually. Everything is entered by hand.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {manualVariants.map((v, vIdx) => {
                    const totalWeight = v.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0);
                    return (
                      <div key={v.id} className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white">
                        {/* Header */}
                        <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-all font-sans"
                          onClick={() => updateManualVariant(v.id, { expanded: !v.expanded })}>
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {v.layers.map((l, li) => (
                              <div key={l.id} className="w-8 h-8 rounded-lg border-2 border-white shadow transition-all"
                                style={{ backgroundColor: l.colorHex || '#e5e7eb', zIndex: 4 - li }} />
                            ))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-gray-900 text-sm">
                              {v.layers.map(l => l.colorName || '—').join(' + ')}
                              {v.layers.length > 1 && <span className="ml-2 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase">Multi-color</span>}
                            </p>
                            <p className="text-xs text-gray-400 font-medium truncate">
                              {v.priceLocal ? `${v.priceLocal} ${currency}` : 'config pricing'} · {totalWeight > 0 ? `${totalWeight}g` : 'enter weights'} · qty {v.stock}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {manualVariants.length > 1 && (
                              <button type="button" onClick={e => { e.stopPropagation(); removeManualVariant(v.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                                <Trash2 size={14} />
                              </button>
                            )}
                            {v.expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                          </div>
                        </div>

                        {/* Expanded Body */}
                        {v.expanded && (
                          <div className="border-t border-gray-100 p-4 space-y-5 bg-gray-50/30 animate-in slide-in-from-top-2 duration-200">
                            {/* Layers Area */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Colors & Materials</span>
                                <button type="button" onClick={() => addManualLayer(v.id)}
                                  className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 px-2 py-1 rounded bg-blue-50 border border-blue-100 transition-all uppercase">
                                  <Plus size={10} /> Add Color
                                </button>
                              </div>

                              <div className="space-y-3">
                                {v.layers.map((layer, lIdx) => (
                                  <div key={layer.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3 relative">
                                    {v.layers.length > 1 && (
                                      <button type="button" onClick={() => removeManualLayer(v.id, layer.id)}
                                        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-all">
                                        <X size={14} />
                                      </button>
                                    )}
                                    <div className="grid grid-cols-1 gap-3">
                                      <div>
                                        <SectionLabel step="" label="HEX Color" />
                                        <div className="flex items-center gap-2 mt-1">
                                          <input type="text" value={layer.colorHex} onChange={e => updateManualLayer(v.id, layer.id, { colorHex: e.target.value })} className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[11px] font-bold outline-none focus:border-blue-500" />
                                          <input type="color" value={layer.colorHex.length === 7 ? layer.colorHex : '#3b82f6'} onChange={e => updateManualLayer(v.id, layer.id, { colorHex: e.target.value })} className="w-10 h-[42px] rounded-lg border-2 border-white shadow-sm cursor-pointer" />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <SectionLabel step="" label="Material" />
                                        <input type="text" value={layer.material} onChange={e => updateManualLayer(v.id, layer.id, { material: e.target.value })} placeholder="PLA" className="w-full p-2.5 mt-1 bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs outline-none focus:border-blue-500" />
                                      </div>
                                      <div>
                                        <SectionLabel step="" label="Print Weight (g)" />
                                        <input type="text" value={layer.weight} onChange={e => {
                                          const val = e.target.value.replace(',', '.');
                                          if (/^\d*\.?\d*$/.test(val)) updateManualLayer(v.id, layer.id, { weight: val });
                                        }} placeholder="20" className="w-full p-2.5 mt-1 bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs outline-none focus:border-blue-500" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Variant Pricing/Stock */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100/50">
                              <div>
                                <SectionLabel step="" label={`Price (${currency})`} />
                                <input type="text" value={v.priceLocal} onChange={e => {
                                  const val = e.target.value.replace(',', '.');
                                  if (/^\d*\.?\d*$/.test(val)) updateManualVariant(v.id, { priceLocal: val });
                                }} placeholder="25.00" className="w-full p-3 mt-1 bg-white border border-gray-200 rounded-xl font-black text-sm outline-none focus:border-blue-500 text-blue-600 shadow-sm" />
                              </div>
                              <div>
                                <SectionLabel step="" label="Stock (qty)" />
                                <input type="text" value={v.stock} onChange={e => {
                                  const val = e.target.value;
                                  if (/^\d*$/.test(val)) updateManualVariant(v.id, { stock: val });
                                }} placeholder="5" className="w-full p-3 mt-1 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 shadow-sm" />
                              </div>
                            </div>

                            <div className="bg-white/50 p-2.5 rounded-lg border border-dashed border-gray-200 flex justify-between items-center text-[11px]">
                              <span className="font-bold text-gray-500 uppercase tracking-widest">Total Weight</span>
                              <span className="font-black text-gray-900">{totalWeight} g</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={addManualVariant} className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center gap-2 text-sm font-black text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 hover:shadow-inner transition-all">
                    <Plus size={18} /> Add Another Variant
                  </button>
                </div>
              </section>
            )}

            {/* Summary for Manual Variants */}
            {isPhysicalManual && manualVariants.length > 1 && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Palette size={14} className="text-blue-600" />
                  <span className="text-xs font-black uppercase text-blue-800 tracking-widest">Pricing Overview</span>
                </div>
                <div className="space-y-1.5">
                  {manualVariants.map((v, i) => (
                    <div key={v.id} className="flex items-center gap-2.5 bg-white/70 rounded-xl px-3 py-2">
                      <div className="flex -space-x-1">
                        {v.layers.map(l => (
                          <div key={l.id} className="w-5 h-5 rounded-sm border border-white/60 shadow-sm" style={{ backgroundColor: l.colorHex || '#ccc' }} />
                        ))}
                      </div>
                      <span className="flex-1 text-xs font-bold text-blue-900 truncate">
                        {v.layers.map(l => l.colorName).filter(Boolean).join(' + ') || 'Variant'}
                      </span>
                      <span className="text-xs font-black text-blue-800 tabular-nums">{v.priceLocal ? `${v.priceLocal} ${currency}` : '—'}</span>
                      <span className="text-[10px] text-blue-500 font-bold">×{v.stock || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FINAL PRICE */}
            {category !== 'physical' && (
              <section className="space-y-4">
                <SectionLabel step="5" label="Price & Strategy" />
                
                {category === 'job' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setIsNegotiable(false)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${!isNegotiable ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                      <Tag size={20} className={!isNegotiable ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-400'} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${!isNegotiable ? 'text-blue-900' : 'text-gray-400 group-hover:text-blue-600'}`}>Fixed Price</span>
                    </button>
                    <button type="button" onClick={() => setIsNegotiable(true)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${isNegotiable ? 'border-indigo-600 bg-indigo-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                      <MessageCircle size={20} className={isNegotiable ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-400'} />
                      <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${isNegotiable ? 'text-indigo-900' : 'text-gray-400 group-hover:text-indigo-600'}`}>Get Proposals</span>
                    </button>
                  </div>
                )}

                {(!isNegotiable) ? (
                  <div className="rounded-2xl p-6 border-2 border-gray-200 bg-white transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-gray-400">{currency}</span>
                      <input type="text" inputMode="decimal" placeholder="0.00"
                        value={manualPriceLocal}
                        onChange={e => {
                          const val = e.target.value.replace(',', '.');
                          if (/^\d*\.?\d*$/.test(val)) setManualPriceLocal(val);
                        }}
                        className="flex-1 bg-transparent outline-none font-black text-5xl text-gray-900 placeholder-gray-200"
                        required={!isNegotiable} title="Please fill out this field" />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-500/20 flex flex-col gap-3 animate-in fade-in zoom-in-95">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                      <Handshake size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-black uppercase tracking-widest text-sm">Negotiation Mode Active</h4>
                      <p className="text-[11px] font-bold text-indigo-50 mt-1 opacity-90 leading-normal">
                        Printers will see your project as "Open for Proposals". You will receive custom quotes and can discuss details in the chat before making a final decision.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {formError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-bold text-xs uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
                ⚠️ {formError}
              </div>
            )}

            <button disabled={loading}
              className="w-full py-5 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 flex justify-center items-center gap-3">
              {loading ? <Loader2 className="animate-spin" size={22} /> : 'Publish Listing'}
            </button>

            {submitSuccess && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-xl animate-in fade-in duration-500 p-6">
                <div className="text-center p-10 bg-white rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col items-center gap-6 transform animate-in zoom-in-95 duration-500 max-w-sm w-full mx-auto border border-gray-100">
                  <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-green-200">
                    <CheckCircle size={40} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">Success!</h2>
                    <p className="text-gray-500 font-bold mt-2 text-xs">Your listing is now visible to the world.</p>
                  </div>
                  
                  <div className="flex flex-col gap-3 w-full mt-2">
                    <button type="button" onClick={() => router.push('/gallery')}
                      className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-[0.98]">
                      Explore Gallery
                    </button>
                    <button type="button" onClick={() => router.push('/profile')}
                      className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-[0.98]">
                      Go to My Profile
                    </button>
                    <button type="button" onClick={resetForm}
                      className="w-full py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-gray-300 hover:text-gray-600 transition-all active:scale-[0.98]">
                      Post Something Else
                    </button>
                  </div>
                </div>
              </div>
            )}
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