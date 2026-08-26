'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useCart, CartItem } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import {
  Trash2, ArrowRight, ShoppingBag, X, Package, Plus, Minus,
  Check, Store, ShieldCheck, AlertCircle, Info, Truck
} from 'lucide-react';
import { formatOfferWeight } from '../lib/offerHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string | null;
}

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem } = useCart();
  const { formatPrice } = useCurrency();

  const [sellerProfiles, setSellerProfiles] = useState<Record<string, SellerProfile>>({});
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Group items by seller_id
  const sellerGroups = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    items.forEach((item) => {
      const sid = item.seller_id || 'unknown';
      if (!groups[sid]) groups[sid] = [];
      groups[sid].push(item);
    });
    return groups;
  }, [items]);

  const sellerIds = useMemo(() => Object.keys(sellerGroups), [sellerGroups]);

  // Ensure selectedSellerId is always valid
  useEffect(() => {
    if (sellerIds.length > 0) {
      if (!selectedSellerId || !sellerGroups[selectedSellerId]) {
        setSelectedSellerId(sellerIds[0]);
      }
    } else {
      setSelectedSellerId(null);
    }
  }, [sellerIds, selectedSellerId, sellerGroups]);

  // Fetch seller profile details
  useEffect(() => {
    if (sellerIds.length === 0) {
      setLoadingProfiles(false);
      return;
    }

    const fetchProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', sellerIds);

        if (!error && data) {
          const map: Record<string, SellerProfile> = {};
          data.forEach((p: any) => {
            map[p.id] = {
              id: p.id,
              full_name: p.full_name || p.username || 'Seller',
              avatar_url: p.avatar_url || null,
              username: p.username || null,
            };
          });
          setSellerProfiles(map);
        }
      } catch (err) {
        console.error('Failed to fetch seller profiles:', err);
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, [sellerIds]);

  // Currently selected items and total
  const selectedItems = useMemo(() => {
    if (!selectedSellerId || !sellerGroups[selectedSellerId]) return [];
    return sellerGroups[selectedSellerId];
  }, [selectedSellerId, sellerGroups]);

  const selectedTotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [selectedItems]);

  const selectedCount = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [selectedItems]);

  const selectedSeller = selectedSellerId ? sellerProfiles[selectedSellerId] : null;

  const handleCheckout = () => {
    if (!selectedSellerId) return;
    router.push(`/checkout?sellerId=${selectedSellerId}`);
  };

  return (
    <main className="min-h-screen bg-[#07090e] font-sans text-gray-100 pb-24">
      {/* HEADER / NAVBAR */}
      <nav className="bg-[#0f131d]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Printis" className="h-8 w-auto rounded-xl object-cover" />
          <span className="font-black text-lg tracking-wider text-white">PRINTIS</span>
        </Link>
        <Link
          href="/gallery"
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition text-gray-400 hover:text-white"
        >
          <X size={20} />
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* TITLE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              Your Shopping Cart
            </h1>
            <p className="text-gray-400 text-sm font-medium mt-1">
              {items.length === 0
                ? 'Your cart is empty'
                : `Contains ${items.length} item${items.length > 1 ? 's' : ''} across ${sellerIds.length} seller package${sellerIds.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {sellerIds.length > 1 && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Info size={16} className="shrink-0 text-amber-400" />
              <span>Select one seller package below to proceed to checkout.</span>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-[#0f131d] rounded-3xl p-12 text-center border border-white/10 shadow-2xl max-w-lg mx-auto my-12">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-500">
              <ShoppingBag size={36} />
            </div>
            <h2 className="text-2xl font-black uppercase text-white mb-2">Cart is empty</h2>
            <p className="text-gray-400 text-sm mb-6">Explore our 3D printing marketplace and start your next project!</p>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
            >
              Explore Products <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* SELLER GROUPS LIST (LEFT 8 COLS) */}
            <div className="lg:col-span-8 space-y-6">
              {sellerIds.map((sellerId) => {
                const groupItems = sellerGroups[sellerId];
                const sellerProf = sellerProfiles[sellerId];
                const isSelected = selectedSellerId === sellerId;
                const groupTotal = groupItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
                const sellerName = sellerProf?.full_name || sellerProf?.username || 'Verified Seller';
                const sellerHandle = sellerProf?.username ? `@${sellerProf.username}` : null;
                const avatarUrl = sellerProf?.avatar_url;

                return (
                  <div
                    key={sellerId}
                    onClick={() => setSelectedSellerId(sellerId)}
                    className={`relative rounded-3xl transition-all duration-200 cursor-pointer overflow-hidden border-2 ${
                      isSelected
                        ? 'bg-[#121726] border-blue-500 shadow-2xl shadow-blue-500/10 ring-1 ring-blue-500/50'
                        : 'bg-[#0e121c] border-white/5 hover:border-white/20 hover:bg-[#111622]'
                    }`}
                  >
                    {/* SELLER HEADER BAR */}
                    <div className={`px-6 py-4 flex items-center justify-between border-b ${isSelected ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex items-center gap-3.5">
                        {/* SELECTOR RADIO BUTTON */}
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white scale-110 shadow-md shadow-blue-500/50'
                              : 'border-gray-600 bg-black/40 text-transparent'
                          }`}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>

                        {/* SELLER AVATAR & NAME */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 overflow-hidden flex items-center justify-center shrink-0">
                            {avatarUrl ? (
                              <img src={avatarUrl} alt={sellerName} className="w-full h-full object-cover" />
                            ) : (
                              <Store size={18} className="text-blue-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-gray-400 uppercase tracking-wider">Package from</span>
                              <span className="text-sm font-black text-white">{sellerName}</span>
                            </div>
                            {sellerHandle && (
                              <span className="text-[11px] font-medium text-blue-400">{sellerHandle}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SELECTION STATUS BADGE */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 hidden sm:inline">
                          {groupItems.length} item{groupItems.length > 1 ? 's' : ''}
                        </span>
                        {isSelected ? (
                          <span className="px-3 py-1 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                            <Check size={12} /> Selected for Checkout
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-white/5 text-gray-400 text-[10px] font-bold uppercase tracking-wider group-hover:text-white transition">
                            Click to Select
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div className="p-4 sm:p-6 space-y-4">
                      {groupItems.map((item) => (
                        <div
                          key={item.id + (item.variant_name || '')}
                          className="bg-[#090c13] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 hover:border-white/10 transition"
                          onClick={(e) => e.stopPropagation()} // Prevent triggering parent select on item interaction
                        >
                          {/* ITEM IMAGE */}
                          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-black/50 rounded-xl overflow-hidden shrink-0 border border-white/10 relative">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <Package size={24} />
                              </div>
                            )}
                          </div>

                          {/* ITEM DETAILS */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-white leading-snug truncate mb-1">
                              {item.title}
                            </h3>
                            <p className="text-sm font-bold text-blue-400">
                              {formatPrice(item.price)}
                              {item.category !== 'digital' && (
                                <span className="text-[10px] font-normal text-gray-500 ml-1">/ each</span>
                              )}
                            </p>

                            {/* VARIANT / FILAMENT SPECIFICATIONS */}
                            {item.category !== 'digital' && item.variant_name && !item.variant_name.startsWith('#') && (
                              <div className="flex items-center gap-2 mt-1.5">
                                {item.variant_layers && item.variant_layers.length > 1 ? (
                                  <div className="flex -space-x-1">
                                    {item.variant_layers.map((layer, li) => (
                                      <div
                                        key={li}
                                        className="w-3 h-3 rounded-full border border-black shadow-sm"
                                        style={{ backgroundColor: layer.color_hex || '#ccc' }}
                                        title={layer.color_name}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div
                                    className="w-3 h-3 rounded-full border border-black shadow-sm"
                                    style={{ backgroundColor: item.variant_color || '#ccc' }}
                                  />
                                )}
                                <span className="text-[11px] font-black text-gray-300 truncate uppercase tracking-wider">
                                  {item.variant_name}
                                </span>
                              </div>
                            )}

                            {/* STOCK & MATERIAL METADATA */}
                            {item.stock !== undefined && item.category !== 'digital' && (
                              <div className="space-y-1 mt-2">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                  Stock: {item.stock === 0 ? <span className="text-red-400">Sold out</span> : item.stock}
                                </p>

                                {item.variant_layers && item.variant_layers.length > 1 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.variant_layers.map((layer, li) => (
                                      <span
                                        key={li}
                                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/20"
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: layer.color_hex || '#ccc' }}
                                        />
                                        {layer.color_name || `Layer ${li + 1}`}
                                        {layer.grams && <span className="text-purple-400/70 ml-0.5">· {layer.grams}g</span>}
                                      </span>
                                    ))}
                                    {item.material && (
                                      <span className="text-[9px] font-black uppercase text-gray-500 self-center">
                                        ({item.material})
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  item.material && (
                                    <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest">
                                      Material: {item.material}
                                    </p>
                                  )
                                )}

                                {item.weight && (
                                  <p className="text-[10px] text-amber-400/80 font-black uppercase tracking-widest">
                                    Net Weight: {formatOfferWeight(item.weight)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* QUANTITY CONTROLS */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                            {item.is_custom || item.category === 'digital' ? (
                              <div
                                className={`flex items-center justify-center gap-1.5 rounded-xl py-1.5 px-3 border text-xs font-black uppercase tracking-wider ${
                                  item.category === 'digital'
                                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                                    : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                                }`}
                              >
                                <span>{item.category === 'digital' ? '1x Digital' : `Qty: ${item.quantity}`}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-black/60 rounded-xl p-1 border border-white/10">
                                <button
                                  onClick={() => updateQuantity(item.id, -1, item.variant_name)}
                                  disabled={item.quantity <= 1}
                                  className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="font-bold text-sm text-white w-5 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, 1, item.variant_name)}
                                  disabled={item.stock !== undefined && item.quantity >= item.stock}
                                  className="w-7 h-7 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            )}

                            {/* PRICE & REMOVE */}
                            <div className="text-right shrink-0">
                              <p className="font-black text-lg text-white">
                                {formatPrice(item.price * item.quantity)}
                              </p>
                              <button
                                onClick={() => removeItem(item.id, item.variant_name)}
                                className="mt-1 text-[10px] font-bold text-red-400 hover:text-red-300 uppercase flex items-center gap-1 ml-auto transition"
                              >
                                <Trash2 size={11} /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* SELLER GROUP FOOTER */}
                    <div className="px-6 py-3.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Package Subtotal</span>
                      <span className="font-black text-white text-sm">{formatPrice(groupTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SUMMARY SIDEBAR (RIGHT 4 COLS) */}
            <div className="lg:col-span-4">
              <div className="bg-[#0e121c] p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl sticky top-24 space-y-6">
                <h2 className="text-lg font-black uppercase tracking-wider text-white border-b border-white/10 pb-4">
                  Order Summary
                </h2>

                {selectedSellerId && selectedItems.length > 0 ? (
                  <div className="space-y-4">
                    {/* SELECTED SELLER BADGE */}
                    <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-400/40 overflow-hidden flex items-center justify-center shrink-0">
                        {sellerProfiles[selectedSellerId]?.avatar_url ? (
                          <img src={sellerProfiles[selectedSellerId].avatar_url!} alt="Seller" className="w-full h-full object-cover" />
                        ) : (
                          <Store size={16} className="text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Seller Selected</span>
                        <p className="text-sm font-black text-white truncate">
                          {sellerProfiles[selectedSellerId]?.full_name || 'Verified Seller'}
                        </p>
                      </div>
                    </div>

                    {/* ITEMIZED BREAKDOWN */}
                    <div className="space-y-2.5 text-sm pt-2">
                      <div className="flex justify-between text-gray-400">
                        <span>Selected Items ({selectedCount})</span>
                        <span className="font-bold text-white">{formatPrice(selectedTotal)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 text-xs">
                        <span>Shipping</span>
                        <span className="text-gray-500 italic">Calculated at Checkout</span>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4 flex justify-between items-baseline">
                      <span className="font-black text-sm uppercase text-gray-300">Items Total</span>
                      <span className="font-black text-2xl text-white">{formatPrice(selectedTotal)}</span>
                    </div>

                    {/* NOTICE REGARDING PER-SELLER SHIPPING */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-gray-400 leading-relaxed flex items-start gap-2.5">
                      <Truck size={16} className="text-blue-400 shrink-0 mt-0.5" />
                      <span>
                        Items are checked out per seller to ensure accurate courier rates & direct tracking. Remaining items stay in your cart.
                      </span>
                    </div>

                    {/* CHECKOUT BUTTON */}
                    <button
                      onClick={handleCheckout}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-600/25 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Proceed to Checkout <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 text-xs font-medium">
                    Please select a seller package to view checkout summary.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}