'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Settings, MapPin, Link as LinkIcon, Calendar, Loader2, Home, LogOut,
  CreditCard, Bell, Package, ChevronRight, ShoppingBag, Plus, Trash2, Eye, Edit,
  Heart, TrendingUp, TrendingDown, Wallet, DollarSign
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProfilePage() {
  const router = useRouter();
  const { formatPrice } = useCurrency(); 

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [myOffers, setMyOffers] = useState<any[]>([]);
  
  const [stats, setStats] = useState({
    spent: 0,
    earned: 0,
    inventoryValue: 0
  });

  useEffect(() => {
    const fetchData = async () => {
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

      // 3. FETCH OFFERS & INVENTORY
      const { data: offersData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setMyOffers(offersData || []);

      const inventoryVal = offersData?.reduce((acc, item) => acc + (item.price * item.stock), 0) || 0;

      // 4. FINANCIAL STATS
      const { data: orders } = await supabase.from('orders').select('total_amount').eq('buyer_id', user.id);
      const totalSpent = orders?.reduce((acc, order) => acc + order.total_amount, 0) || 0;

      const { data: sales } = await supabase.from('order_items').select('price_at_purchase, quantity').eq('seller_id', user.id);
      const totalEarned = sales?.reduce((acc, sale) => acc + (sale.price_at_purchase * (sale.quantity || 1)), 0) || 0;

      setStats({
        spent: totalSpent,
        earned: totalEarned,
        inventoryValue: inventoryVal
      });

      setLoading(false);
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); 
    router.refresh();
  };

  const handleDeleteOffer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    const { error } = await supabase.from('offers').delete().eq('id', id);
    if (!error) {
        setMyOffers(myOffers.filter(offer => offer.id !== id));
        const deletedItem = myOffers.find(o => o.id === id);
        if (deletedItem) {
            setStats(prev => ({
                ...prev,
                inventoryValue: prev.inventoryValue - (deletedItem.price * deletedItem.stock)
            }));
        }
    } else {
        alert("Error deleting offer: " + error.message);
    }
  };

  // --- OBLICZANIE SALDA (NET BALANCE) ---
  const netBalance = stats.earned - stats.spent;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

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
        
        {/* HEADER */}
        <div className="relative -mt-20 mb-12 flex flex-col md:flex-row items-end gap-8">
          {/* AVATAR */}
          <div className="w-40 h-40 bg-white p-1 rounded-full shadow-2xl flex-shrink-0 relative group">
            <div className="w-full h-full bg-gray-200 rounded-full flex items-center justify-center text-4xl font-black text-gray-400 uppercase overflow-hidden">
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
               ) : (
                 profile?.full_name?.[0] || 'U'
               )}
            </div>
          </div>
          
          {/* USER INFO & STATS */}
          <div className="flex-1 mb-2 w-full">
            <h1 className="text-4xl font-black text-gray-900">{profile?.full_name || 'Anonymous User'}</h1>
            <p className="text-gray-500 font-bold mb-6">Member since 2026</p>

            {/* --- FINANSE & BILANS --- */}
            <div className="flex flex-wrap gap-6 bg-white/80 backdrop-blur-md border border-gray-200 p-5 rounded-2xl w-fit shadow-lg">
                {/* Earned */}
                <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg shadow-inner">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Earned</p>
                        <p className="text-xl font-black text-gray-900">{formatPrice(stats.earned)}</p>
                    </div>
                </div>

                {/* Spent */}
                <div className="flex items-center gap-3 pr-6 border-r border-gray-200">
                    <div className="p-2 bg-gray-100 text-gray-600 rounded-lg shadow-inner">
                        <TrendingDown size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Spent</p>
                        <p className="text-xl font-black text-gray-900">{formatPrice(stats.spent)}</p>
                    </div>
                </div>

                {/* Net Balance (NOWE) */}
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg shadow-inner ${netBalance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        <Wallet size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider">Net Balance</p>
                        <p className={`text-xl font-black ${netBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {formatPrice(netBalance)}
                        </p>
                    </div>
                </div>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <Link href="/settings" className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 shadow-sm">
              <Settings size={18} /> Edit Profile
            </Link>
            <button onClick={handleLogout} className="px-6 py-3 bg-gray-900 text-white border-2 border-gray-900 rounded-xl font-bold hover:bg-red-600 hover:border-red-600 transition-all flex items-center gap-2 shadow-lg">
              <LogOut size={18} /> Log Out
            </button>
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
                <div className="flex items-center gap-3 text-gray-500 text-sm font-bold">
                  <MapPin size={16} /> 
                  {profile?.city ? `${profile.city}, ${profile.country}` : 'Poland'}
                </div>
                <div className="flex items-center gap-3 text-gray-500 text-sm font-bold opacity-60"><LinkIcon size={16} /> printsi.com/user</div>
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
                  <ShoppingBag className="text-blue-600"/> Shop Dashboard
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <DashboardCard icon={<CreditCard size={24}/>} title="Billing & Payouts" subtitle="Manage cards & earnings" href="/profile/billing" />
                   <DashboardCard icon={<MapPin size={24}/>} title="Shipping Addresses" subtitle="Delivery locations" href="/profile/address" />
                   
                   <DashboardCard 
                    icon={<Bell size={24}/>} 
                    title="Notifications" 
                    subtitle="Alerts & updates" 
                    href="/profile/notifications" 
                    badge={unreadCount > 0 ? unreadCount : null}
                   />
                   
                   <DashboardCard 
                     icon={<Package size={24}/>} 
                     title="Order History" 
                     subtitle="Track your purchases" 
                     href="/profile/orders" 
                   />

                   <DashboardCard 
                      icon={<Heart size={24}/>} 
                      title="My Collection" 
                      subtitle="Saved items & wishlist" 
                      href="/profile/favorites" 
                   />
                </div>
             </div>

             {/* --- MY LISTINGS SECTION --- */}
             <div>
                <div className="flex items-center justify-between mb-4 mt-8">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black uppercase text-gray-900 flex items-center gap-2">
                            <Package className="text-blue-600"/> My Listings
                        </h3>
                        {/* ASSET VALUE BADGE */}
                        {stats.inventoryValue > 0 && (
                            <span className="bg-gray-100 border border-gray-200 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                                <DollarSign size={12} /> Asset Value: <span className="text-gray-900">{formatPrice(stats.inventoryValue)}</span>
                            </span>
                        )}
                    </div>

                    {myOffers.length > 0 && (
                        <Link href="/upload" className="text-xs font-bold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition flex items-center gap-1">
                            <Plus size={14}/> Add New
                        </Link>
                    )}
                </div>

                {myOffers.length === 0 ? (
                    <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center py-20">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <Settings size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No active listings</h3>
                        <p className="text-gray-500 mt-2 font-medium">This user hasn't posted any projects yet.</p>
                        <Link href="/upload" className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
                        Create First Listing
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myOffers.map((offer) => (
                            <div key={offer.id} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                                <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                                    {offer.image_urls && offer.image_urls[0] ? (
                                        <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400"><Package size={20}/></div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-900">{offer.title}</h4>
                                    <p className="text-sm font-medium text-blue-600">{formatPrice(offer.price)}</p>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] uppercase font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{offer.category}</span>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${offer.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {offer.stock > 0 ? `Stock: ${offer.stock}` : 'Sold Out'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link href={`/offer/${offer.id}`} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="View">
                                        <Eye size={18} />
                                    </Link>
                                    <Link href={`/edit/${offer.id}`} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition" title="Edit">
                                        <Edit size={18} />
                                    </Link>
                                    <button onClick={() => handleDeleteOffer(offer.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>

          </div>

        </div>
      </div>
    </main>
  );
}

function DashboardCard({ icon, title, subtitle, href, badge }: any) {
  const Content = (
    <>
      <div className="relative w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        {icon}
        {badge && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-300">
            {badge}
          </div>
        )}
      </div>
      <div>
        <h4 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{title}</h4>
        <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
      </div>
      <ChevronRight className="ml-auto text-gray-300 group-hover:text-blue-400 transition-colors" size={18} />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left group">
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