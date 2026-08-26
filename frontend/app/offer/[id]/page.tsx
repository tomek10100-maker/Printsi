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
              {offer.is_negotiable ? (
                 <div className="flex items-center gap-3 bg-indigo-500/20 px-5 py-3 rounded-2xl border border-indigo-400/30 animate-in fade-in slide-in-from-left-2 duration-500 shadow-lg shadow-indigo-500/20">
                   <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                   <span className="text-2xl font-black text-indigo-300 uppercase tracking-tight">Negotiable Price</span>
                 </div>
              ) : (
                <div className="text-4xl font-black text-blue-600 leading-none">
                   {formatPrice(currentPrice)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3.5 mb-6 p-4 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-100 dark:border-gray-800/80 shadow-sm hover:shadow-md transition-all">
            <div className="w-11 h-11 bg-white dark:bg-slate-800 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center flex-shrink-0">
              {seller?.avatar_url ? (
                <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="text-gray-400 dark:text-gray-500" size={22} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Crafted by</span>
              <span className="font-black text-gray-900 dark:text-white text-base truncate block">{seller?.full_name || 'Anonymous Maker'}</span>
            </div>
            <Link
              href={`/user/${offer.user_id}`}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white transition-all shadow-sm flex-shrink-0"
            >
              Profile
            </Link>
          </div>

          <div className="prose prose-lg text-gray-600 dark:text-gray-300 mb-6 max-w-none font-medium leading-relaxed">
            {offer.description?.split('🛠️ Additional Parts / Tools Needed:')[0]?.trim() || offer.description}
          </div>

          {/* ADDITIONAL PARTS & TOOLS NEEDED FOR ASSEMBLY */}
          {(offer.assembly_tools || (offer.description && offer.description.includes('🛠️ Additional Parts / Tools Needed:'))) && (
            <div className="p-5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/40 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 bg-amber-500 rounded-xl flex items-center justify-center shadow-md">
                  <Wrench size={15} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase text-amber-900 dark:text-amber-200 tracking-widest">
                  Additional Parts / Tools Needed to Assemble
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 border border-amber-200/70 dark:border-amber-900/40 p-4 rounded-xl shadow-xs">
                <p className="text-sm font-bold text-amber-950 dark:text-amber-100 leading-relaxed whitespace-pre-line">
                  {offer.assembly_tools || offer.description?.split('🛠️ Additional Parts / Tools Needed:')[1]?.trim()}
                </p>
              </div>
            </div>
          )}

          {!isDigital && (
            <div className="mb-8">
              {/* Specifications Grid with items-start to avoid vertical stretching/empty space */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                
                {/* COLUMN 1: MATERIAL */}
                {(offer.material || (currentVariant?.layers && currentVariant.layers.length > 0)) && (
                  <div className="p-4.5 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-100 dark:border-gray-800/80 shadow-sm transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <Box size={15} className="text-blue-400" />
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Material</span>
                    </div>

                    {(!currentVariant?.layers || currentVariant.layers.length === 0) && (
                      <div className="flex items-center justify-between gap-2">
                         <span className="text-xl font-black text-gray-900 dark:text-white truncate">{offer.material}</span>
                         {currentColor && (
                           <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
                             <div className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: currentColorHex || '#ccc' }} />
                             <span className="text-[11px] font-black uppercase text-gray-700 dark:text-gray-300">{currentColor}</span>
                           </div>
                         )}
                      </div>
                    )}
                    
                    {currentVariant?.layers && currentVariant.layers.length > 0 && (
                      <div className="space-y-2">
                        {currentVariant.layers.map((l: any, i: number) => {
                          const mat = l.filament_id ? layerMaterials[l.filament_id] : (currentVariant.plastic_type || offer.material);
                          return (
                            <div key={i} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 shadow-xs flex-shrink-0" style={{ backgroundColor: l.color_hex || '#ccc' }} />
                                <div className="min-w-0">
                                  <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-tight block leading-tight truncate">{l.color_name}</span>
                                  {mat && <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate block">{mat}</span>}
                                </div>
                              </div>
                              <span className="text-xs font-black text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2">{Math.max(1, Math.round(parseFloat(l.grams) || 0))}g</span>
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
                        <div className="mt-3.5 space-y-2.5 pt-3 border-t border-gray-200/60 dark:border-gray-800">
                          {validInfos.map((matInfo, idx) => (
                            <div key={idx} className="p-3.5 bg-white/90 dark:bg-slate-800/90 border border-blue-100/80 dark:border-blue-900/40 rounded-xl shadow-xs space-y-2.5 animate-in fade-in duration-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                  <span>{matInfo!.icon || '💡'}</span> {matInfo!.fullName}
                                </span>
                              </div>

                              {matInfo!.desc && (
                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {matInfo!.desc}
                                </p>
                              )}

                              {matInfo!.properties && (
                                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                  {matInfo!.properties.strength && (
                                    <div className="flex flex-col bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Strength</span>
                                      <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">{matInfo!.properties.strength}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.heatResistance && (
                                    <div className="flex flex-col bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Heat Resistance</span>
                                      <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">{matInfo!.properties.heatResistance}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.flexibility && (
                                    <div className="flex flex-col bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Flexibility</span>
                                      <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">{matInfo!.properties.flexibility}</span>
                                    </div>
                                  )}
                                  {matInfo!.properties.uvResistance && (
                                    <div className="flex flex-col bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">UV Resistance</span>
                                      <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200">{matInfo!.properties.uvResistance}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {matInfo!.tags && matInfo!.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {matInfo!.tags.map((tag: string, tidx: number) => (
                                    <span key={tidx} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 rounded-md text-[8px] font-black uppercase tracking-wider">
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

                {/* COLUMN 2: SCALE & SIZE + NET WEIGHT / QUANTITY */}
                <div className="space-y-4">
                  {offer.dimensions && (
                    <div className="p-4.5 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-100 dark:border-gray-800/80 shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Ruler size={15} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Scale & Size</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {offer.dimensions.split(',').map((dim: string, idx: number) => (
                          <div key={idx} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xs text-xs font-black text-gray-900 dark:text-white">
                            {dim.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isJob ? (
                    <div className="p-4.5 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-100 dark:border-gray-800/80 shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Box size={15} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Quantity Requested</span>
                      </div>
                      <span className="text-xl font-black text-gray-900 dark:text-white truncate block">{offer.stock || 1} pcs</span>
                    </div>
                  ) : currentWeight ? (
                    <div className="p-4.5 bg-gray-50 dark:bg-slate-900/80 rounded-2xl border border-gray-100 dark:border-gray-800/80 shadow-sm transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers size={15} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Net Weight</span>
                      </div>
                      <span className="text-xl font-black text-gray-900 dark:text-white truncate block">{currentWeight}</span>
                    </div>
                  ) : null}
                </div>

              </div>
            </div>
          )}

          {offer.custom_instructions && (
            <div className="p-5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in fade-in slide-in-from-bottom-2 duration-500 relative overflow-hidden group mb-8">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare size={80} className="text-indigo-400" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-indigo-500 rounded-xl flex items-center justify-center shadow-md">
                  <MessageSquare size={15} className="text-white" />
                </div>
                <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-200 tracking-widest">Technical Notes / Adjustments</span>
              </div>
              <div className="bg-white dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-xl shadow-xs">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line italic">
                  {offer.custom_instructions}
                </p>
              </div>
            </div>
          )}

              {/* COLOR VARIANTS SELECTION */}
              {hasVariants && (
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Palette size={15} className="text-blue-400" />
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Color Variant</span>
                  </div>
                  <div className="p-2 bg-gray-100 dark:bg-slate-900/60 rounded-[32px] border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col gap-2">
                      {variants.map((v: any, idx: number) => {
                        const isSelected = selectedVariantIndex === idx;
                        const isSoldOut = v.stock === 0;
                        const isVariantInCart = items.some(
                          i => i.id === offer.id && i.variant_name === v.color_name
                        );
                        const weightG = v.layers?.reduce((acc: number, l: any) => acc + (parseFloat(l.grams) || 0), 0);

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedVariantIndex(idx);
                            }}
                            className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[24px] transition-all text-left cursor-pointer group/var ${
                              isSoldOut
                                ? 'opacity-40 cursor-not-allowed grayscale bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-gray-800'
                                : isSelected
                                  ? 'bg-white dark:bg-slate-800 shadow-xl ring-2 ring-blue-600/20 border border-blue-200 dark:border-blue-700'
                                  : 'bg-white/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-gray-100 dark:border-gray-800 shadow-sm'
                            }`}
                          >
                            {/* LEFT: COLOR CIRCLES + TITLE & STOCK */}
                            <div className="flex items-center gap-3.5 flex-1 min-w-0">
                              <div className="flex -space-x-3 flex-shrink-0">
                                {v.layers && v.layers.length > 0 ? (
                                  v.layers.map((l: any, li: number) => (
                                    <div
                                      key={li}
                                      className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-md transition-transform group-hover/var:scale-105"
                                      style={{ backgroundColor: l.color_hex || '#ccc', zIndex: 10 - li }}
                                    />
                                  ))
                                ) : (
                                  <div
                                    className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800 shadow-md"
                                    style={{ backgroundColor: v.primaryColor || v.layers?.[0]?.color_hex || '#ccc' }}
                                  />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <span className="block font-black text-sm tracking-tight text-gray-900 dark:text-white truncate">
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
                                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-tight mt-0.5">
                                  <span>{isSoldOut ? 'Sold out' : (offer.category === 'digital' ? '∞' : `${v.stock} pcs left`)}</span>
                                  {weightG && weightG > 0 ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-black">~{Math.round(weightG)}g</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* RIGHT: PRICE & ACTION BUTTONS */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                              <div className="text-left sm:text-right mr-1">
                                <div className={`text-base font-black transition-colors ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                  {offer.is_negotiable ? 'Negotiable' : formatPrice(v.priceEUR)}
                                </div>
                              </div>

                              {!isOwner && (!isSoldOut ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVariantIndex(idx);
                                      handleAddVariantToCart(v, idx);
                                    }}
                                    disabled={isVariantInCart}
                                    className={`px-3 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                      isVariantInCart
                                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                        : 'bg-gray-900 dark:bg-white text-white dark:text-slate-900 hover:bg-blue-600 dark:hover:bg-blue-500 dark:hover:text-white'
                                    }`}
                                    title="Add this variant to cart"
                                  >
                                    {isVariantInCart ? (
                                      <><Check size={14} /> In Cart</>
                                    ) : (
                                      <><ShoppingBag size={14} /> Add to Cart</>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVariantIndex(idx);
                                      handleBuyVariantNow(v, idx);
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                                    title="Buy this variant immediately"
                                  >
                                    <Zap size={14} /> Buy Now
                                  </button>
                                </div>
                              ) : (
                                <span className="px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-500 font-black text-xs uppercase tracking-wider border border-red-100 dark:border-red-900">
                                  Sold Out
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

          {/* QUANTITY & ACTIONS */}
          <div className="mt-auto space-y-6">
            {!isDigital && !isJob && !isOwner && !isOutOfStock && (
              <div className="flex items-center justify-between p-5 bg-gray-50 rounded-[32px] border border-gray-100">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Quantity</span>
                   <span className="text-[10px] font-bold text-blue-600">
                     {offer.category === 'digital' ? <span className="text-xl leading-none">∞</span> : `${currentStock} pcs`}
                   </span>
                 </div>
                 <div className="flex items-center gap-6 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-gray-100 transition active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:active:scale-100"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={currentStock}
                      value={quantity === 0 ? '' : quantity}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setQuantity(0);
                        } else {
                          const parsed = parseInt(raw, 10);
                          if (!isNaN(parsed)) {
                            setQuantity(Math.min(currentStock, Math.max(1, parsed)));
                          }
                        }
                      }}
                      onBlur={() => {
                        if (!quantity || quantity < 1) {
                          setQuantity(1);
                        } else if (quantity > currentStock) {
                          setQuantity(currentStock);
                        }
                      }}
                      className="font-black text-2xl w-14 text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-900"
                    />
                    <button
                      onClick={() => setQuantity(q => Math.min(currentStock, q + 1))}
                      disabled={quantity >= currentStock}
                      className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl hover:bg-gray-100 transition active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:active:scale-100"
                    >
                      <Plus size={16} />
                    </button>
                 </div>
              </div>
            )}

            <div className="flex flex-col gap-3.5">
              {isOwner ? (
                <Link
                  href={`/edit/${offer.id}`}
                  className="w-full py-5 rounded-[24px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 group border border-blue-400/30 whitespace-nowrap"
                >
                  <Edit size={22} className="group-hover:rotate-12 transition-transform" /> Manage Listing
                </Link>
              ) : isJob ? (
                /* ── JOB FULFILLMENT PANEL ── */
                <div className="w-full space-y-4">
                  {!isPrinter ? (
                    <div className="py-5 rounded-[24px] bg-gray-100 border-2 border-dashed border-gray-200 text-center">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Printer Role Required</p>
                      <p className="text-xs text-gray-400 mt-1">Only verified printers can fulfill print jobs.</p>
                    </div>
                  ) : isOutOfStock ? (
                    <div className="py-5 rounded-[24px] bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">✅ Job Already Fulfilled</p>
                    </div>
                  ) : (
                    <>
                       <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <button
                          onClick={handleFulfillJob}
                          disabled={downloadingFile || fileDownloaded}
                          className={`flex-1 relative overflow-hidden group py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 ${
                            fileDownloaded
                              ? 'bg-emerald-600 text-white'
                              : downloadingFile
                              ? 'bg-blue-600/70 text-white cursor-wait'
                              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:-translate-y-0.5 active:scale-95 shadow-blue-500/30'
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                          {downloadingFile ? (
                            <><Loader2 size={22} className="animate-spin shrink-0" /> <span className="whitespace-nowrap">Preparing...</span></>
                          ) : fileDownloaded ? (
                            <><Check size={22} className="shrink-0" /> <span className="whitespace-nowrap">File Downloaded — Opening Chat...</span></>
                          ) : (
                            <><Download size={22} className="group-hover:animate-bounce shrink-0" /> <span className="whitespace-nowrap">Download 3D File & Fulfill</span></>  
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDeclineJob}
                          className="px-5 py-4 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-gray-200"
                        >
                          <X size={16} /> Decline
                        </button>
                      </div>

                      {/* Info hint */}
                      <div className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <Printer size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-blue-600/80 font-medium leading-relaxed">
                          Download the 3D file to evaluate printability. Once downloaded, you'll open a chat to propose your price and terms to the customer.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* ROW 1: PRIMARY BUY NOW BUTTON (Full width, bold, single-line) */}
                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className={`w-full py-4.5 px-6 rounded-[22px] font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2.5 whitespace-nowrap active:scale-[0.99] ${
                      isOutOfStock
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white hover:from-blue-700 hover:to-indigo-800 shadow-blue-500/25 border border-blue-400/30'
                    }`}
                  >
                    <Zap size={20} className="fill-white shrink-0" />
                    <span className="whitespace-nowrap">Buy Now — {formatPrice(currentPrice)}</span>
                  </button>

                  {/* ROW 2: ADD TO CART + NEGOTIATE + ACTION ICONS */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full">
                    {/* ADD TO CART */}
                    <button
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || isAlreadyInCart}
                      className={`flex-1 min-w-[130px] py-3.5 px-4 rounded-[18px] font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap ${
                        isOutOfStock
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                          : isAlreadyInCart
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none'
                          : 'bg-gray-900 text-white hover:bg-gray-800 hover:-translate-y-0.5 active:scale-95'
                      }`}
                    >
                      {isOutOfStock ? (
                        'Sold Out'
                      ) : isAlreadyInCart ? (
                        <><Check size={18} className="shrink-0 text-emerald-600" /> <span className="whitespace-nowrap">In Cart</span></>
                      ) : (
                        <><ShoppingBag size={18} className="shrink-0" /> <span className="whitespace-nowrap">Add to Cart</span></>
                      )}
                    </button>

                    {/* NEGOTIATE */}
                    <button
                      onClick={handleContactMaker}
                      className="flex-1 min-w-[130px] py-3.5 px-4 rounded-[18px] font-black text-xs uppercase tracking-wider bg-white border-2 border-gray-100 text-gray-900 hover:bg-gray-50 hover:border-blue-200 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
                    >
                      <Handshake size={18} className="text-blue-600 shrink-0" />
                      <span className="whitespace-nowrap">Negotiate</span>
                    </button>

                    {/* FAVORITE ICON */}
                    <button
                      onClick={toggleFavorite}
                      className={`w-12 h-12 rounded-[18px] border-2 transition-all flex items-center justify-center shrink-0 ${isFavorite ? 'bg-red-50 border-red-200 text-red-500 shadow-red-100 shadow-md' : 'bg-white hover:bg-gray-50 text-gray-400 border-gray-100'}`}
                      title="Favorite"
                    >
                      <Heart size={20} className={isFavorite ? 'fill-red-500 animate-pulse' : ''} />
                    </button>

                    {/* SHARE ICON */}
                    <button
                      onClick={handleShare}
                      className="w-12 h-12 rounded-[18px] border-2 border-gray-100 bg-white hover:bg-gray-50 text-gray-400 transition flex items-center justify-center group relative shrink-0"
                      title="Share"
                    >
                      <Share2 size={20} className="group-hover:scale-110 transition-transform" />
                      {showShareToast && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black py-2 px-4 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap shadow-xl z-30">
                          <CheckCircle size={12} className="text-green-400" /> Copied to Clipboard
                        </div>
                      )}
                    </button>

                    {/* REPORT ICON */}
                    {currentUser && !isOwner && (
                      <button
                        onClick={() => { setReportDone(false); setReportReason(''); setReportDesc(''); setShowReportModal(true); }}
                        title="Report this listing"
                        className="w-12 h-12 rounded-[18px] border-2 border-gray-100 bg-white hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500 transition flex items-center justify-center group shrink-0"
                      >
                        <Flag size={18} className="group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-y-4 gap-x-8 pt-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Direct from Master-Maker
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <ShieldCheck size={14} className="text-gray-300" /> Printis Escrow Protection
              </div>
              {isDigital ? (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-green-600 tracking-wider">
                   <div className="w-2 h-2 rounded-full bg-green-500" /> Instant Download
                </div>
              ) : isJob ? (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                   <Printer size={14} className="text-indigo-400" /> Print on Demand
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <Truck size={14} className="text-gray-300" /> Furgonetka.pl
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