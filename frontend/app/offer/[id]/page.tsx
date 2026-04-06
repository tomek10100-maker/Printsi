'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingBag, Truck, ShieldCheck, Box,
  Minus, Plus, Share2, User as UserIcon, Star, Ban, Heart, MessageSquare, Loader2, Check, Ruler, Edit, Layers, CheckCircle
} from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { parseWeightToGrams } from '../../lib/dhlRates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addItem, items } = useCart();
  const { formatPrice } = useCurrency();
  const [showModal, setShowModal] = useState(false);

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [showShareToast, setShowShareToast] = useState(false);
  const [sellerOffers, setSellerOffers] = useState<any[]>([]);
  const [creatingChat, setCreatingChat] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // 1. Pobierz ofertę
      const { data, error } = await supabase
        .from('offers')
        .select('*, profiles(full_name, avatar_url, city, country)')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error("Error:", error);
        router.push('/gallery');
      } else {
        setOffer(data);
        if (data.image_urls && data.image_urls.length > 0) setSelectedImage(data.image_urls[0]);

        // Pobierz inne oferty tego usera
        const { data: otherOffers } = await supabase
          .from('offers')
          .select('*')
          .eq('user_id', data.user_id)
          .eq('is_custom', false)
          .neq('id', data.id)
          .limit(4);
        
        setSellerOffers(otherOffers || []);
      }

      // 2. Sprawdź czy polubione i role usera
      if (user && data) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('offer_id', data.id)
          .single();

        if (fav) setIsFavorite(true);

        const { data: profile } = await supabase
          .from('profiles')
          .select('roles')
          .eq('id', user.id)
          .single();

        if (profile?.roles) {
          setUserRoles(profile.roles);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [params.id, router]);

  const handleAddToCart = () => {
    // ... item logic ...
    if (!offer) return;
    addItem({
      id: offer.id,
      title: offer.title,
      price: currentPrice,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: currentStock,
      variant_name: currentColor,
      variant_color: currentColorHex,
      variant_layers: currentVariant?.layers
        ? currentVariant.layers.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams }))
        : undefined,
      category: offer.category
    }, isDigital ? 1 : quantity);
    setShowModal(true);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 3000);
  };

  const toggleFavorite = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (isFavorite) {
      setIsFavorite(false);
      await supabase.from('favorites').delete().match({ user_id: currentUser.id, offer_id: offer.id });
    } else {
      setIsFavorite(true);
      await supabase.from('favorites').insert({ user_id: currentUser.id, offer_id: offer.id });

      // Notify seller
      const isSelfLike = offer.user_id === currentUser.id;
      
      // In-app Notification
      await supabase.from('notifications').insert({
        user_id: offer.user_id,
        title: isSelfLike ? "You're your biggest fan! 😉" : "New Like! ❤️",
        message: isSelfLike
          ? `No wonder you like "${offer.title}"! It's your work after all.`
          : `Someone liked your "${offer.title}" item! Start a conversation!`,
        type: 'like',
        sender_id: isSelfLike ? null : currentUser.id,
        offer_id: isSelfLike ? null : offer.id,
        is_read: false
      });

      // Email notification (fire & forget)
      fetch('/api/order/like-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: offer.user_id,
          productTitle: offer.title,
          isSelfLike
        }),
      }).catch(() => { });
    }
  };

  const handleContactMaker = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) return;
    router.push(`/profile/messages?seller_id=${offer.user_id}&offer_id=${offer.id}`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-gray-900" size={40} /></div>;
  if (!offer) return <div className="min-h-screen flex items-center justify-center">Product not found.</div>;

  const seller = offer.profiles;
  const isOwner = currentUser && currentUser.id === offer.user_id;
  const isDigital = offer.category === 'digital';

  const variants = offer.color_variants || [];
  const hasVariants = variants.length > 0;
  const currentVariant = hasVariants ? variants[selectedVariantIndex] : null;

  const currentPrice = currentVariant ? currentVariant.priceEUR : offer.price;
  const currentStock = currentVariant ? currentVariant.stock : offer.stock;
  const currentColor = currentVariant ? currentVariant.color_name : (offer.color_name || offer.color);
  const currentColorHex = currentVariant ? currentVariant.primaryColor : (offer.color_hex || offer.color);
  const currentMaterial = currentVariant ? currentVariant.plastic_type : offer.material;
  const currentWeight = currentVariant && currentVariant.layers
    ? currentVariant.layers.reduce((acc: number, l: any) => acc + (parseFloat(l.grams) || 0), 0) + 'g'
    : offer.weight;

  const isOutOfStock = currentStock === 0;
  const weightGrams = currentWeight ? parseWeightToGrams(currentWeight.toString()) : null;
  const isAlreadyInCart = isDigital && items.some(i => i.id === offer.id);

  return (
    <main className="min-h-screen bg-white font-sans text-gray-900 pb-20">

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center transition-all duration-300">
        <Link href="/gallery" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition"><ArrowLeft size={16} /> Back to Gallery</Link>
        <Link href="/cart" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition relative">
          <ShoppingBag size={20} />
          {items.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-in zoom-in duration-300">{items.length}</span>}
        </Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* LEWA STRONA (IMAGE) */}
        <div className="space-y-6">
          <div className="aspect-square bg-gray-50 rounded-[40px] overflow-hidden border border-gray-100 relative shadow-2xl">
            {isOutOfStock && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                <div className="bg-red-600 text-white text-xl font-black uppercase tracking-[0.2em] py-4 px-12 -rotate-12 border-4 border-white shadow-2xl">Sold Out</div>
              </div>
            )}
            {selectedImage ? (
              <img src={selectedImage} alt={offer.title} className="w-full h-full object-cover animate-in fade-in duration-500" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-200"><Box size={80} strokeWidth={1} /></div>
            )}
            <div className="absolute top-6 left-6 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900 shadow-sm border border-gray-100">{offer.category}</div>
          </div>
          {offer.image_urls && offer.image_urls.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {offer.image_urls.map((url: string, idx: number) => (
                <button 
                  key={idx} 
                  onClick={() => setSelectedImage(url)} 
                  className={`w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 shadow-sm ${selectedImage === url ? 'border-blue-600 scale-105 shadow-blue-100' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                >
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRAWA STRONA (CONTENT) */}
        <div className="flex flex-col">
          <div className="mb-8">
            <h1 className="text-5xl font-black uppercase tracking-tight text-gray-900 mb-4 leading-[1.1]">{offer.title}</h1>
            
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black text-blue-600">
                {formatPrice(currentPrice)}
              </div>
              <div className="h-6 w-px bg-gray-200" />
              <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isOutOfStock ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                {isOutOfStock ? 'Currently Unavailable' : (isDigital ? 'Ready to Download' : 'Ready to Ship')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 bg-gray-50 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
              {seller?.avatar_url ? (
                <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="text-gray-300" size={28} />
              )}
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Crafted by</span>
              <span className="font-black text-gray-900 text-lg">{seller?.full_name || 'Anonymous Maker'}</span>
            </div>
            <div className="ml-auto">
              <Link
                href={`/user/${offer.user_id}`}
                className="px-5 py-2.5 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-gray-200"
              >
                Profile
              </Link>
            </div>
          </div>

          <div className="prose prose-lg text-gray-600 mb-10 max-w-none font-medium leading-relaxed">
            {offer.description}
          </div>

          {!isDigital && (
            <div className="space-y-6 mb-10">
              {/* Dimensions & Weight Grid */}
              <div className="grid grid-cols-2 gap-4">
                {offer.dimensions && (
                  <div className="p-5 bg-gray-50 rounded-[32px] border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Ruler size={16} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Scale & Size</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {offer.dimensions.split(',').map((dim: string, idx: number) => (
                        <span key={idx} className="text-sm font-black text-gray-900 leading-tight">{dim.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                {currentWeight && (
                  <div className="p-5 bg-gray-50 rounded-[32px] border border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers size={16} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Net Weight</span>
                    </div>
                    <span className="text-2xl font-black text-gray-900 truncate block">{currentWeight}</span>
                  </div>
                )}
              </div>

              {/* COLOR VARIANTS SELECTION */}
              {hasVariants && (
                <div className="p-2 bg-gray-100 rounded-[32px] border border-gray-200">
                  <div className="flex flex-col gap-2">
                    {variants.map((v: any, idx: number) => {
                      const isSelected = selectedVariantIndex === idx;
                      const isSoldOut = v.stock === 0;
                      return (
                        <button
                          key={idx}
                          disabled={isSoldOut}
                          onClick={() => {
                            setSelectedVariantIndex(idx);
                            setQuantity(1);
                          }}
                          className={`relative flex items-center gap-4 p-4 rounded-[24px] transition-all text-left group/var ${isSoldOut
                            ? 'opacity-40 cursor-not-allowed grayscale'
                            : isSelected
                              ? 'bg-white shadow-xl ring-2 ring-blue-600/10'
                              : 'hover:bg-white/60'
                            }`}
                        >
                          <div className="flex -space-x-4 flex-shrink-0">
                            {v.layers && v.layers.length > 0 ? (
                              v.layers.map((l: any, li: number) => (
                                <div key={li}
                                  className="w-12 h-12 rounded-full border-4 border-white shadow-lg transition-transform group-hover/var:scale-105"
                                  style={{ backgroundColor: l.color_hex || '#ccc', zIndex: 10 - li }}
                                />
                              ))
                            ) : (
                              <div className="w-12 h-12 rounded-full border-4 border-white shadow-lg" style={{ backgroundColor: v.primaryColor || v.layers?.[0]?.color_hex || '#ccc' }} />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="block font-black text-sm tracking-tight text-gray-900">
                              {v.layers && v.layers.length > 0 ? (
                                v.layers.map((l: any, li: number) => (
                                  <React.Fragment key={li}>
                                    {li > 0 && <span className="text-blue-500 mx-1">+</span>}
                                    {l.color_name}
                                  </React.Fragment>
                                ))
                              ) : (
                                v.label || v.color_name || 'Individual Choice'
                              )}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{v.plastic_type || 'Premium Filament'}</span>
                          </div>

                          <div className="text-right">
                             <div className={`text-sm font-black transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>{formatPrice(v.priceEUR)}</div>
                             <div className="text-[9px] font-bold text-gray-400 uppercase">{isSoldOut ? 'Sold out' : `${v.stock} pcs left`}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUANTITY & ACTIONS */}
          <div className="mt-auto space-y-6">
            {!isDigital && !isOwner && !isOutOfStock && (
              <div className="flex items-center justify-between p-5 bg-gray-50 rounded-[32px] border border-gray-100">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Quantity</span>
                   <span className="text-[10px] font-bold text-blue-600">{currentStock} pieces available</span>
                 </div>
                 <div className="flex items-center gap-6 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-gray-100 transition active:scale-90"><Minus size={16} /></button>
                    <span className="font-black text-2xl w-8 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                      className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-gray-100 transition active:scale-90"
                      disabled={quantity >= currentStock}
                    >
                      <Plus size={16} />
                    </button>
                 </div>
              </div>
            )}

            <div className="flex gap-4">
              {isOwner ? (
                <Link
                  href={`/edit/${offer.id}`}
                  className="flex-1 py-5 rounded-[24px] font-black uppercase tracking-widest bg-gray-900 text-white hover:bg-blue-600 transition-all shadow-2xl flex items-center justify-center gap-3 group"
                >
                  <Edit size={22} className="group-hover:rotate-12 transition-transform" /> Manage Listing
                </Link>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || isAlreadyInCart}
                  className={`flex-1 py-5 rounded-[24px] font-black uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 ${isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : isAlreadyInCart ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-none' : 'bg-gray-900 text-white hover:bg-blue-600 hover:-translate-y-1'}`}
                >
                  {isOutOfStock ? 'Item Sold Out' : isAlreadyInCart ? <><Check size={22} /> Secured in Cart</> : <><ShoppingBag size={22} /> {offer.category === 'job' ? 'Bid for Print' : 'Get this Print'}</>}
                </button>
              )}

              <button
                onClick={toggleFavorite}
                className={`w-16 h-16 rounded-[24px] border-2 transition-all flex items-center justify-center ${isFavorite ? 'bg-red-50 border-red-200 text-red-500 shadow-red-100 shadow-lg' : 'hover:bg-gray-50 text-gray-400 border-gray-100'}`}
              >
                <Heart size={24} className={isFavorite ? 'fill-red-500 animate-pulse' : ''} />
              </button>

              <button onClick={handleShare} className="w-16 h-16 rounded-[24px] border-2 border-gray-100 hover:bg-gray-50 text-gray-400 transition flex items-center justify-center group relative">
                <Share2 size={24} className="group-hover:scale-110 transition-transform" />
                {showShareToast && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black py-2 px-4 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap shadow-xl">
                    <CheckCircle size={12} className="text-green-400" /> Copied to Clipboard
                  </div>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-y-4 gap-x-8 pt-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Direct from Master-Maker
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <ShieldCheck size={14} className="text-gray-300" /> Printsi Escrow Protection
              </div>
              {isDigital ? (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-wider">
                   <div className="w-2 h-2 rounded-full bg-green-500" /> Instant Download
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <Truck size={14} className="text-gray-300" /> DHL Global Express
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MORE FROM THIS SELLER SECTION --- */}
      {sellerOffers.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-24 border-t border-gray-100 mt-12">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-600 tracking-[0.3em] mb-2 block">Discovery</span>
              <h2 className="text-4xl font-black uppercase tracking-tight text-gray-900">More from {seller?.full_name?.split(' ')[0] || 'this maker'}</h2>
            </div>
            <Link href={`/user/${offer.user_id}`} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-colors border-b border-transparent hover:border-blue-600 pb-1">View Collection</Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {sellerOffers.map((item) => (
              <Link key={item.id} href={`/offer/${item.id}`} className="group block">
                <div className="aspect-square bg-gray-50 rounded-[32px] overflow-hidden border border-gray-100 mb-4 relative shadow-sm transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2">
                  {item.image_urls?.[0] ? (
                    <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200"><Box size={40} /></div>
                  )}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 shadow-lg">
                    <div className="text-[10px] font-black uppercase text-gray-400 truncate mb-0.5">{item.category}</div>
                    <div className="text-sm font-black text-gray-900 truncate">{item.title}</div>
                  </div>
                </div>
                <div className="px-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest truncate max-w-[60%]">{item.title}</span>
                    <span className="text-xs font-black text-blue-600">{formatPrice(item.price)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Added to Cart Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-6 shadow-inner ring-8 ring-green-50/50">
                <CheckCircle size={40} strokeWidth={2} />
              </div>
              <h3 className="text-2xl font-black uppercase text-gray-900 mb-2 tracking-tight">Added to Bag</h3>
              <p className="text-gray-500 text-sm mb-8 font-medium leading-relaxed">
                <span className="text-gray-900 font-bold">"{offer.title}"</span> is ready for checkout.
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => router.push('/cart')} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 transition-all shadow-lg hover:-translate-y-1 flex items-center justify-center gap-2"><ShoppingBag size={16} /> Checkout Now</button>
                <button onClick={() => setShowModal(false)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 transition-all">Keep Shopping</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}