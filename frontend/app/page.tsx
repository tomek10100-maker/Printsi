'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Globe, Zap, Shield, Users, ChevronRight, User, UploadCloud, ShoppingBag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [themeHovered, setThemeHovered] = useState(false);
  const [uploadHovered, setUploadHovered] = useState(false);
  const [cartHovered, setCartHovered] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({
    printers: 0,
    designers: 0,
    customers: 0,
    orders: 0,
    offers: 0
  });
  const { theme } = useTheme();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('is_read', false);
          setUnreadCount(count || 0);

          const { data: profile } = await supabase.from('profiles').select('roles').eq('id', session.user.id).single();
          if (profile?.roles) {
            setUserRoles(profile.roles);
            if (profile.roles.length === 0) router.push('/onboarding');
          } else {
            router.push('/onboarding');
          }
        }
      } catch (_) {}
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setUnreadCount(0);
        setUserRoles([]);
      } else {
        checkUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (showStats) {
      const fetchStats = async () => {
        try {
          const { count: printers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).contains('roles', ['printer']);
          const { count: designers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).contains('roles', ['designer']);
          const { count: customers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).contains('roles', ['customer']);
          const { count: ordersCount } = await supabase.from('order_items').select('*', { count: 'exact', head: true });
          const { count: offersCount } = await supabase.from('offers').select('*', { count: 'exact', head: true }).or('is_custom.eq.false,is_custom.is.null');

          setStats({
            printers: printers || 0,
            designers: designers || 0,
            customers: customers || 0,
            orders: ordersCount || 0,
            offers: offersCount || 0
          });
        } catch (err) {
          console.error("Stats fetch error:", err);
        }
      };
      fetchStats();
    }
  }, [showStats]);

  const bricks = [
    { title: 'Physical Items', link: '/gallery?category=physical', angle: 0, status: 'active' },
    { title: '3D Files', link: '/gallery?category=digital', angle: 72, status: 'active' },
    { title: 'Shop', link: '#', angle: 144, status: 'soon' },
    { title: 'Partnership', link: '#', angle: 216, status: 'soon' },
    { title: 'Print on Demand', link: '/gallery?category=job', angle: 288, status: 'active' },
  ];

  return (
    <main className="relative min-h-screen w-full bg-white font-sans text-gray-900 overflow-hidden">
      {/* BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <img
          src={theme === 'white' ? '/background.jpg' : theme === 'black' ? '/dark.png' : '/midnight.png'}
          alt="3D Printer Background"
          className="h-full w-full object-cover transition-opacity duration-700 opacity-100"
        />
      </div>

      {/* STATS OVERLAY */}
      {showStats && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
           <style jsx global>{`
            .custom-scroll::-webkit-scrollbar { width: 6px; }
            .custom-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
            .custom-scroll::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #2563eb, #4f46e5); border-radius: 10px; }
            .custom-scroll::-webkit-scrollbar-thumb:hover { background: #1d4ed8; }
          `}</style>
          <div className="bg-white rounded-[32px] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_40px_100px_rgba(0,0,0,0.6)] border border-gray-100 animate-in zoom-in-95 duration-500 relative custom-scroll pb-16">
            <button onClick={() => setShowStats(false)} className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-900 rounded-full hover:bg-gray-900 hover:text-white transition-all font-bold text-xl z-20">×</button>
            <div className="text-center mb-8">
               <h2 className="text-4xl font-black uppercase tracking-tighter text-gray-900 leading-tight mb-1">Live <span className="text-blue-600">Growth.</span></h2>
               <p className="text-gray-400 font-bold uppercase text-[9px] tracking-[0.4em]">Printsi Community Tracker</p>
            </div>
            <div className="space-y-6">
               <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-[1px] bg-gray-200 flex-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Community Hub</span>
                    <div className="h-[1px] bg-gray-200 flex-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <StatCard icon={<Zap size={22} />} label="Printed" value={stats.printers} color="blue" />
                    <StatCard icon={<Globe size={22} />} label="CAD Makers" value={stats.designers} color="indigo" />
                    <StatCard icon={<Users size={22} />} label="Customers" value={stats.customers} color="green" />
                  </div>
               </div>
               <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-[1px] bg-gray-200 flex-1" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-3 py-1 rounded-full">Market Activity</span>
                    <div className="h-[1px] bg-gray-200 flex-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <StatCard icon={<ShoppingBag size={22} />} label="Total Orders" value={stats.orders} color="orange" />
                    <StatCard icon={<UploadCloud size={22} />} label="Active Offers" value={stats.offers} color="purple" />
                  </div>
               </div>
            </div>
            <div className="mt-10 pt-6 border-t border-gray-100 text-center">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Global Growth Tracker • {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <div className="relative z-50 px-6 py-6 md:px-12">
        <nav className="mx-auto w-full max-w-7xl flex items-center justify-between bg-white/80 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-14">
            <Link href="/"><img src="/logo.jpg" alt="Printis Logo" className="h-10 w-auto rounded-xl object-cover" /></Link>
            <div className="hidden lg:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-black text-gray-800">
              <button 
                onClick={() => setShowStats(true)} 
                className="hover:text-blue-600 transition-colors flex items-center gap-2 group"
              >
                Stats <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              </button>
              <Link href="/support" className="hover:text-blue-600 transition-colors">Support</Link>
              <Link href="/about" className="hover:text-blue-600 transition-colors">About Us</Link>
              <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link>
              <Link href="/how-it-works" className="hover:text-blue-600 transition-colors">How it Works</Link>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href={user ? "/upload" : "/login"}
              onMouseEnter={() => setUploadHovered(true)}
              onMouseLeave={() => setUploadHovered(false)}
              className={`group flex items-center h-10 bg-white rounded-full transition-all border border-gray-200 hover:border-gray-900 overflow-hidden px-2.5 shrink-0 ${uploadHovered ? 'w-32 bg-gray-900 shadow-xl' : 'w-11 shadow-sm'}`}
              style={{ transitionDuration: '2500ms', transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)' }}
            >
              <div className="flex items-center shrink-0">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <UploadCloud size={18} className={`transition-colors duration-500 ${uploadHovered ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-white ml-3 transition-opacity duration-[800ms] ${uploadHovered ? 'opacity-100' : 'opacity-0'} whitespace-nowrap`}>Upload</span>
              </div>
            </Link>

            <Link
              href={user ? "/cart" : "/login"}
              onMouseEnter={() => setCartHovered(true)}
              onMouseLeave={() => setCartHovered(false)}
              className={`group flex items-center h-10 bg-white rounded-full transition-all border border-gray-200 hover:border-gray-900 overflow-hidden px-2.5 shrink-0 ${cartHovered ? 'w-28 bg-gray-900 shadow-xl' : 'w-11 shadow-sm'}`}
              style={{ transitionDuration: '2500ms', transitionTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)' }}
            >
              <div className="flex items-center shrink-0">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} className={`transition-colors duration-500 ${cartHovered ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest text-white ml-3 transition-opacity duration-[800ms] ${cartHovered ? 'opacity-100' : 'opacity-0'} whitespace-nowrap`}>Cart</span>
              </div>
            </Link>

            <div onMouseEnter={() => setThemeHovered(true)} onMouseLeave={() => setThemeHovered(false)}><ThemeToggle isHoveredExternal={themeHovered} /></div>
            {user ? (
              <Link href="/profile" className="relative bg-blue-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2">
                <User size={16} /> Account
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">{unreadCount > 9 ? '!' : unreadCount}</span>}
              </Link>
            ) : (
              <Link href="/login" className="bg-gray-900 text-white px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg border border-gray-800">Sign In</Link>
            )}
          </div>
        </nav>
      </div>

      {/* PENTAGON MENU */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative w-[550px] h-[550px] flex items-center justify-center">
          {bricks.map((brick, idx) => {
            const radius = 230;
            const x = (radius * Math.sin((brick.angle * Math.PI) / 180)).toFixed(2);
            const y = (-radius * Math.cos((brick.angle * Math.PI) / 180)).toFixed(2);
            return (
              <div key={idx} className="absolute transition-all duration-700 ease-out" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <div className="group relative">
                  <Link href={brick.link} className={brick.status === 'soon' ? 'pointer-events-none' : ''}>
                    <div className={`w-44 h-24 flex flex-col items-center justify-center p-4 text-center rounded-2xl border-2 transition-all duration-500 shadow-xl backdrop-blur-xl ${brick.status === 'active' ? 'bg-white border-blue-100 hover:border-blue-600 hover:scale-110' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                      {brick.status === 'active' ? (
                        <>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-800 group-hover:text-blue-600 transition-colors uppercase">{brick.title}</span>
                          <div className="mt-2 h-1 w-8 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full" />
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-black uppercase tracking-widest leading-tight text-gray-500">{brick.title}</span>
                          <span className="mt-2 text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Soon</span>
                        </>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`mt-8 text-center backdrop-blur-md px-8 py-4 rounded-3xl border shadow-lg transition-colors duration-300 ${theme === 'white' ? 'bg-white/60 border-gray-100' : 'bg-gray-900/60 border-gray-800'}`}>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 uppercase">Future of <span className="text-blue-600">Creation.</span></h1>
        </div>
      </div>

      <footer className="relative z-10 py-10">
        <div className="max-w-7xl mx-auto px-12 flex justify-between items-center">
          <div className="flex gap-10 opacity-40">
            <FooterIcon icon={<Globe size={16} />} /><FooterIcon icon={<Zap size={16} />} /><FooterIcon icon={<Shield size={16} />} /><FooterIcon icon={<Users size={16} />} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">© 2026 Printis Ecosystem</p>
        </div>
      </footer>
    </main>
  );
}

function StatCard({ icon, label, value, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50/50 text-blue-600 border-blue-100/50 hover:bg-blue-50 hover:border-blue-200',
    indigo: 'bg-indigo-50/50 text-indigo-600 border-indigo-100/50 hover:bg-indigo-50 hover:border-indigo-200',
    green: 'bg-green-50/50 text-green-600 border-green-100/50 hover:bg-green-50 hover:border-green-200',
    orange: 'bg-orange-50/50 text-orange-600 border-orange-100/50 hover:bg-orange-50 hover:border-orange-200',
    purple: 'bg-purple-50/50 text-purple-600 border-purple-100/50 hover:bg-purple-50 hover:border-purple-200'
  };

  return (
    <div className={`p-6 md:p-10 rounded-[32px] border-2 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 flex flex-col items-center text-center ${colors[color] || colors.blue}`}>
       <div className="p-4 bg-white rounded-2xl shadow-sm border border-white/50 mb-6">{icon}</div>
       <span className="text-xl font-black uppercase tracking-[0.3em] opacity-60 mb-3">{label}</span>
       <div className="text-6xl font-black tracking-tighter">{value.toLocaleString()}</div>
    </div>
  );
}

function FooterIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">
      {icon}
    </div>
  );
}