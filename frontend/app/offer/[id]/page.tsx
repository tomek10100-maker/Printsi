'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingBag, Truck, ShieldCheck, Box,
  Minus, Plus, Share2, User as UserIcon, Star, Ban, Heart, MessageSquare, Loader2
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
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [creatingChat, setCreatingChat] = useState(false);

  // --- NOWY STAN: Czy polubione ---
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!params.id) return;

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // 1. Pobierz ofertę
      const { data, error } = await supabase
        .from('offers')
        .select('*, profiles(full_name, avatar_url)')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error("Error:", error);
        router.push('/gallery');
      } else {
        setOffer(data);
        if (data.image_urls && data.image_urls.length > 0) setSelectedImage(data.image_urls[0]);
      }

      // 2. Sprawdź czy polubione
      if (user && data) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('offer_id', data.id)
          .single();

        if (fav) setIsFavorite(true);
      }

      setLoading(false);
    };
    fetchData();
  }, [params.id, router]);

  const handleAddToCart = () => {
    if (!offer) return;
    addItem({
      id: offer.id,
      title: offer.title,
      price: offer.price,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: offer.stock
    }, quantity);
    alert(`Added ${quantity} x ${offer.title} to cart!`);
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
    }
  };

  const handleContactMaker = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) return;

    setCreatingChat(true);

    const { data: existingChat } = await supabase
      .from('chats')
      .select('id')
      .eq('buyer_id', currentUser.id)
      .eq('seller_id', offer.user_id)
      .eq('offer_id', offer.id)
      .single();

    if (existingChat) {
      router.push(`/profile/messages?chat=${existingChat.id}`);
      return;
    }

    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({
        buyer_id: currentUser.id,
        seller_id: offer.user_id,
        offer_id: offer.id
      })
      .select('id')
      .single();

    if (error) {
      console.error(error);
      alert("Error starting chat.");
      setCreatingChat(false);
      return;
    }

    router.push(`/profile/messages?chat=${newChat.id}`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!offer) return <div className="min-h-screen flex items-center justify-center">Product not found.</div>;

  const isOutOfStock = offer.stock === 0;
  const seller = offer.profiles;
  const isOwner = currentUser && currentUser.id === offer.user_id;
  const isDigital = offer.category === 'digital';

  const weightGrams = offer.weight ? parseWeightToGrams(offer.weight) : null;
  const pricePerGram = weightGrams ? offer.price / weightGrams : null;

  return (
    <main className="min-h-screen bg-white font-sans text-gray-900 pb-20">

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <Link href="/gallery" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition"><ArrowLeft size={16} /> Back to Gallery</Link>
        <Link href="/cart" className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><ShoppingBag size={20} /></Link>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* LEWA STRONA */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 relative">
            {isOutOfStock && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/20 backdrop-blur-sm">
                <div className="bg-red-600 text-white text-xl font-black uppercase tracking-[0.2em] py-3 px-12 -rotate-12 border-4 border-white shadow-2xl">Sold Out</div>
              </div>
            )}
            {selectedImage ? <img src={selectedImage} alt={offer.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><Box size={64} /></div>}
            <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-wider">{offer.category}</div>
          </div>
          {offer.image_urls && offer.image_urls.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {offer.image_urls.map((url: string, idx: number) => (
                <button key={idx} onClick={() => setSelectedImage(url)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === url ? 'border-blue-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                  <img src={url} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRAWA STRONA */}
        <div className="flex flex-col">
          <h1 className="text-4xl font-black uppercase tracking-tight text-gray-900 mb-2">{offer.title}</h1>

          <p className="text-2xl font-bold text-blue-600 mb-6">
            {formatPrice(offer.price)}
            <span className="text-sm text-gray-400 font-medium normal-case"> / piece</span>
          </p>

          <div className="flex items-center gap-4 mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="w-12 h-12 bg-white rounded-full overflow-hidden border border-gray-200 flex items-center justify-center">
              {seller?.avatar_url ? (
                <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="text-gray-400" size={24} />
              )}
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-gray-400 tracking-widest">Published by</span>
              <span className="font-bold text-gray-900">{seller?.full_name || 'Anonymous Maker'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={10} className="fill-orange-400 text-orange-400" />
                <span className="text-[10px] font-bold text-gray-500">Verified Seller</span>
              </div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2">
              <Link
                href={`/user/${offer.user_id}`}
                className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition border-b-2 border-transparent hover:border-gray-900"
              >
                View Profile
              </Link>
            </div>
          </div>

          <div className="prose prose-sm text-gray-600 mb-8 max-w-none"><p>{offer.description}</p></div>

          {!isDigital && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">Material</span>
                <span className="font-bold text-gray-900 truncate">{offer.material || 'Standard PLA'}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center">
                <span className="block text-[10px] font-black uppercase text-gray-400 mb-1">Color</span>
                <span className="font-bold text-gray-900 truncate">{offer.color || 'Any'}</span>
              </div>
              {weightGrams && pricePerGram && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center bg-blue-50/30">
                  <span className="block text-[10px] font-black uppercase text-blue-400 mb-1">Weight & Rate</span>
                  <span className="font-bold text-blue-900 truncate">{offer.weight} <span className="text-xs font-medium text-gray-500 opacity-60">({formatPrice(pricePerGram)}/g)</span></span>
                </div>
              )}
            </div>
          )}

          {!isDigital && !isOwner && (
            <div className="mb-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
              <div className="text-center sm:text-left">
                <h4 className="text-sm font-black text-blue-900 mb-1 capitalize">Need a custom modification or bulk order?</h4>
                <p className="text-xs text-blue-700/70 font-bold leading-relaxed max-w-[280px]">Contact the maker to negotiate bulk pricing, request custom colors or different materials.</p>
              </div>
              <button
                onClick={handleContactMaker}
                disabled={creatingChat}
                className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg hover:-translate-y-1 hover:shadow-blue-600/30 active:scale-95"
              >
                {creatingChat ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                Chat with Maker
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-8 w-fit">
            <div className={`flex items-center gap-6 p-4 border border-gray-100 rounded-2xl ${isOutOfStock || isOwner ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-xs font-black uppercase text-gray-400">Quantity:</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition"><Minus size={14} /></button>
                <span className="font-bold text-xl w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(offer.stock, q + 1))}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition ${quantity >= offer.stock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
                  disabled={quantity >= offer.stock}
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{offer.stock} available</span>
            </div>

            {quantity > 1 && !isDigital && !isOwner && (
              <div className="flex items-start gap-2 px-3 py-2 text-xs font-bold text-green-700 bg-green-50 rounded-xl border border-green-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <MessageSquare size={14} className="mt-0.5 shrink-0 text-green-500" />
                <span>Planning to buy more? <button onClick={handleContactMaker} disabled={creatingChat} className="underline decoration-green-300 underline-offset-2 hover:text-green-900 transition hover:decoration-green-500">Ask the maker</button> for volume discounts!</span>
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-auto">
            {isOwner ? (
              <button
                disabled
                className="flex-1 py-4 rounded-xl font-black uppercase tracking-widest bg-gray-100 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 border border-gray-200"
              >
                <Ban size={20} /> Your Item
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-gray-900 text-white hover:bg-blue-600'}`}
              >
                {isOutOfStock ? 'Sold Out' : <><ShoppingBag size={20} /> Add to Cart</>}
              </button>
            )}

            {/* PRZYCISK ULUBIONE (DODANY TUTAJ) */}
            <button
              onClick={toggleFavorite}
              className={`p-4 border border-gray-200 rounded-xl transition flex items-center justify-center ${isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'hover:bg-gray-50 text-gray-400'}`}
            >
              <Heart size={20} className={isFavorite ? 'fill-red-500' : ''} />
            </button>

            <button className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-400 transition"><Share2 size={20} /></button>
          </div>

          <div className="mt-8 flex items-center gap-6 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
            <span className="flex items-center gap-1"><Truck size={14} /> Fast Shipping</span>
            <span className="flex items-center gap-1"><ShieldCheck size={14} /> Buyer Protection</span>
          </div>
        </div>
      </div>
    </main>
  );
}