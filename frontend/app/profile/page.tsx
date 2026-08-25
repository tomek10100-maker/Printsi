'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Settings, MapPin, Link as LinkIcon, Calendar, Loader2, Home, LogOut,
  CreditCard, Bell, Package, ChevronRight, ChevronDown, ShoppingBag, Plus, Trash2, Eye, Edit,
  Heart, TrendingUp, Wallet, DollarSign, MessageSquare, Sun, Moon, Sparkles, Layers, CheckCircle, User, Lock, Handshake, Shield,
  LayoutList, Grid2X2, List, LayoutGrid
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { getOfferStock, isOfferSoldOut, formatOfferWeight } from '../lib/offerHelpers';
import { getCountryDisplay } from '../lib/countryHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProfilePage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [expandedOffers, setExpandedOffers] = useState<Record<string, boolean>>({});

  const [stats, setStats] = useState({
    spent: 0,
    earned: 0,
    pendingEarned: 0,
    inventoryValue: 0
  });

  // MODAL STATE
  const [modal, setModal] = useState<{
    show: boolean;
    type: 'confirm' | 'error' | 'success';
    title: string;
    message: string;
    action?: () => Promise<void>;
  }>({ show: false, type: 'confirm', title: '', message: '' });

  const [isDeleting, setIsDeleting] = useState(false);
  const [myListingsViewMode, setMyListingsViewMode] = useState<'compact' | 'grid' | 'dense' | 'cards'>('compact');

  useEffect(() => {
    const savedMode = localStorage.getItem('printis_mylistings_view');
    if (savedMode && ['compact', 'grid', 'dense', 'cards'].includes(savedMode)) {
      setMyListingsViewMode(savedMode as any);
    }
  }, []);

  const changeViewMode = (mode: 'compact' | 'grid' | 'dense' | 'cards') => {
    setMyListingsViewMode(mode);
    localStorage.setItem('printis_mylistings_view', mode);
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Fetch Profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profileData);

    // 2. Fetch Notifications Count
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setUnreadCount(count || 0);

    // 2b. Fetch Unread Messages Count
    const { count: unreadMsgsCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_id', user.id);

    setUnreadMessages(unreadMsgsCount || 0);

    // 2c. Fetch Low Stock Filaments Count
    if (profileData?.roles?.includes('printer')) {
      const { count: lowStock } = await supabase
        .from('filaments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .lte('stock_grams', 100);
      setLowStockCount(lowStock || 0);
    }

    // 3. FETCH OFFERS & INVENTORY
    const { data: offersData } = await supabase
      .from('offers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Efficiently enrich custom orders with buyer info
    const customOrderList = (offersData || []).filter(o => o.is_custom && o.parent_offer_id);
    const parentOfferIds = [...new Set(customOrderList.map(o => o.parent_offer_id))];
    
    let enrichedOffers = offersData || [];

    if (parentOfferIds.length > 0) {
      // Find chats associated with these parent offers where this user is the seller
      const { data: chatsData } = await supabase
        .from('chats')
        .select('offer_id, buyer_id, profiles!chats_buyer_id_fkey(full_name, avatar_url)')
        .in('offer_id', parentOfferIds)
        .eq('seller_id', user.id);

      if (chatsData) {
        enrichedOffers = (offersData || []).map(offer => {
          if (offer.is_custom && offer.parent_offer_id) {
            const chatMatch = chatsData.find(c => c.offer_id === offer.parent_offer_id);
            if (chatMatch) {
              return { 
                ...offer, 
                _buyer: (chatMatch as any).profiles,
                _chat_offer_id: offer.parent_offer_id 
              };
            }
          }
          return offer;
        });
      }
    }

    setMyOffers(enrichedOffers);

    const inventoryVal = offersData?.reduce((acc, item) => {
      // If it's a digital file or has 'infinite' stock (over 1000), we don't count it as a physical asset value.
      if (item.stock > 1000) return acc;
      return acc + (item.price * item.stock);
    }, 0) || 0;

    const { data: orders } = await supabase.from('orders').select('total_amount').eq('buyer_id', user.id).like('stripe_payment_intent_id', 'balance_%');
    const totalSpent = orders?.reduce((acc, order) => acc + order.total_amount, 0) || 0;

    const { data: payouts } = await supabase.from('payouts').select('amount').eq('user_id', user.id).in('status', ['pending', 'completed']);
    const totalPayouts = payouts?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;

    // GET SALES WITH STATUS
    const { data: sales, error: salesError } = await supabase.from('order_items').select('price_at_purchase, quantity, status').eq('seller_id', user.id);
    
    let totalEarned = 0;
    let pendingEarned = 0;

    if (!salesError && sales) {
      sales.forEach(sale => {
        const amt = sale.price_at_purchase * (sale.quantity || 1);
        if (sale.status === 'completed') {
          totalEarned += amt;
        } else {
          pendingEarned += amt;
        }
      });
    }

    setStats({
      spent: totalSpent + totalPayouts,
      earned: totalEarned,
      pendingEarned: pendingEarned,
      inventoryValue: inventoryVal
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const executeArchive = async (id: string) => {
    setIsDeleting(true);
    const { error } = await supabase.from('offers').update({ is_active: false }).eq('id', id);
    if (!error) {
      setMyOffers(prev => prev.filter(offer => offer.id !== id));
      setModal({
        show: true,
        type: 'success',
        title: 'Listing Archived',
        message: 'Since this item was sold before, it cannot be deleted. It has been moved to your archives.'
      });
    } else {
      setModal({
        show: true,
        type: 'error',
        title: 'Archiving Failed',
        message: 'Could not archive this listing: ' + error.message
      });
    }
    setIsDeleting(false);
  };

  const executeDelete = async (id: string) => {
    setIsDeleting(true);
    const deletedItem = myOffers.find(o => o.id === id);
    
    // First, clear favorites to avoid foreign key constraints (Like button data)
    await supabase.from('favorites').delete().eq('offer_id', id);

    // If it's a custom order, mark related proposal messages as rejected
    if (deletedItem?.is_custom && deletedItem?.parent_offer_id) {
      try {
        const { data: chats } = await supabase
          .from('chats')
          .select('id')
          .eq('offer_id', deletedItem.parent_offer_id);
        if (chats && chats.length > 0) {
          for (const chat of chats) {
            const { data: msgs } = await supabase
              .from('messages')
              .select('id, content')
              .eq('chat_id', chat.id);
            if (msgs) {
              for (const msg of msgs) {
                if (msg.content?.startsWith('[PROPOSAL]')) {
                  try {
                    const parsed = JSON.parse(msg.content.substring(10));
                    if (parsed.custom_offer_id === id && parsed.status !== 'rejected') {
                      parsed.status = 'rejected';
                      await supabase.from('messages').update({
                        content: `[PROPOSAL]${JSON.stringify(parsed)}`
                      }).eq('id', msg.id);
                    }
                  } catch { }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to reject related proposals:', e);
      }
    }

    const { error } = await supabase.from('offers').delete().eq('id', id);
    
    if (error) {
      if (error.code !== '23503') {
        console.error("Deletion Failed:", (error as any).message || error);
      }
      
      if (error.code === '23503') {
        const listing = myOffers.find(o => o.id === id);
        setModal({
          show: true,
          type: 'confirm',
          title: 'Cannot Delete Sold Item',
          message: `Because "${listing?.title || 'this item'}" has sales history, it must remain in the system for your customers. Do you want to Archive (hide) it from your profile instead?`,
          action: () => executeArchive(id)
        });
      } else {
        setModal({
          show: true,
          type: 'error',
          title: 'Deletion Error',
          message: error.message || 'An unexpected error occurred while deleting.'
        });
      }
    } else {
      setMyOffers(prev => prev.filter(offer => offer.id !== id));
      if (deletedItem) {
        setStats(prev => ({
          ...prev,
          inventoryValue: prev.inventoryValue - (deletedItem.stock > 1000 ? 0 : (deletedItem.price * deletedItem.stock))
        }));
      }
      setModal({
        show: true,
        type: 'success',
        title: deletedItem?.is_custom ? 'Custom Order Cancelled' : 'Listing Removed',
        message: deletedItem?.is_custom
          ? 'The custom order has been removed and the buyer has been notified (proposal marked as rejected).'
          : 'Your offer has been successfully deleted.'
      });
    }
    setIsDeleting(false);
  };

  const confirmDelete = (id: string) => {
    setModal({
      show: true,
      type: 'confirm',
      title: 'Delete Listing?',
      message: 'Are you sure you want to permanently remove this listing? This action cannot be undone.',
      action: () => executeDelete(id)
    });
  };

  // --- OBLICZANIE SALDA (NET BALANCE) ---
  const netBalance = stats.earned - stats.spent;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 relative">

      {/* NAVBAR */}
      <div className="absolute top-6 left-6 z-10 flex gap-4">
        <Link
          href="/"
          className="bg-white/90 backdrop-blur-sm px-5 py-3 rounded-xl font-bold text-gray-900 shadow-lg hover:bg-white hover:scale-105 transition-all flex items-center gap-2"
        >
          <Home size={18} /> Home
        </Link>
      </div>

      {/* COVER */}
      <div className="h-60 bg-gradient-to-r from-blue-600 to-purple-600 relative">
        <div className="absolute inset-0 bg-black/10"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-20">

        {/* HEADER TOP ROW: AVATAR, NAME, ACTIONS */}
        <div className="relative -mt-20 mb-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 text-center md:text-left">
          {/* AVATAR & NAME */}
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="w-36 h-36 sm:w-40 sm:h-40 bg-white p-1 rounded-full shadow-2xl flex-shrink-0 relative group">
              <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-4xl font-black text-gray-400 uppercase overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  profile?.full_name?.[0] || 'U'
                )}
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900">{profile?.full_name || 'Anonymous User'}</h1>
              <p className="text-gray-500 font-bold mt-1">Member since 2026</p>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 flex-wrap justify-center md:justify-end w-full md:w-auto">
            <button
              onClick={() => setTheme(theme === 'white' ? 'black' : theme === 'black' ? 'midnight' : 'white')}
              className="px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-purple-500 hover:text-purple-600 transition-all flex items-center gap-2 shadow-sm min-w-[130px] justify-center group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
              {theme === 'white' && <><Sun size={18} className="text-yellow-500" /> Light</>}
              {theme === 'black' && <><Moon size={18} className="text-gray-900" /> Dark</>}
              {theme === 'midnight' && <><Sparkles size={18} className="text-purple-500 animate-pulse" /> Midnight</>}
            </button>
            <Link href="/settings" className="px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm">
              <Settings size={18} /> Edit Profile
            </Link>
            {profile?.roles?.includes('admin') && (
              <Link
                href="/admin"
                className="px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all border-2"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', borderColor: 'rgba(59,130,246,0.5)', color: '#93c5fd' }}
              >
                <Shield size={18} /> Admin Panel
              </Link>
            )}
            <button onClick={handleLogout} className="px-5 py-3 bg-gray-900 text-white border-2 border-gray-900 rounded-xl font-bold hover:bg-red-600 hover:border-red-600 transition-all flex items-center gap-2 shadow-lg">
              <LogOut size={18} /> Log Out
            </button>
          </div>
        </div>

        {/* --- BALANCE STATS CARDS GRID --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 w-full">
          {/* Total Sales Value — only for printer/cad roles */}
          {(profile?.roles?.includes('printer') || profile?.roles?.includes('cad')) && (
            <>
              <div className="bg-white/80 backdrop-blur-md border border-gray-200 p-5 rounded-2xl shadow-lg flex items-center gap-4 transition-all hover:shadow-xl w-full min-w-0">
                <div className="p-3.5 bg-green-100 text-green-600 rounded-xl shadow-inner flex-shrink-0">
                  <TrendingUp size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Total Sales Value</p>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatPrice(stats.earned + stats.pendingEarned)}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">without shipping</p>
                </div>
              </div>

              {/* Pending Funds */}
              <div className="bg-white/80 backdrop-blur-md border border-gray-200 p-5 rounded-2xl shadow-lg flex items-center gap-4 transition-all hover:shadow-xl w-full min-w-0">
                <div className="p-3.5 bg-yellow-100 text-yellow-600 rounded-xl shadow-inner flex-shrink-0">
                  <Package size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Pending Funds</p>
                  <p className="text-xl sm:text-2xl font-black text-yellow-600 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatPrice(stats.pendingEarned)}
                  </p>
                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">awaiting delivery</p>
                </div>
              </div>
            </>
          )}

          {/* Account Balance (available money, never below 0) */}
          <div className={`bg-white/80 backdrop-blur-md border border-gray-200 p-5 rounded-2xl shadow-lg flex items-center gap-4 transition-all hover:shadow-xl w-full min-w-0 ${
            (profile?.roles?.includes('printer') || profile?.roles?.includes('cad'))
              ? 'col-span-1 sm:col-span-2 lg:col-span-1'
              : 'col-span-1'
          }`}>
            <div className={`p-3.5 rounded-xl shadow-inner flex-shrink-0 ${netBalance > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
              <Wallet size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Account Balance</p>
              <p className={`text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${netBalance > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {formatPrice(Math.max(0, netBalance))}
              </p>
              <p className="text-[9px] text-gray-400 font-bold mt-0.5">available to spend</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT: INFO */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">About</h3>
              <p className="text-gray-600 leading-relaxed font-medium text-sm">
                {profile?.bio || "This user hasn't written a bio yet."}
              </p>
              <div className="mt-6 space-y-3">
                {(() => {
                  const countryInfo = getCountryDisplay(profile?.country);
                  return (
                    <div className="flex items-center gap-2 text-gray-700 text-sm font-bold bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 w-fit">
                      <span className="text-base leading-none">{countryInfo.flag}</span>
                      <span>{countryInfo.name} ({countryInfo.code})</span>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-3 text-gray-500 text-sm font-bold"><Calendar size={16} /> Joined Feb 2026</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 text-lg">Roles</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.roles?.map((role: string) => (
                  <span key={role} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-wide border border-blue-100">{role}</span>
                ))}
                {(!profile?.roles || profile.roles.length === 0) && <span className="text-gray-400 italic text-sm font-medium">No roles selected</span>}
              </div>
            </div>
          </div>

          {/* RIGHT: SHOP DASHBOARD */}
          <div className="lg:col-span-2 space-y-6">

            {/* --- SHOP DASHBOARD --- */}
            <div>
              <h3 className="text-xl font-black uppercase text-gray-900 mb-4 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" /> Shop Dashboard
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DashboardCard 
                  icon={<CreditCard size={24} />} 
                  title="Billing & Payouts" 
                  subtitle={(profile?.roles?.includes('printer') || profile?.roles?.includes('cad')) ? "Manage cards & earnings" : "Wallet & Add Funds"} 
                  href="/profile/billing" 
                />
                <DashboardCard icon={<MapPin size={24} />} title="Shipping Address" subtitle="Your delivery address" href="/profile/address" />
                {profile?.roles?.includes('printer') && (
                  <DashboardCard icon={<Wallet size={24} />} title="Delivery Settings" subtitle="Your ship-from country" href="/profile/delivery" />
                )}

                <DashboardCard
                  icon={<MessageSquare size={24} />}
                  title="Messages"
                  subtitle="Chat with buyers & sellers"
                  href="/profile/messages"
                  badge={unreadMessages > 0 ? unreadMessages : null}
                />

                <DashboardCard
                  icon={<Bell size={24} />}
                  title="Notifications"
                  subtitle="Alerts & updates"
                  href="/profile/notifications"
                  badge={unreadCount > 0 ? unreadCount : null}
                />

                <DashboardCard
                  icon={<Heart size={24} />}
                  title="My Collection"
                  subtitle="Saved items & wishlist"
                  href="/profile/favorites"
                />

                {/* Filaments – only for printers */}
                {profile?.roles?.includes('printer') && (
                  <DashboardCard
                    icon={
                      <div className="relative">
                        <Layers size={24} />
                        {lowStockCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                            {lowStockCount}
                          </div>
                        )}
                      </div>
                    }
                    title="My Filaments"
                    subtitle="Manage your filament stock"
                    href="/profile/filaments"
                    accent
                  />
                )}
              </div>
            </div>

            {/* --- MY LISTINGS SECTION --- */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 mt-8">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-black uppercase text-gray-900 flex items-center gap-2">
                    <Package className="text-blue-600" /> My Listings
                  </h3>
                  {/* ASSET VALUE BADGE */}
                  {stats.inventoryValue > 0 && (
                    <span className="bg-gray-100 border border-gray-200 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                      <DollarSign size={12} /> Asset Value: <span className="text-gray-900">{formatPrice(stats.inventoryValue)}</span>
                    </span>
                  )}
                </div>

                {myOffers.length > 0 && (
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap sm:flex-nowrap">
                    {/* 4-MODE VIEW SWITCHER BAR */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/60 shadow-2xs">
                      <button
                        onClick={() => changeViewMode('compact')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${myListingsViewMode === 'compact' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Compact List View (Default)"
                      >
                        <LayoutList size={15} />
                        <span className="text-[11px] uppercase tracking-wider font-black">Compact</span>
                      </button>

                      <button
                        onClick={() => changeViewMode('grid')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${myListingsViewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        title="2-Column Grid View"
                      >
                        <Grid2X2 size={15} />
                        <span className="text-[11px] uppercase tracking-wider font-black">Grid</span>
                      </button>

                      <button
                        onClick={() => changeViewMode('dense')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${myListingsViewMode === 'dense' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Ultra-compact Table Row View"
                      >
                        <List size={15} />
                        <span className="text-[11px] uppercase tracking-wider font-black">Rows</span>
                      </button>

                      <button
                        onClick={() => changeViewMode('cards')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${myListingsViewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Large Cards View"
                      >
                        <LayoutGrid size={15} />
                        <span className="text-[11px] uppercase tracking-wider font-black">Cards</span>
                      </button>
                    </div>

                    <Link href="/upload" className="text-xs font-bold bg-gray-900 text-white px-3.5 py-2 rounded-xl hover:bg-blue-600 transition flex items-center gap-1 shrink-0 shadow-sm">
                      <Plus size={14} /> Add New
                    </Link>
                  </div>
                )}
              </div>

              {myOffers.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center py-20">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Package size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">No active listings</h3>
                  <p className="text-gray-500 mt-2 font-medium text-sm">Start selling by creating your first listing.</p>
                  <Link href="/upload" className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg text-sm">
                    + Create First Listing
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* MODE 1: COMPACT (DEFAULT) */}
                  {myListingsViewMode === 'compact' && (
                    <div className="space-y-3">
                      {myOffers.filter((o: any) => !o.is_custom).map((offer: any) => {
                        const variants = offer.color_variants || [];
                        const hasVariants = variants.length > 1;
                        const offerSoldOut = isOfferSoldOut(offer);
                        const offerStock = getOfferStock(offer);
                        const displayWeight = formatOfferWeight(offer.weight, variants[0]?.layers);

                        return (
                          <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-xs hover:shadow-md transition-all flex flex-col relative">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                                {/* Thumbnail */}
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-xl overflow-hidden shrink-0 relative border border-gray-100">
                                  {offer.image_urls?.[0] ? (
                                    <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={20} /></div>
                                  )}
                                  <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-white/90 backdrop-blur rounded text-[8px] font-black uppercase text-gray-900 shadow-2xs">
                                    {offer.category === 'job' ? 'Request' : offer.category === 'digital' ? 'File' : 'Item'}
                                  </div>
                                  {offerSoldOut && (
                                    <div className="absolute inset-0 bg-red-500/20 backdrop-blur-[1px] flex items-center justify-center">
                                      <span className="bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow">Sold</span>
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-black text-gray-900 text-sm sm:text-base line-clamp-1">{offer.title}</h4>
                                    {hasVariants && (
                                      <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                        {variants.length} colors
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap text-xs">
                                    {offer.is_negotiable ? (
                                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Negotiable</span>
                                    ) : (
                                      <span className="text-base font-black text-gray-900">{formatPrice(offer.price)}</span>
                                    )}

                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                      offer.category === 'digital' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                      offer.category === 'physical' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                      'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                      {offer.category}
                                    </span>

                                    <span className="text-[10px] font-bold text-gray-500">
                                      Stock: <strong className="text-gray-900">{offer.category === 'digital' ? '∞' : (offerSoldOut ? '0' : `${offerStock} pcs`)}</strong>
                                    </span>
                                  </div>

                                  {offer.category !== 'digital' && offer.material && (
                                    <p className="text-[10px] text-gray-400 font-bold truncate">
                                      Material: <span className="text-purple-600 capitalize">{offer.material}</span>
                                      {displayWeight && <span> · Net: {displayWeight}</span>}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 w-full sm:w-auto justify-end">
                                <Link href={`/offer/${offer.id}`} className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition flex items-center gap-1" title="Preview">
                                  <Eye size={14} /> <span className="hidden sm:inline">Preview</span>
                                </Link>
                                <Link href={`/edit/${offer.id}`} className="px-2.5 py-1.5 bg-gray-900 hover:bg-blue-600 text-white rounded-xl font-bold text-xs transition flex items-center gap-1" title="Edit">
                                  <Edit size={14} /> <span className="hidden sm:inline">Edit</span>
                                </Link>
                                <button onClick={() => confirmDelete(offer.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition" title="Delete">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODE 2: GRID (2 COLUMNS ON MOBILE) */}
                  {myListingsViewMode === 'grid' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {myOffers.filter((o: any) => !o.is_custom).map((offer: any) => {
                        const offerSoldOut = isOfferSoldOut(offer);
                        const offerStock = getOfferStock(offer);

                        return (
                          <div key={offer.id} className="bg-white rounded-2xl border border-gray-100 p-2.5 flex flex-col shadow-xs hover:shadow-md transition-all relative">
                            <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden relative mb-2 border border-gray-100">
                              {offer.image_urls?.[0] ? (
                                <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={24} /></div>
                              )}
                              <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-white/90 backdrop-blur rounded text-[7px] font-black uppercase text-gray-900 shadow-2xs">
                                {offer.category === 'job' ? 'Request' : offer.category === 'digital' ? 'File' : 'Item'}
                              </div>
                              {offerSoldOut && (
                                <div className="absolute inset-0 bg-red-500/20 backdrop-blur-[1px] flex items-center justify-center">
                                  <span className="bg-red-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow">Sold</span>
                                </div>
                              )}
                            </div>

                            <h4 className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 mb-0.5">{offer.title}</h4>
                            <div className="font-black text-xs sm:text-sm text-gray-900 mb-1">
                              {offer.is_negotiable ? <span className="text-indigo-600">Negotiable</span> : formatPrice(offer.price)}
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-bold text-gray-400 mt-auto pt-1">
                              <span className="capitalize">{offer.category}</span>
                              <span>{offer.category === 'digital' ? '∞' : (offerSoldOut ? 'Sold' : `${offerStock} pcs`)}</span>
                            </div>

                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-50 justify-between">
                              <Link href={`/offer/${offer.id}`} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs" title="Preview">
                                <Eye size={13} />
                              </Link>
                              <Link href={`/edit/${offer.id}`} className="p-1.5 bg-gray-900 hover:bg-blue-600 text-white rounded-lg text-xs" title="Edit">
                                <Edit size={13} />
                              </Link>
                              <button onClick={() => confirmDelete(offer.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODE 3: DENSE TABLE ROWS */}
                  {myListingsViewMode === 'dense' && (
                    <div className="space-y-1.5">
                      {myOffers.filter((o: any) => !o.is_custom).map((offer: any) => {
                        const offerSoldOut = isOfferSoldOut(offer);
                        const offerStock = getOfferStock(offer);

                        return (
                          <div key={offer.id} className="flex items-center justify-between gap-2 sm:gap-4 bg-white rounded-xl border border-gray-100 p-2 shadow-2xs hover:bg-gray-50/80 transition-all">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100">
                              {offer.image_urls?.[0] ? (
                                <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={14} /></div>
                              )}
                            </div>

                            <h4 className="font-bold text-xs text-gray-900 truncate flex-1 min-w-0">{offer.title}</h4>

                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0 hidden xs:inline-block">
                              {offer.category}
                            </span>

                            <span className="text-[10px] font-bold text-gray-500 shrink-0">
                              {offer.category === 'digital' ? '∞' : (offerSoldOut ? 'Sold' : `${offerStock} pcs`)}
                            </span>

                            <span className="font-black text-xs sm:text-sm text-gray-900 shrink-0">
                              {offer.is_negotiable ? 'Neg' : formatPrice(offer.price)}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              <Link href={`/offer/${offer.id}`} className="p-1 text-gray-400 hover:text-gray-700" title="Preview"><Eye size={14} /></Link>
                              <Link href={`/edit/${offer.id}`} className="p-1 text-gray-400 hover:text-blue-600" title="Edit"><Edit size={14} /></Link>
                              <button onClick={() => confirmDelete(offer.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* MODE 4: CARDS (ORIGINAL LARGE CARDS) */}
                  {myListingsViewMode === 'cards' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10">
                    {myOffers.filter((o: any) => !o.is_custom).map((offer: any) => {
                      const variants = offer.color_variants || [];
                      const hasVariants = variants.length > 1;
                      const offerSoldOut = isOfferSoldOut(offer);
                      const offerStock = getOfferStock(offer);
                      const displayWeight = formatOfferWeight(offer.weight, variants[0]?.layers);
                      // Only show active custom orders (stock > 0 means not yet fulfilled/expired)
                      const linkedCustomOrders = myOffers.filter(
                        (o: any) => o.is_custom && o.parent_offer_id === offer.id && o.stock > 0
                      );
                      return (
                        <div key={offer.id} className="flex flex-col">
                          {/* ── Main listing card ── */}
                          <div className="group bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative z-10">
                            {/* Thumbnail */}
                            <div className="aspect-square bg-gray-50 overflow-hidden relative">
                               {offer.image_urls?.[0] ? (
                                 <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center text-gray-200 bg-gray-50"><Package size={48} /></div>
                               )}
                               <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[9px] font-black uppercase text-gray-900 shadow-sm z-20">
                                 {offer.category === 'job' ? 'Request' : offer.category === 'digital' ? 'File' : 'Item'}
                               </div>
                               {offerSoldOut && (
                                 <div className="absolute inset-0 bg-red-500/10 backdrop-blur-[2px] flex items-center justify-center z-30">
                                   <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-2 px-8 -rotate-12 border-2 border-white shadow-xl">Sold Out</div>
                                 </div>
                               )}
                            </div>

                            {/* Info */}
                            <div className="p-6 flex flex-col flex-grow">
                              <h4 className="font-black text-gray-900 text-lg mb-1 leading-tight group-hover:text-blue-600 transition-colors">{offer.title}</h4>
                              <div className="flex items-center gap-2 mb-4">
                                {offer.is_negotiable ? (
                                   <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                     <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                     <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest leading-none">Negotiable</span>
                                   </div>
                                ) : (
                                   <span className="text-xl font-black text-gray-900">{formatPrice(offer.price)}</span>
                                )}
                                {hasVariants && (
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded-md">
                                    {variants.length} colors
                                  </span>
                                )}
                              </div>

                              {/* Quick Stats */}
                              <div className="grid grid-cols-2 gap-2 mb-6">
                                <div className="bg-blue-50/50 p-2.5 rounded-2xl border border-blue-50 flex flex-col justify-center">
                                   <span className="block text-[8px] font-black uppercase text-blue-400 tracking-widest mb-0.5">Total Stock</span>
                                   <span className="block font-black text-blue-900 text-xs">
                                     {offer.category === 'digital' ? <span className="text-xl leading-none">∞</span> : (offerSoldOut ? <span className="text-red-500">Sold</span> : `${offerStock} pcs`)}
                                   </span>
                                </div>
                                <div className={`p-2.5 rounded-2xl border ${
                                   offer.category === 'digital' ? 'bg-orange-50/50 border-orange-50' :
                                   offer.category === 'physical' ? 'bg-emerald-50/50 border-emerald-50' :
                                   'bg-blue-50/50 border-blue-50'
                                 }`}>
                                   <span className={`block text-[8px] font-black uppercase tracking-widest mb-0.5 ${
                                     offer.category === 'digital' ? 'text-orange-400' :
                                     offer.category === 'physical' ? 'text-emerald-400' :
                                     'text-blue-400'
                                   }`}>Category</span>
                                   <span className={`block font-black text-xs capitalize ${
                                     offer.category === 'digital' ? 'text-orange-900' :
                                     offer.category === 'physical' ? 'text-emerald-900' :
                                     'text-blue-900'
                                   }`}>{offer.category}</span>
                                 </div>

                                 {/* More Stats Row */}
                                 {offer.category !== 'digital' && (
                                   <div className="grid grid-cols-2 gap-2 col-span-2">
                                     <div className="bg-purple-50/50 p-2.5 rounded-2xl border border-purple-50 flex flex-col justify-center">
                                       <span className="block text-[8px] font-black uppercase text-purple-400 tracking-widest mb-0.5">Material</span>
                                       <span className="block font-black text-purple-900 text-xs truncate capitalize">{offer.material || 'Mixed'}</span>
                                     </div>
                                     {offer.category === 'job' ? (
                                       <div className="bg-blue-50/50 p-2.5 rounded-2xl border border-blue-50 flex flex-col justify-center">
                                         <span className="block text-[8px] font-black uppercase text-blue-400 tracking-widest mb-0.5">Quantity Requested</span>
                                         <span className="block font-black text-blue-900 text-xs">{offer.stock || 1} pcs</span>
                                       </div>
                                     ) : (
                                       <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-50 flex flex-col justify-center">
                                         <span className="block text-[8px] font-black uppercase text-amber-400 tracking-widest mb-0.5">Net Weight</span>
                                         <span className="block font-black text-amber-900 text-xs">{displayWeight}</span>
                                       </div>
                                     )}
                                   </div>
                                 )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-50">
                                <Link href={`/offer/${offer.id}`} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[10px] text-center hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                                  <Eye size={14} /> Preview
                                </Link>
                                <Link href={`/edit/${offer.id}`} className="flex-1 py-3.5 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[10px] text-center hover:bg-blue-600 transition-all shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2">
                                  <Edit size={14} /> Edit
                                </Link>
                                <button onClick={() => confirmDelete(offer.id)} className="p-3.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>

                          {/* ── Attached custom orders ── */}
                          {linkedCustomOrders.length > 0 && (
                            <div className="ml-4 mt-2 flex flex-col items-start">
                              <button
                                onClick={() => setExpandedOffers(prev => ({ ...prev, [offer.id]: !prev[offer.id] }))}
                                className="px-3 py-1.5 bg-white hover:bg-purple-50/80 border border-dashed border-purple-200 rounded-full text-[10px] font-bold text-purple-600 flex items-center gap-1.5 transition-all shadow-sm group/btn cursor-pointer"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                <span>{linkedCustomOrders.length} {linkedCustomOrders.length === 1 ? 'custom offer' : 'custom offers'}</span>
                                <ChevronDown size={12} className={`text-purple-400 group-hover/btn:text-purple-600 transition-transform duration-200 ${expandedOffers[offer.id] ? 'rotate-180' : ''}`} />
                              </button>

                              {expandedOffers[offer.id] && (
                                <div className="w-full relative mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                  {/* Vertical connector line */}
                                  <div className="absolute left-0 top-0 bottom-6 w-px bg-purple-100" />
                                  <div className="space-y-0 pt-2">
                                    {linkedCustomOrders.map((co: any, ci: number) => {
                                      const buyerName = co._buyer?.full_name || 'Unknown buyer';
                                      const buyerAvatar = co._buyer?.avatar_url;
                                      const isLast = ci === linkedCustomOrders.length - 1;
                                      return (
                                        <div key={co.id} className="relative pl-5">
                                          {/* Horizontal connector nub */}
                                          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-5 h-px bg-purple-100`} />
                                          <div className={`flex items-center gap-3 bg-white border border-dashed border-purple-100 px-4 py-2.5 hover:border-purple-200 hover:bg-purple-50/30 transition-all group/co ${
                                            ci === 0 ? 'rounded-t-xl' : ''
                                          } ${isLast ? 'rounded-b-3xl' : 'border-b-0'}`}>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[7px] font-black uppercase tracking-widest text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100 flex-shrink-0">Custom</span>
                                                <span className="font-black text-gray-900 text-[11px] flex-shrink-0">{formatPrice(co.price)}</span>
                                                <span className="text-gray-300 mx-0.5">·</span>
                                                <span className="text-[10px] font-bold text-gray-400 flex-shrink-0">{co.stock === 0 ? <span className="text-emerald-500">Sold</span> : `${co.stock} pcs`}</span>
                                                {co.material && (
                                                  <>
                                                    <span className="text-gray-300 mx-0.5">·</span>
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{co.material}</span>
                                                  </>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2 mb-1.5 line-clamp-1">
                                                 <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                                   {co.color || 'Custom Color'}
                                                   {(() => {
                                                     try {
                                                       const weight = co.color_variants?.[0]?.layers?.reduce((acc: number, l: any) => acc + (parseFloat(l.grams) || 0), 0);
                                                       return weight > 0 ? <span className="text-gray-400 font-medium whitespace-nowrap">({Math.round(weight)}g)</span> : null;
                                                     } catch { return null; }
                                                   })()}
                                                 </span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                {buyerAvatar
                                                  ? <img src={buyerAvatar} className="w-3.5 h-3.5 rounded-full border border-gray-200 flex-shrink-0" alt="" />
                                                  : <div className="w-3.5 h-3.5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0"><User size={7} className="text-gray-400" /></div>
                                                }
                                                <span className="text-[10px] font-bold text-gray-400 truncate">for <span className="text-gray-600">{buyerName}</span></span>
                                              </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <div className="p-1.5 text-gray-200 cursor-not-allowed rounded-lg" title="Editing custom orders is disabled">
                                                <Lock size={12} />
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setModal({
                                                    show: true,
                                                    type: 'confirm',
                                                    title: 'Cancel Custom Order?',
                                                    message: `This will permanently remove the custom order for "${buyerName}". The proposal in the chat will be marked as rejected. This cannot be undone.`,
                                                    action: () => executeDelete(co.id)
                                                  });
                                                }}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Cancel custom order"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                        })}
                      </div>
                    )}

                  {/* ── Stand-alone Custom Orders (e.g. from Jobs or deleted parents) ── */}
                  {myOffers.some((o: any) => o.is_custom && o.stock > 0 && !myOffers.some(parent => parent.id === o.parent_offer_id)) && (
                    <div className="mt-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-px bg-purple-100 flex-1" />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400">Negotiations & Special Offers</h4>
                        <div className="h-px bg-purple-100 flex-1" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {myOffers
                          .filter((o: any) => o.is_custom && o.stock > 0 && !myOffers.some(parent => parent.id === o.parent_offer_id))
                          .map((co: any) => {
                            const buyerName = co._buyer?.full_name || 'Unknown buyer';
                            const buyerAvatar = co._buyer?.avatar_url;
                            return (
                              <div key={co.id} className="flex items-center gap-4 bg-white border-2 border-dashed border-purple-50 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all">
                                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                                   <Handshake className="text-purple-400" size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-purple-500 bg-purple-100/50 px-2 py-0.5 rounded-full">Custom Offer</span>
                                    <span className="text-xs font-black text-gray-900 truncate">{co.title}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg font-black text-gray-900">{formatPrice(co.price)}</span>
                                    <span className="text-gray-300 mx-0.5">·</span>
                                    <span className="text-[10px] font-bold text-gray-400">
                                      {co.stock === 0 ? <span className="text-emerald-500">Sold</span> : `${co.stock} pcs`}
                                    </span>
                                    {co.material && (
                                      <>
                                        <span className="text-gray-300 mx-0.5">·</span>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{co.material}</span>
                                      </>
                                    )}
                                    <div className="flex items-center gap-1.5 ml-2">
                                       {buyerAvatar
                                         ? <img src={buyerAvatar} className="w-4 h-4 rounded-full border border-gray-200" alt="" />
                                         : <div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center"><User size={9} className="text-gray-400" /></div>
                                       }
                                       <span className="text-xs font-bold text-gray-500">for <span className="text-gray-900">{buyerName}</span></span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link href={`/offer/${co.id}`} className="p-3 bg-gray-50 text-gray-400 hover:text-gray-700 rounded-2xl transition-all">
                                    <Eye size={18} />
                                  </Link>
                                  <button
                                     onClick={() => {
                                       setModal({
                                         show: true,
                                         type: 'confirm',
                                         title: 'Cancel Custom Order?',
                                         message: `This will remove the custom order for "${buyerName}".`,
                                         action: () => executeDelete(co.id)
                                       });
                                     }}
                                     className="p-3 bg-gray-50 text-gray-300 hover:text-red-500 rounded-2xl transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>
      </div>

      {/* CUSTOM MODAL SYSTEM */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                modal.type === 'confirm' ? 'bg-blue-50 text-blue-600' :
                modal.type === 'error' ? 'bg-red-50 text-red-600' :
                'bg-green-50 text-green-600'
              }`}>
                {modal.type === 'confirm' && <Sparkles size={40} className="animate-pulse" />}
                {modal.type === 'error' && <Trash2 size={40} />}
                {modal.type === 'success' && <CheckCircle size={40} />}
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 mb-2">{modal.title}</h3>
              <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">{modal.message}</p>
              
              <div className="flex flex-col gap-3 w-full">
                {modal.type === 'confirm' ? (
                  <>
                    <button 
                      onClick={async () => {
                        if (modal.action) {
                          await modal.action();
                        }
                      }}
                      disabled={isDeleting}
                      className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                    >
                      {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Delete Permanently'}
                    </button>
                    <button 
                      onClick={() => setModal({ ...modal, show: false })}
                      className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setModal({ ...modal, show: false })}
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg ${
                      modal.type === 'error' ? 'bg-gray-900 text-white hover:bg-black shadow-gray-200' : 
                      'bg-green-600 text-white hover:bg-green-700 shadow-green-200'
                    }`}
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function DashboardCard({ icon, title, subtitle, href, badge, accent }: any) {
  const Content = (
    <>
      <div className={`relative w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 transition-colors ${accent ? 'group-hover:bg-orange-50 group-hover:text-orange-600' : 'group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
        {icon}
        {badge && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-300">
            {badge}
          </div>
        )}
      </div>
      <div>
        <h4 className={`font-bold text-gray-900 transition-colors ${accent ? 'group-hover:text-orange-700' : 'group-hover:text-blue-700'}`}>{title}</h4>
        <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
      </div>
      <ChevronRight className={`ml-auto text-gray-300 transition-colors ${accent ? 'group-hover:text-orange-400' : 'group-hover:text-blue-400'}`} size={18} />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left group ${accent ? 'hover:border-orange-200' : 'hover:border-blue-200'}`}>
        {Content}
      </Link>
    );
  }

  return (
    <button className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
      {Content}
    </button>
  );
}