'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2, Search, ShoppingBag, X,
  ArrowUpDown, Package, ArrowRight, CheckCircle, Heart, Zap, MessageSquare, Palette, Check
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  const fetchOffers = useCallback(async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('is_custom', false);
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
    if (offer.stock <= 0) return;
    const variants = offer.color_variants || [];
    if (offer.category === 'physical' && variants.length > 1) {
      // open color picker
      setColorPickerOffer(offer);
      setColorPickerMode('add');
      setSelectedVariantIdx(0);
      return;
    }
    const firstVariant = variants[0];
    addItem({
      id: offer.id,
      title: offer.title,
      price: firstVariant ? firstVariant.priceEUR : offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: firstVariant ? firstVariant.stock : offer.stock,
      variant_name: firstVariant ? firstVariant.color_name : offer.color_name,
      variant_color: firstVariant ? getVariantColor(firstVariant) : offer.color_hex,
      variant_layers: firstVariant?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams })) || undefined,
      category: offer.category,
    }, offer.category === 'digital' ? 1 : 1);
    setLastAddedItem(offer);
    setShowModal(true);
  };

  const handleBuyNow = (offer: Offer) => {
    if (offer.stock <= 0) return;
    const variants = offer.color_variants || [];
    if (offer.category === 'physical' && variants.length > 1) {
      setColorPickerOffer(offer);
      setColorPickerMode('buy');
      setSelectedVariantIdx(0);
      return;
    }
    const firstVariant = variants[0];
    addItem({
      id: offer.id,
      title: offer.title,
      price: firstVariant ? firstVariant.priceEUR : offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: firstVariant ? firstVariant.stock : offer.stock,
      variant_name: firstVariant ? firstVariant.color_name : offer.color_name,
      variant_color: firstVariant ? getVariantColor(firstVariant) : offer.color_hex,
      variant_layers: firstVariant?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams })) || undefined,
      category: offer.category,
    }, offer.category === 'digital' ? 1 : 1);
    router.push('/cart');
  };

  const confirmVariantAndAdd = () => {
    if (!colorPickerOffer) return;
    const variants = colorPickerOffer.color_variants || [];
    const v = variants[selectedVariantIdx];
    addItem({
      id: colorPickerOffer.id,
      title: colorPickerOffer.title,
      price: v ? v.priceEUR : colorPickerOffer.price,
      image_url: colorPickerOffer.image_urls?.[0] || null,
      seller_id: colorPickerOffer.user_id,
      stock: v ? v.stock : colorPickerOffer.stock,
      variant_name: v ? v.color_name : colorPickerOffer.color_name,
      variant_color: v ? getVariantColor(v) : colorPickerOffer.color_hex,
      variant_layers: v?.layers?.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams })) || undefined,
      category: colorPickerOffer.category,
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
      if (likedOffer && likedOffer.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: likedOffer.user_id,
          title: "New Like! ❤️",
          message: `Someone liked your item: "${likedOffer.title}"`,
          type: 'like',
          is_read: false
        });

        // Send like email notification (fire & forget)
        fetch('/api/order/like-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerId: likedOffer.user_id,
            productTitle: likedOffer.title,
          }),
        }).catch(() => {});
      }
    }
  };

  const filteredOffers = offers
    .filter(offer => {
      if (categoryFilter !== 'all' && offer.category !== categoryFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return offer.title.toLowerCase().includes(query) || offer.description?.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      if (a.stock === 0 && b.stock > 0) return 1;
      if (a.stock > 0 && b.stock === 0) return -1;
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
                        {v.plastic_type || 'PLA'} · {v.stock} in stock
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
        <Link href="/" className="flex-shrink-0"><img src="/logo.jpg" alt="Printsi" className="h-8 w-auto rounded-xl object-cover hover:opacity-80 transition" /></Link>
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-100 hover:bg-white focus:bg-white border-2 border-transparent focus:border-blue-600 rounded-full text-sm font-medium transition-all outline-none" />
        </div>
        <div className="flex items-center gap-3"><Link href="/" className="p-3 rounded-full bg-gray-900 text-white hover:bg-red-600 transition shadow-lg"><X size={20} /></Link></div>
      </nav>

      <div className="px-6 py-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex p-1 bg-gray-100 rounded-full shadow-inner">
          {['physical', 'digital', 'job'].map((cat) => {
            return (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat ? (cat === 'digital' ? 'bg-white text-purple-600 shadow-md' : cat === 'job' ? 'bg-white text-orange-600 shadow-md' : 'bg-white text-blue-600 shadow-md') : 'text-gray-400 hover:text-gray-600 text-center'}`}>
                {cat === 'job' ? 'Print On Demand' : cat === 'digital' ? '3D Files' : 'Physical Items'}
              </button>
            )
          })}
        </div>
        <div className="relative group">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase hover:border-blue-500 transition">
            <ArrowUpDown size={14} />
            {sortBy === 'newest' ? 'Newest' : sortBy === 'price_asc' ? 'Price: Low to High' : 'Price: High to Low'}
          </button>
          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 overflow-hidden">
            <button onClick={() => setSortBy('newest')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase">Newest</button>
            <button onClick={() => setSortBy('price_asc')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase">Price: Low to High</button>
            <button onClick={() => setSortBy('price_desc')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-xs font-bold uppercase">Price: High to Low</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div> : filteredOffers.length === 0 ? (
          <div className="text-center py-20 opacity-50 text-gray-900"><Package className="mx-auto mb-4 text-gray-200" size={64} /><h2 className="text-xl font-black uppercase">No Listings Here</h2></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredOffers.map((offer) => (
              <div
                key={offer.id}
                onClick={() => router.push(`/offer/${offer.id}`)} // CAŁA KARTA KLIKALNA
                className={`group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col relative cursor-pointer ${offer.stock <= 0 ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:-translate-y-2'}`}
              >
                {offer.stock <= 0 && (
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

                  {offer.stock > 0 && (!currentUser || currentUser.id !== offer.user_id) && (offer.category !== 'job' || userRoles.includes('printer')) && (() => {
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

                  {/* Color variant swatches preview */}
                  {offer.category === 'physical' && offer.stock > 0 && (() => {
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
                              {variants.length} colors{extra > 0 ? ` (+${extra})` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {offer.stock > 0 && offer.category !== 'digital' && !(offer.color_variants && offer.color_variants.length > 1) && (
                    <div className="flex items-center gap-1.5 mt-1 mb-3 bg-blue-50 w-fit px-2 py-0.5 rounded-sm">
                      <MessageSquare size={10} className="text-blue-500" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-600">Customizable</span>
                    </div>
                  )}

                  {/* --- CARD FOOTER --- */}
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 gap-2">
                    <div className="flex flex-col gap-0.5">
                      {/* Fizyczne rzeczy z wariantami – pokaż ceny wariantów */}
                      {(() => {
                        const variants = offer.color_variants || [];
                        if (offer.category === 'physical' && variants.length > 1) {
                          // Pokaż do 2 wariantów z cenami, reszta jako "+N więcej"
                          const shown = variants.slice(0, 2);
                          return (
                            <>
                              {shown.map((v: any, vi: number) => (
                                <div key={vi} className="flex items-center gap-1.5">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                                    style={{ backgroundColor: getVariantColor(v) }}
                                  />
                                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-tight">
                                    {v.color_name || v.label || `Variant ${vi + 1}`}:
                                  </span>
                                  <span className="text-xs font-black text-gray-900 leading-tight">
                                    {formatPrice(v.priceEUR)}
                                  </span>
                                </div>
                              ))}
                              {variants.length > 2 && (
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                  +{variants.length - 2} more colors
                                </span>
                              )}
                              <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">+ shipping</span>
                            </>
                          );
                        }
                        // Dla reszty: jedna cena
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
                    ) : offer.stock > 0 && (!currentUser || currentUser.id !== offer.user_id) ? (() => {
                      const isAlreadyInCart = offer.category === 'digital' && items.some(i => i.id === offer.id);
                      return (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); isAlreadyInCart ? router.push('/cart') : handleBuyNow(offer); }}
                          className={`flex items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${isAlreadyInCart ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-900 text-white hover:bg-blue-600'}`}
                        >
                          {isAlreadyInCart ? <><Check size={12} /> In Cart</> : offer.category === 'physical' && (offer.color_variants || []).length > 1
                            ? <><Palette size={12} /> Pick Color</>
                            : <><Zap size={12} className="fill-white" /> {offer.category === 'job' ? 'Fulfill' : 'Buy Now'}</>
                          }
                        </button>
                      );
                    })() : (
                      offer.stock > 0 && <span className="text-gray-300 group-hover:text-blue-600 transition-colors"><ArrowRight size={20} /></span>
                    )}
                  </div>

                  {offer.stock > 0 && offer.stock < 5 && <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider mt-2">Only {offer.stock} left!</span>}
                </div>
              </div>
            ))}
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