'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2, Search, ShoppingBag, X, SlidersHorizontal,
  ArrowUpDown, Package, ArrowRight, CheckCircle, Heart, Zap, MessageSquare, Palette, Check, Layers
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import ThemeToggle from '../components/ThemeToggle';
import { supabase } from '../lib/supabase';
import { getOfferStock, isOfferSoldOut, formatOfferWeight } from '../lib/offerHelpers';

type ColorVariant = {
  label: string;
  primaryColor: string;
  color_name: string;
  color_hex?: string;
  priceEUR: number;
  stock: number;
  plastic_type: string;
  isMultiColor?: boolean;
  layers?: { color_hex: string; color_name: string; grams: string; filament_id?: string }[];
};

const CORE_MATS = ['PLA', 'PLA+', 'PETG', 'ABS', 'TPU (Flexible)', 'ASA', 'Nylon', 'Carbon Fiber', 'Wood'];

const BASE_COLORS = [
  { id: 'white', name: 'White', hex: '#ffffff', keywords: ['white', 'snow', 'clear', 'transparent', 'ivory', 'bone'] },
  { id: 'light_gray', name: 'Light Gray', hex: '#d1d5db', keywords: ['light gray', 'silver', 'platinum'] },
  { id: 'gray', name: 'Gray', hex: '#6b7280', keywords: ['gray', 'grey', 'ash', 'slate'] },
  { id: 'dark_gray', name: 'Dark Gray', hex: '#374151', keywords: ['dark gray', 'charcoal', 'graphite'] },
  { id: 'black', name: 'Black', hex: '#000000', keywords: ['black', 'onyx', 'coal', 'obsidian', 'dark', 'midnight'] },
  { id: 'brown', name: 'Brown', hex: '#78350f', keywords: ['brown', 'chocolate', 'wood', 'copper', 'bronze', 'coffee', 'mocha'] },
  { id: 'red', name: 'Red', hex: '#ef4444', keywords: ['red', 'crimson', 'ruby', 'scarlet', 'cherry', 'blood'] },
  { id: 'dark_red', name: 'Dark Red', hex: '#7f1d1d', keywords: ['dark red', 'maroon', 'burgundy', 'wine'] },
  { id: 'orange', name: 'Orange', hex: '#f97316', keywords: ['orange', 'tangerine', 'peach', 'carrot', 'apricot'] },
  { id: 'yellow', name: 'Yellow', hex: '#eab308', keywords: ['yellow', 'lemon', 'sun', 'blonde'] },
  { id: 'gold', name: 'Gold', hex: '#ca8a04', keywords: ['gold', 'brass', 'mustard'] },
  { id: 'lime', name: 'Lime', hex: '#84cc16', keywords: ['lime', 'chartreuse', 'neon green'] },
  { id: 'green', name: 'Green', hex: '#22c55e', keywords: ['green', 'emerald', 'olive', 'forest', 'mint'] },
  { id: 'dark_green', name: 'Dark Green', hex: '#14532d', keywords: ['dark green', 'pine', 'jade'] },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', keywords: ['cyan', 'teal', 'aqua', 'turquoise', 'sky'] },
  { id: 'light_blue', name: 'Light Blue', hex: '#3b82f6', keywords: ['light blue', 'cornflower', 'baby blue'] },
  { id: 'blue', name: 'Blue', hex: '#1d4ed8', keywords: ['blue', 'cobalt', 'azure', 'sapphire'] },
  { id: 'navy', name: 'Navy', hex: '#1e3a8a', keywords: ['navy', 'dark blue'] },
  { id: 'indigo', name: 'Indigo', hex: '#4f46e5', keywords: ['indigo'] },
  { id: 'purple', name: 'Purple', hex: '#9333ea', keywords: ['purple', 'violet', 'amethyst', 'lavender', 'plum'] },
  { id: 'pink', name: 'Pink', hex: '#ec4899', keywords: ['pink', 'rose', 'blush', 'magenta', 'fuchsia', 'coral'] }
];

/** Safely extract the display color from a variant (handles both DB raw form and computed form) */
function getVariantColor(v: ColorVariant): string {
  return v.primaryColor || v.color_hex || v.layers?.[0]?.color_hex || '#888';
}

type Offer = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_urls: string[];
  created_at: string;
  stock: number;
  user_id: string;
  color_variants?: ColorVariant[];
  color_name?: string;
  color_hex?: string;
  material?: string;
  weight?: string;
  dimensions?: string;
  is_negotiable?: boolean;
};

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCategory = searchParams.get('category') || 'physical';
  const { addItem, items } = useCart();
  const { formatPrice } = useCurrency();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<Offer | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Color picker modal state
  const [colorPickerOffer, setColorPickerOffer] = useState<Offer | null>(null);
  const [colorPickerMode, setColorPickerMode] = useState<'add' | 'buy'>('add');
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  // Filter Panel State
  const [showFilters, setShowFilters] = useState(false);
  const [filterMaterial, setFilterMaterial] = useState<string>('');
  const [filterColorId, setFilterColorId] = useState<string>('');

  const fetchOffers = useCallback(async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .or('is_custom.eq.false,is_custom.is.null');
    if (error) {
      console.error('Error fetching offers:', error);
    } else {
      setOffers(data || []);
    }
  }, []);

  useEffect(() => {
    const paramCategory = searchParams.get('category');
    if (paramCategory) setCategoryFilter(paramCategory);
  }, [searchParams]);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      await fetchOffers();

      if (user) {
        const { data: favs } = await supabase.from('favorites').select('offer_id').eq('user_id', user.id);
        if (favs) setSavedIds(favs.map(f => f.offer_id));

        const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
        if (profile && profile.roles) {
          setUserRoles(profile.roles);
        }
      }
      setLoading(false);
    };

    initData();

    const channel = supabase
      .channel('public:offers_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updatedOffer = payload.new as Offer;
            setOffers((prev) => prev.map((item) =>
              item.id === updatedOffer.id ? { ...item, ...updatedOffer } : item
            ));
          }
          else if (payload.eventType === 'INSERT') {
            setOffers((prev) => [payload.new as Offer, ...prev]);
          }
          else if (payload.eventType === 'DELETE') {
            setOffers((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOffers]);

  const handleAddToCart = (offer: Offer) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOfferSoldOut(offer)) return;
    // Job offers → redirect to offer detail page for download & fulfill flow
    if (offer.category === 'job') {
      router.push(`/offer/${offer.id}`);
      return;
    }
    const variants = offer.color_variants || [];
    if (offer.category === 'physical' && variants.length > 1) {
      // open color picker
      setColorPickerOffer(offer);
      setColorPickerMode('add');
      setSelectedVariantIdx(0);
      return;
    }
    const firstVariant = variants[0];
    const fvLayers = firstVariant?.layers;
    const fvWeight = formatOfferWeight(firstVariant ? null : offer.weight, fvLayers);
    addItem({
      id: offer.id,
      title: offer.title,
      price: firstVariant ? firstVariant.priceEUR : offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: firstVariant ? firstVariant.stock : getOfferStock(offer),
      variant_name: firstVariant ? firstVariant.color_name : offer.color_name,
      variant_color: firstVariant ? getVariantColor(firstVariant) : offer.color_hex,
      variant_layers: firstVariant?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams, color_hex: l.color_hex, color_name: l.color_name })) || undefined,
      category: offer.category,
      material: firstVariant ? firstVariant.plastic_type : offer.material,
      weight: fvWeight,
    }, offer.category === 'digital' ? 1 : 1);
    setLastAddedItem(offer);
    setShowModal(true);
  };

  const handleBuyNow = (offer: Offer) => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOfferSoldOut(offer)) return;
    // Job offers → redirect to offer detail page for download & fulfill flow
    if (offer.category === 'job') {
      router.push(`/offer/${offer.id}`);
      return;
    }
    const variants = offer.color_variants || [];
    if (offer.category === 'physical' && variants.length > 1) {
      setColorPickerOffer(offer);
      setColorPickerMode('buy');
      setSelectedVariantIdx(0);
      return;
    }
    const firstVariant = variants[0];
    const fvLayers2 = firstVariant?.layers;
    const fvWeight2 = formatOfferWeight(firstVariant ? null : offer.weight, fvLayers2);
    addItem({
      id: offer.id,
      title: offer.title,
      price: firstVariant ? firstVariant.priceEUR : offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: firstVariant ? firstVariant.stock : getOfferStock(offer),
      variant_name: firstVariant ? firstVariant.color_name : offer.color_name,
      variant_color: firstVariant ? getVariantColor(firstVariant) : offer.color_hex,
      variant_layers: firstVariant?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams, color_hex: l.color_hex, color_name: l.color_name })) || undefined,
      category: offer.category,
      material: firstVariant ? firstVariant.plastic_type : offer.material,
      weight: fvWeight2,
    }, offer.category === 'digital' ? 1 : 1);
    router.push('/cart');
  };

  const confirmVariantAndAdd = () => {
    if (!colorPickerOffer) return;
    const variants = colorPickerOffer.color_variants || [];
    const v = variants[selectedVariantIdx];
    const vLayers = v?.layers;
    const vWeight = formatOfferWeight(v ? null : colorPickerOffer.weight, vLayers);
    addItem({
      id: colorPickerOffer.id,
      title: colorPickerOffer.title,
      price: v ? v.priceEUR : colorPickerOffer.price,
      image_url: colorPickerOffer.image_urls?.[0] || null,
      seller_id: colorPickerOffer.user_id,
      stock: v ? v.stock : getOfferStock(colorPickerOffer),
      variant_name: v ? v.color_name : colorPickerOffer.color_name,
      variant_color: v ? getVariantColor(v) : colorPickerOffer.color_hex,
      variant_layers: v?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams, color_hex: l.color_hex, color_name: l.color_name })) || undefined,
      category: colorPickerOffer.category,
      material: v ? v.plastic_type : colorPickerOffer.material,
      weight: vWeight,
    }, colorPickerOffer.category === 'digital' ? 1 : 1);
    if (colorPickerMode === 'buy') {
      setColorPickerOffer(null);
      router.push('/cart');
    } else {
      setLastAddedItem(colorPickerOffer);
      setColorPickerOffer(null);
      setShowModal(true);
    }
  };

  const toggleFavorite = async (offerId: string) => {
    if (!currentUser) return router.push('/login');

    const isSaved = savedIds.includes(offerId);

    if (isSaved) {
      setSavedIds(prev => prev.filter(id => id !== offerId));
      await supabase.from('favorites').delete().match({ user_id: currentUser.id, offer_id: offerId });
    } else {
      setSavedIds(prev => [...prev, offerId]);
      await supabase.from('favorites').insert({ user_id: currentUser.id, offer_id: offerId });

      const likedOffer = offers.find(o => o.id === offerId);
      if (likedOffer) {
        const isSelfLike = likedOffer.user_id === currentUser.id;

        // Fallback-safe insert
        const { error } = await supabase.from('notifications').insert({
          user_id: likedOffer.user_id,
          title: isSelfLike ? "You're your biggest fan! 😉" : "New Like! ❤️",
          message: isSelfLike
            ? `No wonder you like "${likedOffer.title}"! It's your own masterpiece, after all.`
            : `Someone liked your "${likedOffer.title}" item! Start a conversation!`,
          type: 'like',
          // Only offer chat if it's NOT a self-like
          sender_id: isSelfLike ? null : currentUser.id,
          offer_id: isSelfLike ? null : offerId,
          is_read: false
        });

        // If above failed (missing columns), try without extra data
        if (error) {
          console.warn("Retrying notification without extra columns:", error.message);
          await supabase.from('notifications').insert({
            user_id: likedOffer.user_id,
            title: isSelfLike ? "You're your biggest fan! 😉" : "New Like! ❤️",
            message: isSelfLike
              ? `No wonder you like "${likedOffer.title}"! It's your own masterpiece, after all.`
              : `Someone liked your "${likedOffer.title}" item! [USER:${currentUser.id}:${offerId}]`,
            type: 'like',
            is_read: false
          });
        }

        // Email notification (fire & forget)
        fetch('/api/order/like-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerId: likedOffer.user_id,
            productTitle: likedOffer.title,
            isSelfLike,
          }),
        }).catch(() => { });
      }
    }
  };

  // Extract unique materials for filters and append them clearly
  const availableMaterials = Array.from(new Set(offers.flatMap(o => {
    const mats = [];
    if (o.material) mats.push(o.material);
    if (o.color_variants) {
      o.color_variants.forEach(v => {
        if (v.plastic_type) mats.push(v.plastic_type);
        if (v.layers) v.layers.forEach((l: any) => { if (l.plastic_type) mats.push(l.plastic_type); });
      });
    }
    return mats;
  }))).filter(Boolean);

  // Combine core materials with dynamically added ones, ensuring cores are first
  const displayMaterials = Array.from(new Set([...CORE_MATS, ...availableMaterials])).sort((a, b) => {
    const aIdx = CORE_MATS.indexOf(a);
    const bIdx = CORE_MATS.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  const filteredOffers = offers
    .filter(offer => {
      if (categoryFilter !== 'all' && offer.category !== categoryFilter) return false;
      
      // Filter Material
      if (filterMaterial) {
        const hasMaterial = offer.material === filterMaterial || 
          (offer.color_variants || []).some(v => v.plastic_type === filterMaterial || v.layers?.some((l: any) => l.plastic_type === filterMaterial));
        if (!hasMaterial) return false;
      }
      
      // Filter Color by keyword matching
      if (filterColorId) {
        const baseColor = BASE_COLORS.find(c => c.id === filterColorId);
        if (baseColor) {
           const checkStr = (str?: string) => {
             if (!str) return false;
             const lb = str.toLowerCase();
             return baseColor.keywords.some(kw => lb.includes(kw));
           };
           const hasColor = checkStr(offer.color_name) || 
             (offer.color_variants || []).some(v => checkStr(v.color_name) || v.layers?.some(l => checkStr(l.color_name)));
           if (!hasColor) return false;
        }
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          offer.title,
          offer.description,
          offer.material,
          offer.color_name,
          offer.dimensions,
          offer.weight,
          ...(offer.color_variants || []).map(v => `${v.label} ${v.plastic_type} ${v.color_name} ${(v.layers || []).map(l => `${l.color_name} ${(l as any).plastic_type || ''}`).join(' ')}`),
        ].filter(Boolean).join(' ').toLowerCase();

        return searchableText.includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      const stockA = getOfferStock(a);
      const stockB = getOfferStock(b);
      if (stockA === 0 && stockB > 0) return 1;
      if (stockA > 0 && stockB === 0) return -1;
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <>
      {/* ---- COLOR PICKER MODAL ---- */}
      {colorPickerOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setColorPickerOffer(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black uppercase text-gray-900 leading-none">Choose Color</h3>
                <p className="text-xs text-gray-400 font-bold mt-0.5">{colorPickerOffer.title}</p>
              </div>
              <button onClick={() => setColorPickerOffer(null)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition">
                <X size={18} />
              </button>
            </div>

            {/* Variant grid */}
            <div className="flex flex-col gap-2 mb-5 max-h-64 overflow-y-auto pr-1">
              {(colorPickerOffer.color_variants || []).map((v, idx) => {
                const isSelected = selectedVariantIdx === idx;
                const isSoldOut = v.stock === 0;
                return (
                  <button
                    key={idx}
                    disabled={isSoldOut}
                    onClick={() => setSelectedVariantIdx(idx)}
                    className={`relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${isSoldOut ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' :
                      isSelected ? 'border-blue-600 bg-blue-50 shadow-md' : 'border-gray-100 hover:border-gray-300 bg-white'
                      }`}
                  >
                    {/* Color swatch(es) */}
                    <div className="flex -space-x-1">
                      {v.isMultiColor && v.layers ? (
                        v.layers.slice(0, 4).map((l, li) => (
                          <div key={li} className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: l.color_hex || '#ccc' }} />
                        ))
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: getVariantColor(v) }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <span className={`block font-bold text-sm truncate ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>
                        {v.label || v.color_name || 'Variant'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {v.plastic_type || 'PLA'} · {colorPickerOffer.category === 'digital' ? <span className="text-lg leading-none">∞</span> : `${v.stock} in stock`}
                      </span>
                    </div>

                    {/* Price */}
                    <span className={`text-sm font-black shrink-0 ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      {formatPrice(v.priceEUR)}
                    </span>

                    {/* Selected checkmark */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}

                    {isSoldOut && (
                      <span className="absolute top-2 right-2 bg-red-100 text-red-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Sold Out</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Confirm button */}
            <button
              onClick={confirmVariantAndAdd}
              className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-600 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {colorPickerMode === 'buy' ? <><Zap size={16} className="fill-white" /> Buy Now</> : <><ShoppingBag size={16} /> Add to Cart</>}
            </button>

            <p className="text-center text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-wider">or <button onClick={() => { setColorPickerOffer(null); router.push(`/offer/${colorPickerOffer.id}`); }} className="underline hover:text-gray-700 transition">View Full Details</button></p>
          </div>
        </div>
      )}

      {showModal && lastAddedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4"><CheckCircle size={32} /></div>
              <h3 className="text-xl font-black uppercase text-gray-900 mb-2">Added to Cart!</h3>
              <p className="text-gray-500 text-sm mb-6"><span className="font-bold text-gray-900">{lastAddedItem.title}</span> is in your bag.</p>
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => router.push('/cart')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg">Go to Cart</button>
                <button onClick={() => setShowModal(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Continue Shopping</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <Link href="/" className="flex-shrink-0"><img src="/logo.jpg" alt="Printis" className="h-8 w-auto rounded-xl object-cover hover:opacity-80 transition" /></Link>
        <div className="flex-1 max-w-2xl relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Magic Search: name, material, color, dimensions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-100 hover:bg-white focus:bg-white border-2 border-transparent focus:border-blue-600 rounded-full text-sm font-medium transition-all outline-none" />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-full transition-all flex-shrink-0 border-2 ${showFilters || filterMaterial || filterColorId ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-500'}`}
            title="Advanced Filters"
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="p-3 rounded-full bg-gray-900 text-white hover:bg-red-600 shadow-lg transition-all" 
          >
            <X size={20} />
          </Link>
        </div>
      </nav>

      <div className="px-6 py-8 max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex p-1 bg-black/5 rounded-full shadow-inner border border-black/5 backdrop-blur-sm">
            {['job', 'physical', 'digital'].map((cat) => {
              const isActive = categoryFilter === cat;
              const colors: any = {
                digital: 'text-orange-600 digital-color',
                job: 'text-blue-600 job-color',
                physical: 'text-emerald-600 physical-color'
              };
              return (
                <button 
                  key={cat} 
                  onClick={() => setCategoryFilter(cat)} 
                  className={`px-7 py-3.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                    isActive 
                      ? `bg-active-light ${colors[cat]} shadow-xl scale-105 z-10 category-btn-active` 
                      : 'text-gray-400 hover:text-gray-600'
                  } text-center`}
                  style={{ transitionDuration: '1.5s' }}
                >
                  {cat === 'job' ? 'Print On Demand' : cat === 'digital' ? '3D Files' : '3D Items'}
                </button>
              )
            })}
          </div>
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase hover:border-blue-500 transition shadow-sm">
              <ArrowUpDown size={14} />
              {sortBy === 'newest' ? 'Newest' : sortBy === 'price_asc' ? 'Price: Low to High' : 'Price: High to Low'}
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 overflow-hidden">
              <button onClick={() => setSortBy('newest')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase cursor-pointer z-50 relative">Newest</button>
              <button onClick={() => setSortBy('price_asc')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase cursor-pointer z-50 relative">Price: Low to High</button>
              <button onClick={() => setSortBy('price_desc')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase cursor-pointer z-50 relative">Price: High to Low</button>
            </div>
          </div>
        </div>
        
        {/* FILTERS PANEL */}
        <div className={`transition-all duration-500 origin-top overflow-hidden ${showFilters ? 'max-h-[800px] opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}>
           <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-lg flex flex-col md:flex-row gap-8">
              {/* Material Filter */}
              <div className="flex-1 space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                   <Layers size={14} /> Filter by Material
                 </h4>
                 <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterMaterial('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMaterial === '' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>All Materials</button>
                    {displayMaterials.map(mat => (
                      <button key={mat} onClick={() => setFilterMaterial(mat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterMaterial === mat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent hover:border-gray-200'}`}>{mat}</button>
                    ))}
                 </div>
              </div>
              
              <div className="w-px bg-gray-100 hidden md:block"></div>

              {/* Color Filter */}
              <div className="flex-1 space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                   <Palette size={14} /> Filter by Color
                 </h4>
                 <div className="flex items-center gap-3">
                    <button onClick={() => setFilterColorId('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filterColorId === '' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>Any Color</button>
                    
                    {/* Rainbow Circles grid */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {BASE_COLORS.map(col => {
                        const isSelected = filterColorId === col.id;
                        return (
                          <button 
                            key={col.id} 
                            onClick={() => setFilterColorId(col.id)} 
                            title={col.name}
                            className={`w-6 h-6 rounded-full transition-all border-2 ${isSelected ? 'scale-125 border-blue-600 shadow-lg z-10' : 'border-black/5 shadow-sm hover:scale-110 hover:border-gray-300'}`}
                            style={{ backgroundColor: col.hex }}
                          />
                        );
                      })}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div> : filteredOffers.length === 0 ? (
          <div className="text-center py-20 opacity-50 text-gray-900"><Package className="mx-auto mb-4 text-gray-200" size={64} /><h2 className="text-xl font-black uppercase">No Listings Here</h2></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredOffers.map((offer) => {
              const offerSoldOut = isOfferSoldOut(offer);
              const offerStock = getOfferStock(offer);
              return (
              <div
                key={offer.id}
                onClick={() => router.push(`/offer/${offer.id}`)} // CAŁA KARTA KLIKALNA
                className={`group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col relative cursor-pointer ${offerSoldOut ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:-translate-y-2'}`}
              >
                {offerSoldOut && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/20 backdrop-blur-[2px]">
                    <div className="bg-red-600 text-white text-xs font-black uppercase tracking-[0.2em] py-3 px-10 -rotate-12 shadow-2xl border-2 border-white">Sold Out</div>
                  </div>
                )}
                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                  {offer.image_urls?.[0] ? <img src={offer.image_urls[0]} alt={offer.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" /> : <div className="h-full w-full flex items-center justify-center text-gray-300 bg-gray-50"><Package size={32} /></div>}
                  <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[9px] font-black uppercase text-gray-900 shadow-sm z-20">{offer.category === 'job' ? 'Request' : offer.category === 'digital' ? 'File' : 'Item'}</div>

                  {/* LIKE BUTTON - Zatrzymujemy propagację (e.stopPropagation), żeby nie wchodziło w ofertę */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(offer.id); }}
                    className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur rounded-full hover:bg-white transition-all shadow-sm z-40"
                  >
                    <Heart size={18} className={`transition-colors ${savedIds.includes(offer.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                  </button>

                  {!offerSoldOut && (!currentUser || currentUser.id !== offer.user_id) && (offer.category !== 'job' || userRoles.includes('printer')) && (() => {
                    const isAlreadyInCart = offer.category === 'digital' && items.some(i => i.id === offer.id);
                    return (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); isAlreadyInCart ? router.push('/cart') : handleAddToCart(offer); }}
                        className={`absolute bottom-4 right-4 w-10 h-10 rounded-full shadow-lg flex items-center justify-center translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-40 cursor-pointer ${isAlreadyInCart ? 'bg-green-100 text-green-600' : 'bg-white text-black hover:bg-blue-600 hover:text-white'}`}
                        title={isAlreadyInCart ? 'Already in Cart' : offer.category === 'job' ? 'Fulfill Request' : 'Add to Cart'}
                      >
                        {isAlreadyInCart ? <Check size={18} /> : <ShoppingBag size={18} />}
                      </button>
                    );
                  })()}
                </div>

                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">{offer.title}</h3>
                  {offer.category !== 'digital' && (() => {
                    const firstVariant = (offer.color_variants || [])[0];
                    const layers = firstVariant?.layers;
                    const isMultiLayer = layers && layers.length > 1;
                    const itemWeight = formatOfferWeight(offer.weight, layers);
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {isMultiLayer ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-sm">
                            <Layers size={10} /> {layers.length}-Color Print
                          </span>
                        ) : (
                          offer.material && <span className="text-[9px] font-black uppercase text-purple-600 tracking-tighter bg-purple-50 px-1.5 py-0.5 rounded-sm">{offer.material}</span>
                        )}
                        <span className="text-[9px] font-black uppercase text-amber-600 tracking-tighter bg-amber-50 px-1.5 py-0.5 rounded-sm">{itemWeight}</span>
                      </div>
                    );
                  })()}

                  {/* Color variant swatches preview */}
                  {offer.category === 'physical' && !offerSoldOut && (() => {
                    const variants = offer.color_variants || [];
                    if (variants.length > 1) {
                      const displayVariants = variants.slice(0, 5);
                      const extra = variants.length - displayVariants.length;
                      return (
                        <div className="flex items-center gap-2 mt-1 mb-2">
                          <div className="flex -space-x-1.5">
                            {displayVariants.map((v, vi) => (
                              <div
                                key={vi}
                                title={v.color_name}
                                className="w-4 h-4 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-125 hover:z-10"
                                style={{ backgroundColor: getVariantColor(v) }}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full">
                            <Palette size={8} className="text-purple-500" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-purple-600">
                              {variants.length} variants{extra > 0 ? ` (+${extra})` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {!offerSoldOut && offer.category !== 'digital' && !(offer.color_variants && offer.color_variants.length > 1) && (
                    <div className="flex items-center gap-1.5 mt-1 mb-3 bg-blue-50 w-fit px-2 py-0.5 rounded-sm">
                      <MessageSquare size={10} className="text-blue-500" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-600">Customizable</span>
                    </div>
                  )}

                  {/* --- CARD FOOTER --- */}
                  <div className="mt-auto border-t border-gray-100 pt-3">
                    {offer.is_negotiable ? (
                      <button
                        onClick={(e) => { 
                          e.preventDefault(); 
                          e.stopPropagation(); 
                          router.push(`/offer/${offer.id}`);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] hover:shadow-xl hover:shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        <Zap size={14} className="fill-white/20" />
                        Offer The Price
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          {/* Dla fizycznych z wariantami — po prostu pokaż 'From X' zamiast wylistowywać wszystko */}
                          {(() => {
                            const variants = offer.color_variants || [];
                            if (offer.category === 'physical' && variants.length > 1) {
                              const prices = variants.map((v: any) => v.priceEUR || 0);
                              const minPrice = Math.min(...prices);
                              const maxPrice = Math.max(...prices);
                              return (
                                <>
                                  <div className="flex items-baseline gap-1 pb-1">
                                    {minPrice !== maxPrice && <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">From</span>}
                                    <span className="text-lg font-black text-gray-900 leading-none">{formatPrice(minPrice)}</span>
                                  </div>
                                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">+ shipping</span>
                                </>
                              );
                            }
                            return (
                              <>
                                <span className="text-lg font-black text-gray-900 leading-none pb-1">{formatPrice(offer.price)}</span>
                                {offer.category !== 'digital' && (
                                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">+ shipping</span>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {offer.category === 'job' && !userRoles.includes('printer') ? (
                          <button disabled className="flex items-center bg-gray-50 text-red-500 px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest cursor-not-allowed border border-red-100">
                            Printer Role Required
                          </button>
                        ) : !offerSoldOut && (!currentUser || currentUser.id !== offer.user_id) ? (() => {
                          const isAlreadyInCart = offer.category === 'digital' && items.some(i => i.id === offer.id);
                          return (
                            <button
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                isAlreadyInCart ? router.push('/cart') : handleBuyNow(offer);
                              }}
                              className={`flex items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${isAlreadyInCart ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-900 text-white hover:bg-blue-600'}`}
                            >
                              {isAlreadyInCart ? <><Check size={12} /> In Cart</> : offer.category === 'physical' && (offer.color_variants || []).length > 1
                                ? <><Palette size={12} /> Pick Color</>
                                : <><Zap size={12} className="fill-white" /> {offer.category === 'job' ? 'Fulfill' : 'Buy Now'}</>
                              }
                            </button>
                          );
                        })() : (
                          !offerSoldOut && <span className="text-gray-300 group-hover:text-blue-600 transition-colors"><ArrowRight size={20} /></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-900" /></div>}>
        <MarketplaceContent />
      </Suspense>
    </main>
  );
}