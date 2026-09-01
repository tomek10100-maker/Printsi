'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ShoppingBag, Truck, ShieldCheck, Box,
  Minus, Plus, Share2, User as UserIcon, Star, Ban, Heart, MessageSquare, Loader2, Check, Ruler, Edit, Layers, CheckCircle, Handshake, Palette, Download, Printer, XCircle, Flag, X, Zap, Wrench
} from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { parseWeightToGrams } from '../../lib/dhlRates';
import { supabase } from '../../lib/supabase';

import { formatOfferWeight } from '../../lib/offerHelpers';
import { getMaterialInfo } from '../../lib/materialHelpers';
import ReviewsSection from '../../components/ReviewsSection';

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
  const [sellerStats, setSellerStats] = useState<{ avgRating: number; count: number }>({ avgRating: 0, count: 0 });
  const [creatingChat, setCreatingChat] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  // Materiały per warstwa: filament_id -> plastic_type
  const [layerMaterials, setLayerMaterials] = useState<Record<string, string>>({});
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [fileDownloaded, setFileDownloaded] = useState(false);

  // Report listing modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

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

        // Pobierz średnią ocenę sprzedającego ze wszystkich jego produktów
        if (data.user_id) {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating')
            .eq('seller_id', data.user_id);

          if (reviewsData && reviewsData.length > 0) {
            const sum = reviewsData.reduce((acc: number, r: any) => acc + (Number(r.rating) || 5), 0);
            const avg = Math.round((sum / reviewsData.length) * 10) / 10;
            setSellerStats({ avgRating: avg, count: reviewsData.length });
          } else {
            setSellerStats({ avgRating: 0, count: 0 });
          }
        }
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

      // Pobierz plastic_type dla każdej warstwy każdego wariantu
      if (data?.color_variants) {
        const filamentIds = new Set<string>();
        data.color_variants.forEach((v: any) => {
          (v.layers || []).forEach((l: any) => {
            if (l.filament_id) filamentIds.add(l.filament_id);
          });
        });
        if (filamentIds.size > 0) {
          const { data: filaments } = await supabase
            .from('filaments')
            .select('id, plastic_type')
            .in('id', Array.from(filamentIds));
          if (filaments) {
            const map: Record<string, string> = {};
            filaments.forEach((f: any) => { map[f.id] = f.plastic_type; });
            setLayerMaterials(map);
          }
        }
      }
    };
    fetchData();
  }, [params.id, router]);

  const handleAddToCart = () => {
    // ... item logic ...
    if (!offer) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) {
      alert("You cannot purchase your own listing.");
      return;
    }
    // Job offers → handled by the dedicated fulfillment panel below
    if (offer.category === 'job') {
      return;
    }
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
      category: offer.category,
      material: currentMaterial,
      weight: currentWeight,
    }, isDigital ? 1 : quantity);
    setShowModal(true);
  };

  const handleAddVariantToCart = (variant: any, variantIdx: number) => {
    if (!offer) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) {
      alert("You cannot purchase your own listing.");
      return;
    }
    if (offer.category === 'job') return;

    const vPrice = variant.priceEUR;
    const vStock = variant.stock;
    const vColor = variant.color_name;
    const vColorHex = variant.primaryColor;
    const vMaterial = variant.plastic_type;
    const vWeight = formatOfferWeight(null, variant.layers);

    addItem({
      id: offer.id,
      title: offer.title,
      price: vPrice,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: vStock,
      variant_name: vColor,
      variant_color: vColorHex,
      variant_layers: variant.layers
        ? variant.layers.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams }))
        : undefined,
      category: offer.category,
      material: vMaterial,
      weight: vWeight,
    }, isDigital ? 1 : quantity);
    setShowModal(true);
  };

  const handleBuyNow = () => {
    if (!offer) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) {
      alert("You cannot purchase your own listing.");
      return;
    }
    if (offer.category === 'job') return;

    if (!isAlreadyInCart) {
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
        category: offer.category,
        material: currentMaterial,
        weight: currentWeight,
      }, isDigital ? 1 : quantity);
    }
    router.push('/checkout');
  };

  const handleBuyVariantNow = (variant: any, variantIdx: number) => {
    if (!offer) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (isOwner) {
      alert("You cannot purchase your own listing.");
      return;
    }
    if (offer.category === 'job') return;

    const vPrice = variant.priceEUR;
    const vStock = variant.stock;
    const vColor = variant.color_name;
    const vColorHex = variant.primaryColor;
    const vMaterial = variant.plastic_type;
    const vWeight = formatOfferWeight(null, variant.layers);

    addItem({
      id: offer.id,
      title: offer.title,
      price: vPrice,
      image_url: offer.image_urls?.[0] || null,
      seller_id: offer.user_id,
      stock: vStock,
      variant_name: vColor,
      variant_color: vColorHex,
      variant_layers: variant.layers
        ? variant.layers.map((l: any) => ({ filament_id: l.filament_id, grams: l.grams }))
        : undefined,
      category: offer.category,
      material: vMaterial,
      weight: vWeight,
    }, isDigital ? 1 : quantity);
    router.push('/checkout');
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

  const handleFulfillJob = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    if (!offer?.file_url) return;

    setDownloadingFile(true);

    // 1. Open file download in new tab
    window.open(offer.file_url, '_blank');
    setFileDownloaded(true);

    // 2. Send notification to job poster
    try {
      await supabase.from('notifications').insert({
        user_id: offer.user_id,
        title: '🖨️ A printer is reviewing your job!',
        message: `A printer has downloaded the 3D file for "${offer.title}" and is evaluating it. You'll be notified when they submit a price proposal.`,
        type: 'job',
        sender_id: currentUser.id,
        offer_id: offer.id,
        is_read: false,
      });
    } catch (e) {
      console.error('Notification failed:', e);
    }

    // 3. Brief delay then redirect to chat
    setTimeout(() => {
      router.push(`/profile/messages?seller_id=${offer.user_id}&offer_id=${offer.id}&job_fulfill=true`);
    }, 1500);
  };

  const handleDeclineJob = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    // Notify job poster that a printer declined
    try {
      await supabase.from('notifications').insert({
        user_id: offer.user_id,
        title: '❌ A printer passed on your job',
        message: `A printer reviewed "${offer.title}" but decided they cannot fulfill it. Don't worry — other printers can still pick it up!`,
        type: 'job',
        sender_id: currentUser.id,
        offer_id: offer.id,
        is_read: false,
      });
    } catch (e) {
      console.error('Decline notification failed:', e);
    }
    router.push('/gallery');
  };

  const handleReportOffer = async () => {
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'report',
          subject: `Listing Report: ${offer?.title || offer?.id}`,
          message: `Reason: ${reportReason}\n\nDetails: ${reportDesc}\n\nOffer ID: ${offer?.id}\nOffer URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
          contact: currentUser?.email || 'anonymous',
        }),
      });
      setReportDone(true);
    } catch (e) {
      console.error('Report error:', e);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-gray-900" size={40} /></div>;
  if (!offer) return <div className="min-h-screen flex items-center justify-center">Product not found.</div>;

  const seller = offer.profiles;
  const isOwner = currentUser && currentUser.id === offer.user_id;
  const isDigital = offer.category === 'digital';
  const isJob = offer.category === 'job';
  const isPrinter = userRoles.includes('printer');

  const variants = offer.color_variants || [];
  const hasVariants = variants.length > 0;
  const currentVariant = hasVariants ? variants[selectedVariantIndex] : null;

  const currentPrice = currentVariant ? currentVariant.priceEUR : offer.price;
  const currentStock = currentVariant ? currentVariant.stock : offer.stock;
  const currentColor = currentVariant ? currentVariant.color_name : (offer.color_name || offer.color);
  const currentColorHex = currentVariant ? currentVariant.primaryColor : (offer.color_hex || offer.color);
  const currentMaterial = currentVariant ? currentVariant.plastic_type : offer.material;
  const currentWeight = formatOfferWeight(currentVariant ? null : offer.weight, currentVariant?.layers);

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

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Gallery + Description + Assembly + Specs (7 cols)            */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-10">
          {/* 1. Main Image & Gallery */}
          <div className="space-y-4">
            <div className="aspect-square bg-gray-50 rounded-[36px] overflow-hidden border border-gray-100 relative shadow-xl group">
              {isOutOfStock && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                  <div className="bg-red-600 text-white text-xl font-black uppercase tracking-[0.2em] py-4 px-12 -rotate-12 border-4 border-white shadow-2xl">
                    Sold Out
                  </div>
                </div>
              )}
              {selectedImage ? (
                <img src={selectedImage} alt={offer.title} className="w-full h-full object-cover animate-in fade-in duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-200">
                  <Box size={80} strokeWidth={1} />
                </div>
              )}
              <div className="absolute top-5 left-5 px-4 py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-gray-900 shadow-sm border border-gray-100">
                {offer.category}
              </div>
            </div>

            {offer.image_urls && offer.image_urls.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {offer.image_urls.map((url: string, idx: number) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedImage(url)} 
                    className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 shadow-xs ${selectedImage === url ? 'border-blue-600 scale-105 shadow-blue-100 ring-2 ring-blue-500/20' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                  >
                    <img src={url} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Product Description */}
          <div className="bg-gray-50/80 rounded-3xl p-6 sm:p-8 border border-gray-100/80 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">About this Listing</h3>
            <div className="prose prose-lg text-gray-700 max-w-none font-medium leading-relaxed whitespace-pre-line">
              {offer.description?.split('🛠️ Additional Parts / Tools Needed:')[0]?.trim() || offer.description}
            </div>
          </div>

          {/* 3. Additional Parts & Tools Needed for Assembly */}
          {(offer.assembly_tools || (offer.description && offer.description.includes('🛠️ Additional Parts / Tools Needed:'))) && (
            <div className="p-6 bg-amber-50/80 rounded-3xl border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow-md">
                  <Wrench size={16} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase text-amber-900 tracking-widest">
                  Additional Parts / Tools Needed for Assembly
                </span>
              </div>
              <div className="bg-white border border-amber-200/70 p-4.5 rounded-2xl shadow-xs">
                <p className="text-sm font-bold text-amber-950 leading-relaxed whitespace-pre-line">
                  {offer.assembly_tools || offer.description?.split('🛠️ Additional Parts / Tools Needed:')[1]?.trim()}
                </p>
              </div>
            </div>
          )}

          {/* 4. Technical Notes / Instructions */}
          {offer.custom_instructions && (
            <div className="p-6 bg-indigo-50/80 rounded-3xl border border-indigo-100 space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare size={80} className="text-indigo-400" />
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase text-indigo-900 tracking-widest">
                  Technical Notes & Requirements
                </span>
              </div>
              <div className="bg-white border border-indigo-100 p-4.5 rounded-2xl shadow-xs">
                <p className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-line italic">
                  {offer.custom_instructions}
                </p>
              </div>
            </div>
          )}

          {/* 5. Comprehensive Specifications Grid */}
          {!isDigital && (
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Specifications & Technical Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                
                {/* COLUMN A: MATERIAL & PROPERTIES */}
                {(offer.material || (currentVariant?.layers && currentVariant.layers.length > 0)) && (
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <Box size={16} className="text-blue-500" />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Material & Composition</span>
                    </div>

                    {(!currentVariant?.layers || currentVariant.layers.length === 0) && (
                      <div className="flex items-center justify-between gap-2">
                         <span className="text-xl font-black text-gray-900 truncate">{offer.material}</span>
                         {currentColor && (
                           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-xs flex-shrink-0">
                             <div className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: currentColorHex || '#ccc' }} />
                             <span className="text-[11px] font-black uppercase text-gray-700">{currentColor}</span>
                           </div>
                         )}
                      </div>
                    )}
                    
                    {currentVariant?.layers && currentVariant.layers.length > 0 && (
                      <div className="space-y-2">
                        {currentVariant.layers.map((l: any, i: number) => {
                          const mat = l.filament_id ? layerMaterials[l.filament_id] : (currentVariant.plastic_type || offer.material);
                          return (
                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-4 h-4 rounded-full border border-gray-300 shadow-xs flex-shrink-0" style={{ backgroundColor: l.color_hex || '#ccc' }} />
                                <div className="min-w-0">
                                  <span className="text-[11px] font-black text-gray-900 uppercase tracking-tight block leading-tight truncate">{l.color_name}</span>
                                  {mat && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate block">{mat}</span>}
                                </div>
                              </div>
                              <span className="text-xs font-black text-blue-600 flex-shrink-0 ml-2">{Math.max(1, Math.round(parseFloat(l.grams) || 0))}g</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Material Info & Properties */}
                    {(() => {
                      const displayMats: string[] = [];
                      if (currentVariant?.layers && currentVariant.layers.length > 0) {
                        currentVariant.layers.forEach((l: any) => {
                          const m = l.filament_id ? layerMaterials[l.filament_id] : (currentVariant.plastic_type || offer.material);
                          if (m && !displayMats.includes(m)) displayMats.push(m);
                        });
                      } else {
                        const m = currentMaterial || offer.material;
                        if (m && !displayMats.includes(m)) displayMats.push(m);
                      }

                      const validInfos = displayMats.map(m => getMaterialInfo(m)).filter(Boolean);
                      if (validInfos.length === 0) return null;

                      return (
                        <div className="space-y-3 pt-3 border-t border-gray-200/60">
                          {validInfos.map((matInfo, idx) => (
                            <div key={idx} className="p-4 bg-white border border-blue-100 rounded-2xl shadow-xs space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>{matInfo!.icon || '💡'}</span> {matInfo!.fullName}
                                </span>
                              </div>

                              {matInfo!.desc && (
                                <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                                  {matInfo!.desc}
                                </p>
                              )}

                              {matInfo!.properties && (
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                  {matInfo!.properties.strength && (
                                    <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Strength</span>
                                      <span className="text-[10px] font-extrabold text-slate-800">{matInfo!.properties.strength}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.heatResistance && (
                                    <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Heat Resistance</span>
                                      <span className="text-[10px] font-extrabold text-slate-800">{matInfo!.properties.heatResistance}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.flexibility && (
                                    <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Flexibility</span>
                                      <span className="text-[10px] font-extrabold text-slate-800">{matInfo!.properties.flexibility}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.uvResistance && (
                                    <div className="flex flex-col bg-slate-50 p-2 rounded-lg border border-slate-100">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">UV Resistance</span>
                                      <span className="text-[10px] font-extrabold text-slate-800">{matInfo!.properties.uvResistance}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {matInfo!.tags && matInfo!.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {matInfo!.tags.map((tag: string, tidx: number) => (
                                    <span key={tidx} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[8px] font-black uppercase tracking-wider">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* COLUMN B: DIMENSIONS & WEIGHT */}
                <div className="space-y-4">
                  {offer.dimensions && (
                    <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                      <div className="flex items-center gap-2">
                        <Ruler size={16} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Dimensions & Scale</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {offer.dimensions.split(',').map((dim: string, idx: number) => (
                          <div key={idx} className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl shadow-2xs text-xs font-black text-gray-900">
                            {dim.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isJob ? (
                    <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <Box size={16} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Quantity Requested</span>
                      </div>
                      <span className="text-xl font-black text-gray-900 block">{offer.stock || 1} pcs</span>
                    </div>
                  ) : currentWeight ? (
                    <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-blue-500" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Estimated Net Weight</span>
                      </div>
                      <span className="text-xl font-black text-gray-900 block">{currentWeight}</span>
                    </div>
                  ) : null}
                </div>

              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Buying Panel / Configurator (Sticky 5 cols)                  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col space-y-6 lg:sticky lg:top-24 h-fit">
          
          {/* Header & Title & Price Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">
                {offer.category}
              </span>
              {isOwner && (
                <Link href={`/edit/${offer.id}`} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition">
                  <Edit size={14} /> Edit Listing
                </Link>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-gray-900 leading-tight">
              {offer.title}
            </h1>

            <div className="pt-2 flex items-center gap-4">
              {offer.is_negotiable ? (
                 <div className="flex items-center gap-3 bg-indigo-50 px-5 py-3 rounded-2xl border border-indigo-200">
                   <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-sm" />
                   <span className="text-xl font-black text-indigo-700 uppercase tracking-tight">Price Negotiable</span>
                 </div>
              ) : (
                <div className="text-4xl font-black text-blue-600 leading-none">
                   {formatPrice(currentPrice)}
                </div>
              )}
            </div>

            {/* Maker Profile Card */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden border border-gray-200 shadow-xs flex-shrink-0 flex items-center justify-center">
                  {seller?.avatar_url ? (
                    <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="text-gray-400" size={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="block text-[9px] font-black uppercase text-gray-400 tracking-widest leading-none mb-0.5">Maker</span>
                  <span className="font-black text-gray-900 text-sm truncate block">{seller?.full_name || 'Anonymous Maker'}</span>
                  {sellerStats.count > 0 ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <span className="text-amber-500 text-xs font-black">{sellerStats.avgRating.toFixed(1)}</span>
                      <span className="text-gray-400 text-[10px] font-bold">({sellerStats.count})</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-[10px] font-bold block">No reviews yet</span>
                  )}
                </div>
              </div>
              <Link
                href={`/user/${offer.user_id}`}
                className="px-3.5 py-1.5 bg-gray-100 text-gray-800 hover:bg-gray-900 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xs flex-shrink-0"
              >
                Profile
              </Link>
            </div>
          </div>

          {/* Color Variants Selector Box (If exists) */}
          {hasVariants && (
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette size={16} className="text-blue-500" />
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Select Color Variant</span>
                </div>
                <span className="text-xs font-black text-gray-900">{variants.length} available</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {variants.map((v: any, idx: number) => {
                  const isSelected = selectedVariantIndex === idx;
                  const isSoldOut = v.stock === 0;
                  const weightG = v.layers?.reduce((acc: number, l: any) => acc + (parseFloat(l.grams) || 0), 0);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedVariantIndex(idx)}
                      className={`relative flex items-center justify-between p-3.5 rounded-2xl transition-all text-left cursor-pointer border ${
                        isSoldOut
                          ? 'opacity-40 cursor-not-allowed grayscale bg-gray-50 border-gray-200'
                          : isSelected
                            ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white hover:bg-gray-50 border-gray-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex -space-x-2 flex-shrink-0">
                          {v.layers && v.layers.length > 0 ? (
                            v.layers.map((l: any, li: number) => (
                              <div
                                key={li}
                                className="w-7 h-7 rounded-full border-2 border-white shadow-xs"
                                style={{ backgroundColor: l.color_hex || '#ccc', zIndex: 10 - li }}
                              />
                            ))
                          ) : (
                            <div
                              className="w-7 h-7 rounded-full border-2 border-white shadow-xs"
                              style={{ backgroundColor: v.primaryColor || v.layers?.[0]?.color_hex || '#ccc' }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block font-black text-xs text-gray-900 truncate">
                            {v.layers && v.layers.length > 0 ? (
                              v.layers.map((l: any, li: number) => (
                                <React.Fragment key={li}>
                                  {li > 0 && <span className="text-blue-500 mx-0.5">+</span>}
                                  {l.color_name}
                                </React.Fragment>
                              ))
                            ) : (
                              v.label || v.color_name || 'Option'
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                            <span>{isSoldOut ? 'Sold out' : (offer.category === 'digital' ? 'In Stock' : `${v.stock} in stock`)}</span>
                            {weightG && weightG > 0 ? <span>· ~{Math.round(weightG)}g</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0 pl-2">
                        <div className={`text-xs font-black ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                          {offer.is_negotiable ? 'Negotiable' : formatPrice(v.priceEUR)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Purchasing Card (Quantity, Buy Now, Add to Cart, Negotiate, Actions) */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl space-y-5">
            
            {/* Quantity Selector (Physical non-job) */}
            {!isDigital && !isJob && !isOwner && !isOutOfStock && (
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Quantity</span>
                  <span className="text-[10px] font-bold text-blue-600">
                    {offer.category === 'digital' ? 'Unlimited' : `${currentStock} available`}
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-xs border border-gray-200">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-gray-100 transition active:scale-90 disabled:opacity-30"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={currentStock}
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') setQuantity(0);
                      else {
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed)) setQuantity(Math.min(currentStock, Math.max(1, parsed)));
                      }
                    }}
                    onBlur={() => {
                      if (!quantity || quantity < 1) setQuantity(1);
                      else if (quantity > currentStock) setQuantity(currentStock);
                    }}
                    className="font-black text-lg w-10 text-center bg-transparent focus:outline-none text-gray-900"
                  />
                  <button
                    onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                    disabled={quantity >= currentStock}
                    className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-gray-100 transition active:scale-90 disabled:opacity-30"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="space-y-3">
              {isOwner ? (
                <Link
                  href={`/edit/${offer.id}`}
                  className="w-full py-4 rounded-2xl font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2 group text-xs"
                >
                  <Edit size={18} className="group-hover:rotate-12 transition-transform" /> Manage Listing
                </Link>
              ) : isJob ? (
                /* JOB FULFILLMENT PANEL */
                <div className="w-full space-y-3">
                  {!isPrinter ? (
                    <div className="py-4 rounded-2xl bg-gray-100 border border-gray-200 text-center p-3">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Printer Role Required</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Only verified printers can fulfill print requests.</p>
                    </div>
                  ) : isOutOfStock ? (
                    <div className="py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">✅ Job Already Fulfilled</p>
                    </div>
                  ) : (
                    <>
                       <div className="flex flex-col gap-2 w-full">
                        <button
                          onClick={handleFulfillJob}
                          disabled={downloadingFile || fileDownloaded}
                          className={`w-full relative overflow-hidden py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                            fileDownloaded
                              ? 'bg-emerald-600 text-white'
                              : downloadingFile
                              ? 'bg-blue-600/70 text-white cursor-wait'
                              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:opacity-95 shadow-blue-500/20'
                          }`}
                        >
                          {downloadingFile ? (
                            <><Loader2 size={18} className="animate-spin shrink-0" /> <span>Preparing File...</span></>
                          ) : fileDownloaded ? (
                            <><Check size={18} className="shrink-0" /> <span>Opening Chat...</span></>
                          ) : (
                            <><Download size={18} className="shrink-0" /> <span>Download 3D File & Fulfill</span></>  
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeclineJob}
                          className="w-full py-3 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-gray-200"
                        >
                          <X size={14} /> Decline Print Request
                        </button>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                        <Printer size={15} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                          Download the 3D file to assess print details and initiate price negotiations with the requester.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* BUY NOW BUTTON */}
                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className={`w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] ${
                      isOutOfStock
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                    }`}
                  >
                    <Zap size={18} className="fill-white shrink-0" />
                    <span>Buy Now — {formatPrice(currentPrice)}</span>
                  </button>

                  {/* SECONDARY BUTTONS (ADD TO CART + NEGOTIATE) */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || isAlreadyInCart}
                      className={`flex-1 py-3 px-4 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        isOutOfStock
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isAlreadyInCart
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isOutOfStock ? (
                        'Sold Out'
                      ) : isAlreadyInCart ? (
                        <><Check size={15} className="shrink-0 text-emerald-600" /> In Cart</>
                      ) : (
                        <><ShoppingBag size={15} className="shrink-0" /> Add to Cart</>
                      )}
                    </button>

                    <button
                      onClick={handleContactMaker}
                      className="flex-1 py-3 px-4 rounded-xl font-black text-[11px] uppercase tracking-wider bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-blue-300 transition-all shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Handshake size={15} className="text-blue-600 shrink-0" />
                      <span>Negotiate</span>
                    </button>
                  </div>
                </>
              )}

              {/* ACTION ICONS (FAVORITE, SHARE, REPORT) */}
              <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={toggleFavorite}
                  className={`flex-1 py-2.5 px-3 rounded-xl border transition-all flex items-center justify-center gap-1.5 text-xs font-bold ${
                    isFavorite ? 'bg-red-50 border-red-200 text-red-500 shadow-xs' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600'
                  }`}
                  title="Favorite"
                >
                  <Heart size={16} className={isFavorite ? 'fill-red-500' : ''} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{isFavorite ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 transition flex items-center justify-center gap-1.5 text-xs font-bold relative"
                  title="Share"
                >
                  <Share2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Share</span>
                  {showShareToast && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black py-1.5 px-3 rounded-lg flex items-center gap-1 animate-in fade-in z-30 shadow-md">
                      <CheckCircle size={11} className="text-green-400" /> Copied
                    </div>
                  )}
                </button>

                {currentUser && !isOwner && (
                  <button
                    onClick={() => { setReportDone(false); setReportReason(''); setReportDesc(''); setShowReportModal(true); }}
                    title="Report this listing"
                    className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 transition flex items-center justify-center"
                  >
                    <Flag size={16} />
                  </button>
                )}
              </div>

            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Direct from Maker
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-gray-400" /> Escrow Protected
              </div>
              {isDigital ? (
                <div className="flex items-center gap-1 text-green-600 font-bold">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Instant Download
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-500 font-bold">
                  <Truck size={13} className="text-gray-400" /> Tracked Shipping
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* --- REVIEWS & MAKES SECTION --- */}
      <div className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 dark:border-gray-800 mt-12">
        <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 dark:text-white mb-8 flex items-center gap-3">
          <Star className="text-amber-400 fill-amber-400" size={24} /> Customer Reviews & "Makes"
        </h2>
        <ReviewsSection offerId={offer.id} sellerId={offer.user_id} />
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
      {/* ── REPORT LISTING MODAL ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center gap-3">
              <Flag size={18} className="text-white" />
              <span className="text-sm font-black uppercase tracking-widest text-white">Report this Listing</span>
              <button onClick={() => setShowReportModal(false)} className="ml-auto text-white/70 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {reportDone ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} className="text-emerald-500" />
                  </div>
                  <p className="text-base font-black text-gray-900">Report submitted</p>
                  <p className="text-sm text-gray-500 font-medium">Our team will review this listing and take appropriate action.</p>
                  <button onClick={() => setShowReportModal(false)} className="mt-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition">Close</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Reason *</label>
                    <select
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Counterfeit or stolen goods">Counterfeit or stolen goods</option>
                      <option value="Prohibited or illegal item">Prohibited or illegal item</option>
                      <option value="Misleading description">Misleading description</option>
                      <option value="Spam or duplicate listing">Spam or duplicate listing</option>
                      <option value="Inappropriate content">Inappropriate content</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Additional details (optional)</label>
                    <textarea
                      value={reportDesc}
                      onChange={e => setReportDesc(e.target.value)}
                      placeholder="Describe the issue..."
                      rows={4}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleReportOffer}
                    disabled={!reportReason || reportSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {reportSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                    Submit Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}