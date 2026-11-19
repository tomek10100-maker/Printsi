'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package, ArrowLeft, Truck, Clock, CheckCircle2, MessageSquare,
  ExternalLink, Download, AlertCircle, ShoppingBag, Loader2, Star, Shield, Filter
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';
import ReviewModal from '../../components/ReviewModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItem {
  id: string;
  order_id: string;
  offer_id: string;
  seller_id: string;
  quantity: number;
  price_at_purchase: number;
  status: string;
  tracking_code: string | null;
  tracking_number: string | null;
  carrier: string | null;
  furgonetka_package_id: string | null;
  variant_name: string | null;
  variant_color_hex: string | null;
  created_at: string;
  offers?: {
    id: string;
    title: string;
    image_urls: string[] | null;
    category: string;
    file_url?: string | null;
  };
  seller?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  chat_id?: string | null;
  has_review?: boolean;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'digital'>('all');
  const [reviewModalItem, setReviewModalItem] = useState<OrderItem | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Fetch user orders
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, created_at, buyer_id')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersErr || !orders || orders.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const orderIds = orders.map(o => o.id);

      // 2. Fetch order items with offer details
      const { data: orderItems, error: itemsErr } = await supabase
        .from('order_items')
        .select(`
          id, order_id, offer_id, seller_id, quantity, price_at_purchase,
          status, tracking_code, tracking_number, carrier, furgonetka_package_id,
          variant_name, variant_color_hex, created_at,
          offers ( id, title, image_urls, category, file_url )
        `)
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (itemsErr || !orderItems) {
        setItems([]);
        setLoading(false);
        return;
      }

      // 3. Fetch seller profiles
      const sellerIds = [...new Set(orderItems.map(i => i.seller_id).filter(Boolean))];
      let sellerMap: Record<string, any> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', sellerIds);
        (sellers || []).forEach(s => { sellerMap[s.id] = s; });
      }

      // 4. Fetch related chats for quick messaging links
      const { data: chats } = await supabase
        .from('chats')
        .select('id, order_id, seller_id, offer_id')
        .eq('buyer_id', user.id);

      // 5. Fetch existing reviews to know which items have been reviewed
      const itemIds = orderItems.map(i => i.id);
      let reviewedItemIds = new Set<string>();
      if (itemIds.length > 0) {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('order_item_id')
          .in('order_item_id', itemIds);
        (reviews || []).forEach(r => reviewedItemIds.add(r.order_item_id));
      }

      const enriched: OrderItem[] = orderItems.map((item: any) => {
        const chat = chats?.find(c => c.order_id === item.order_id || (c.offer_id === item.offer_id && c.seller_id === item.seller_id));
        return {
          ...item,
          offers: Array.isArray(item.offers) ? item.offers[0] : item.offers,
          seller: item.seller_id ? sellerMap[item.seller_id] : null,
          chat_id: chat?.id || null,
          has_review: reviewedItemIds.has(item.id)
        };
      });

      setItems(enriched);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTrackingUrl = (carrier: string | null, trackingNumber: string | null) => {
    if (!trackingNumber) return null;
    const cleanNum = trackingNumber.trim();
    const c = (carrier || '').toLowerCase();
    if (c.includes('inpost') || cleanNum.length === 24) {
      return `https://inpost.pl/sledzenie-przesylek?number=${cleanNum}`;
    }
    if (c.includes('dpd')) {
      return `https://tracktrace.dpd.com.pl/findParcel?pNum=${cleanNum}`;
    }
    if (c.includes('dhl')) {
      return `https://sprawdz.dhl.com.pl/szukaj.aspx?m=0&sn=${cleanNum}`;
    }
    return `https://furgonetka.pl/zlokalizuj/${cleanNum}`;
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'completed':
      case 'transfer_completed':
      case 'resolved':
        return {
          label: 'Completed',
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          icon: <CheckCircle2 size={13} />
        };
      case 'delivered':
        return {
          label: 'Delivered',
          bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
          icon: <CheckCircle2 size={13} />
        };
      case 'in_transit':
        return {
          label: 'In Transit',
          bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
          icon: <Truck size={13} />
        };
      case 'shipped':
        return {
          label: 'Shipped',
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          icon: <Truck size={13} />
        };
      case 'accepted':
      case 'label_created':
        return {
          label: 'Preparing for dispatch',
          bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          icon: <Clock size={13} />
        };
      case 'disputed':
        return {
          label: 'Dispute Open',
          bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
          icon: <AlertCircle size={13} />
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          bg: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20',
          icon: <AlertCircle size={13} />
        };
      default:
        return {
          label: 'Order Confirmed',
          bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          icon: <Clock size={13} />
        };
    }
  };

  const filteredItems = items.filter(item => {
    const s = (item.status || 'pending').toLowerCase();
    const isDigital = item.offers?.category === 'digital';
    if (filter === 'active') {
      return !['completed', 'transfer_completed', 'resolved', 'cancelled'].includes(s);
    }
    if (filter === 'completed') {
      return ['completed', 'transfer_completed', 'resolved'].includes(s);
    }
    if (filter === 'digital') {
      return isDigital;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-24">
      {/* TOP HEADER */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all text-gray-700"
              title="Back to profile"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" size={24} /> My Orders
              </h1>
              <p className="text-xs text-gray-500 font-bold">Track your 3D purchases, shipments & digital downloads</p>
            </div>
          </div>

          <Link
            href="/profile/messages"
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-blue-200"
          >
            <MessageSquare size={14} /> Messages & Chat
          </Link>
        </div>

        {/* FILTER PILLS */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 pt-1 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Orders ({items.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              filter === 'active'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            In Progress ({items.filter(i => !['completed', 'transfer_completed', 'resolved', 'cancelled'].includes((i.status || '').toLowerCase())).length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              filter === 'completed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Completed ({items.filter(i => ['completed', 'transfer_completed', 'resolved'].includes((i.status || '').toLowerCase())).length})
          </button>
          <button
            onClick={() => setFilter('digital')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 ${
              filter === 'digital'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            3D Files ({items.filter(i => i.offers?.category === 'digital').length})
          </button>
        </div>
      </div>

      {/* CONTENT LIST */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="animate-spin text-blue-600 mb-3" size={36} />
            <p className="text-sm font-bold uppercase tracking-wider">Loading your purchases...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-200 shadow-sm max-w-md mx-auto my-12">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} />
            </div>
            <h2 className="text-xl font-black uppercase text-gray-900 mb-2">No orders found</h2>
            <p className="text-gray-500 text-xs font-medium mb-6 leading-relaxed">
              {filter === 'all'
                ? "You haven't made any purchases yet. Explore maker listings and find something unique to print!"
                : `No orders matching "${filter}" filter.`}
            </p>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wider text-xs transition-all shadow-md"
            >
              Explore 3D Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const statusBadge = getStatusBadge(item.status);
              const isDigital = item.offers?.category === 'digital';
              const activeTracking = item.tracking_number || item.tracking_code;
              const trackingUrl = getTrackingUrl(item.carrier, activeTracking);
              const shortOrderId = item.order_id ? item.order_id.slice(-6).toUpperCase() : 'ORD';
              const dateStr = new Date(item.created_at).toLocaleDateString([], {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });

              return (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                >
                  {/* LEFT: THUMBNAIL & INFO */}
                  <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                    <div className="w-20 h-20 sm:w-22 sm:h-22 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-200 relative">
                      {item.offers?.image_urls?.[0] ? (
                        <img
                          src={item.offers.image_urls[0]}
                          alt={item.offers.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package size={24} />
                        </div>
                      )}
                      {item.variant_color_hex && (
                        <div
                          className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full border border-white shadow-xs"
                          style={{ backgroundColor: item.variant_color_hex }}
                          title={item.variant_name || 'Variant'}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          #ORD-{shortOrderId} • {dateStr}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge.bg}`}
                        >
                          {statusBadge.icon} {statusBadge.label}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-gray-900 truncate mb-1">
                        {item.offers?.title || 'Custom Print Job'}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-gray-500 font-bold flex-wrap">
                        <span>Qty: {item.quantity}</span>
                        <span>•</span>
                        <span className="text-blue-600 font-black">
                          {formatPrice(item.price_at_purchase * item.quantity)}
                        </span>
                        {item.variant_name && (
                          <>
                            <span>•</span>
                            <span className="text-gray-700 font-semibold">{item.variant_name}</span>
                          </>
                        )}
                        {item.seller?.full_name && (
                          <>
                            <span>•</span>
                            <span className="text-gray-700">Maker: {item.seller.full_name}</span>
                          </>
                        )}
                      </div>

                      {/* TRACKING NUMBER IF AVAILABLE */}
                      {activeTracking && (
                        <div className="mt-2.5 flex items-center gap-2 text-xs">
                          <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                            {item.carrier || 'Courier'}:
                          </span>
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                            {activeTracking}
                          </span>
                          {trackingUrl && (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs font-bold inline-flex items-center gap-1 hover:underline"
                            >
                              Live Tracking <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: ACTION BUTTONS */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                    {/* OPEN ORDER CHAT */}
                    {item.chat_id ? (
                      <Link
                        href={`/profile/messages?chat=${item.chat_id}`}
                        className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare size={14} /> Open Chat
                      </Link>
                    ) : (
                      <Link
                        href={`/profile/messages?seller_id=${item.seller_id}&offer_id=${item.offer_id}`}
                        className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare size={14} /> Contact Maker
                      </Link>
                    )}

                    {/* DIGITAL DOWNLOAD BUTTON */}
                    {isDigital && item.offers?.file_url && (
                      <a
                        href={item.offers.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download size={14} /> Download 3D File
                      </a>
                    )}

                    {/* REVIEW BUTTON FOR COMPLETED ORDERS */}
                    {['completed', 'transfer_completed', 'resolved'].includes((item.status || '').toLowerCase()) && (
                      item.has_review ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1 border border-emerald-200">
                          <Star size={12} className="fill-emerald-600" /> Review Submitted
                        </span>
                      ) : (
                        <button
                          onClick={() => setReviewModalItem(item)}
                          className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                        >
                          <Star size={13} className="text-amber-500 fill-amber-500" /> Rate Maker
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* REVIEW MODAL */}
      {reviewModalItem && (
        <ReviewModal
          isOpen={true}
          orderItemId={reviewModalItem.id}
          offerTitle={reviewModalItem.offers?.title || 'Order'}
          sellerId={reviewModalItem.seller_id}
          onSuccess={() => {
            setReviewModalItem(null);
            fetchOrders();
          }}
          onClose={() => setReviewModalItem(null)}
        />
      )}
    </main>
  );
}
