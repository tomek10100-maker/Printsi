'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2, Search, ShoppingBag, X,
  ArrowUpDown, Package, ArrowRight, CheckCircle, Heart, Zap, MessageSquare
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
};

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCategory = searchParams.get('category') || 'physical';
  const { addItem } = useCart();
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

  const fetchOffers = useCallback(async () => {
    const { data, error } = await supabase.from('offers').select('*').eq('is_custom', false);
    if (error) {
      console.error('Błąd pobierania ofert:', error);
    } else {
      setOffers(data || []);
      console.log("📥 Pobrane oferty (Initial Load):", data?.length);
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
    addItem({
      id: offer.id,
      title: offer.title,
      price: offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: offer.stock
    });
    setLastAddedItem(offer);
    setShowModal(true);
  };

  const handleBuyNow = (offer: Offer) => {
    if (offer.stock <= 0) return;

    addItem({
      id: offer.id,
      title: offer.title,
      price: offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: offer.stock
    });

    router.push('/cart');
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
        <Link href="/" className="flex-shrink-0"><img src="/logo.jpg" alt="Printsi" className="h-8 w-auto hover:opacity-80 transition" /></Link>
        <div className="flex-1 max-w-2xl relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-100 hover:bg-white focus:bg-white border-2 border-transparent focus:border-blue-600 rounded-full text-sm font-medium transition-all outline-none" />
        </div>
        <div className="flex items-center gap-3"><Link href="/" className="p-3 rounded-full bg-gray-900 text-white hover:bg-red-600 transition shadow-lg"><X size={20} /></Link></div>
      </nav>

      <div className="px-6 py-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex p-1 bg-gray-100 rounded-full shadow-inner">
          {['physical', 'digital', 'job'].map((cat) => {
            // Jeżeli to job, pokaż to tylko jeśli user ma rolę "printer" 
            if (cat === 'job' && userRoles.length > 0 && !userRoles.includes('printer')) {
              return null;
            }
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

                  {offer.stock > 0 && (!currentUser || currentUser.id !== offer.user_id) && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(offer); }}
                      className="absolute bottom-4 right-4 w-10 h-10 bg-white text-black rounded-full shadow-lg flex items-center justify-center translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-blue-600 hover:text-white z-40 cursor-pointer"
                      title="Add to Cart"
                    >
                      <ShoppingBag size={18} />
                    </button>
                  )}
                </div>

                <div className="p-5 flex flex-col flex-grow">
                  <h3 className="text-base font-bold text-gray-900 mb-1 line-clamp-1">{offer.title}</h3>

                  {offer.stock > 0 && offer.category !== 'digital' && (
                    <div className="flex items-center gap-1.5 mt-1 mb-3 bg-blue-50 w-fit px-2 py-0.5 rounded-sm">
                      <MessageSquare size={10} className="text-blue-500" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-600">Customizable</span>
                    </div>
                  )}

                  {/* --- CARD FOOTER --- */}
                  <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 gap-2">
                    <span className="text-lg font-black text-gray-900">{formatPrice(offer.price)}</span>

                    {offer.stock > 0 && (!currentUser || currentUser.id !== offer.user_id) ? (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBuyNow(offer); }}
                        className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md active:scale-95"
                      >
                        <Zap size={12} className="fill-white" /> Buy Now
                      </button>
                    ) : (
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