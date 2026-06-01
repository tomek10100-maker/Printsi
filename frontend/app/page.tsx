'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Globe, Zap, Shield, Users, ChevronRight, User, UploadCloud, ShoppingBag, MessageSquare } from 'lucide-react';
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
  const [chatHovered, setChatHovered] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
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

          const { count: unreadMsgsCount } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', session.user.id);
          setUnreadMessages(unreadMsgsCount || 0);

          const { data: profile } = await supabase.from('profiles').select('roles').eq('id', session.user.id).single();
          if (profile?.roles) {
            setUserRoles(profile.roles);
            if (profile.roles.length === 0) router.push('/onboarding');
          } else {
            router.push('/onboarding');
          }
        }
      } catch (_) { }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setUnreadCount(0);
        setUnreadMessages(0);
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
    { title: '3D Items', link: '/gallery?category=physical', angle: 0, status: 'active' },
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500"
          onClick={() => setShowStats(false)}
        >
          <style jsx global>{`
            .custom-scroll::-webkit-scrollbar { width: 6px; }
            .custom-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.05); border-radius: 10px; }
            .custom-scroll::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #2563eb, #4f46e5); border-radius: 10px; }
            .custom-scroll::-webkit-scrollbar-thumb:hover { background: #1d4ed8; }
          `}</style>
          <div
            className="bg-white rounded-[32px] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_40px_100px_rgba(0,0,0,0.6)] border border-gray-100 animate-in zoom-in-95 duration-500 relative custom-scroll pb-16"
            onClick={(e) => e.stopPropagation()}
          >
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
      <div className="relative z-50 px-4 md:px-6 py-4 md:py-6 lg:px-12">
        <nav className="mx-auto w-full max-w-7xl flex items-center justify-between bg-white/80 backdrop-blur-xl px-4 md:px-8 py-3 md:py-4 rounded-[24px] md:rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-4 md:gap-8 lg:gap-12 shrink-0">
            <Link href="/" className="shrink-0">
              <img src="/logo.jpg" alt="Printis Logo" className="h-8 md:h-10 w-auto rounded-xl object-cover" />
            </Link>

            <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-[11px] uppercase tracking-[0.2em] font-black text-gray-800">
              <button
                onClick={() => setShowStats(true)}
                className="group flex flex-col items-center gap-1 cursor-pointer transition-colors hover:text-blue-600"
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  Stats <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                </span>
                <div className="h-0.5 w-6 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
              </button>

              <Link href="/support" className="group flex flex-col items-center gap-1 hover:text-blue-600 transition-colors">
                <span className="whitespace-nowrap">Support</span>
                <div className="h-0.5 w-6 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
              </Link>

              <Link href="/about" className="group flex flex-col items-center gap-1 hover:text-blue-600 transition-colors">
                <span className="whitespace-nowrap">About Us</span>
                <div className="h-0.5 w-6 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
              </Link>

              <Link href="/faq" className="group flex flex-col items-center gap-1 hover:text-blue-600 transition-colors">
                <span className="whitespace-nowrap">FAQ</span>
                <div className="h-0.5 w-6 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
              </Link>

              <Link href="/how-it-works" className="group flex flex-col items-center gap-1 hover:text-blue-600 transition-colors">
                <span className="whitespace-nowrap">How it Works</span>
                <div className="h-0.5 w-6 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full" />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 lg:gap-5 shrink-0">
            <Link
              href={user ? "/upload" : "/login"}
              onMouseEnter={() => setUploadHovered(true)}
              onMouseLeave={() => setUploadHovered(false)}
              className={`group flex items-center h-10 rounded-full border overflow-hidden px-2.5 shrink-0 shadow-sm border-gray-200`}
              style={{
                width: uploadHovered ? '124px' : '44px',
                backgroundColor: uploadHovered ? '#15306c' : '#ffffff',
                borderColor: uploadHovered ? '#15306c' : '#e5e7eb',
                transition: 'width 400ms cubic-bezier(0.25, 1, 0.5, 1), background-color 400ms ease, border-color 400ms ease'
              }}
            >
              <div className="flex items-center shrink-0">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <UploadCloud size={18} className={`transition-colors duration-400 ${uploadHovered ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div
                  className={`overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.25, 1, 0.5, 1)] ${uploadHovered ? 'opacity-100 ml-3' : 'opacity-0 ml-0'}`}
                  style={{ maxWidth: uploadHovered ? '80px' : '0px' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">Upload</span>
                </div>
              </div>
            </Link>

            <Link
              href={user ? "/profile/messages" : "/login"}
              onMouseEnter={() => setChatHovered(true)}
              onMouseLeave={() => setChatHovered(false)}
              className={`group flex items-center h-10 rounded-full border overflow-hidden px-2.5 shrink-0 shadow-sm border-gray-200 relative`}
              style={{
                width: chatHovered ? '112px' : '44px',
                backgroundColor: chatHovered ? '#15306c' : '#ffffff',
                borderColor: chatHovered ? '#15306c' : '#e5e7eb',
                transition: 'width 400ms cubic-bezier(0.25, 1, 0.5, 1), background-color 400ms ease, border-color 400ms ease'
              }}
            >
              <div className="flex items-center shrink-0">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} className={`transition-colors duration-400 ${chatHovered ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div
                  className={`overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.25, 1, 0.5, 1)] ${chatHovered ? 'opacity-100 ml-3' : 'opacity-0 ml-0'}`}
                  style={{ maxWidth: chatHovered ? '80px' : '0px' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">Chats</span>
                </div>
              </div>
              {unreadMessages > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[7px] font-black text-white animate-pulse">
                  {unreadMessages > 9 ? '!' : unreadMessages}
                </span>
              )}
            </Link>

            <Link
              href={user ? "/cart" : "/login"}
              onMouseEnter={() => setCartHovered(true)}
              onMouseLeave={() => setCartHovered(false)}
              className={`group flex items-center h-10 rounded-full border overflow-hidden px-2.5 shrink-0 shadow-sm border-gray-200`}
              style={{
                width: cartHovered ? '108px' : '44px',
                backgroundColor: cartHovered ? '#15306c' : '#ffffff',
                borderColor: cartHovered ? '#15306c' : '#e5e7eb',
                transition: 'width 400ms cubic-bezier(0.25, 1, 0.5, 1), background-color 400ms ease, border-color 400ms ease'
              }}
            >
              <div className="flex items-center shrink-0">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} className={`transition-colors duration-400 ${cartHovered ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div
                  className={`overflow-hidden transition-all duration-[400ms] ease-[cubic-bezier(0.25, 1, 0.5, 1)] ${cartHovered ? 'opacity-100 ml-3' : 'opacity-0 ml-0'}`}
                  style={{ maxWidth: cartHovered ? '80px' : '0px' }}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-white whitespace-nowrap">Cart</span>
                </div>
              </div>
            </Link>

            <div className="hidden sm:block" onMouseEnter={() => setThemeHovered(true)} onMouseLeave={() => setThemeHovered(false)}><ThemeToggle isHoveredExternal={themeHovered} /></div>
            {user ? (
              <Link href="/profile" className="relative bg-blue-600 text-white px-4 md:px-8 py-2 md:py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2">
                <User size={14} className="md:w-4 md:h-4" /> <span className="hidden md:inline">Account</span>
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">{unreadCount > 9 ? '!' : unreadCount}</span>}
              </Link>
            ) : (
              <Link href="/login" className="bg-gray-900 text-white px-5 md:px-10 py-2.5 md:py-3 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg border border-gray-800">Sign In</Link>
            )}
          </div>
        </nav>
      </div>

      {/* MOBILE MENU (Flex Column) */}
      <div className="relative z-10 flex flex-col md:hidden items-center justify-center min-h-[60vh] gap-3 w-full px-6 py-6 mt-4">
        {bricks.map((brick, idx) => (
          <div key={`mob-${idx}`} className="w-full max-w-[280px]">
            <Link href={brick.link} className={brick.status === 'soon' ? 'pointer-events-none' : ''}>
              <div className={`w-full h-16 flex items-center justify-between px-6 rounded-2xl border-2 transition-all shadow-lg backdrop-blur-xl ${brick.status === 'active' ? 'bg-white/90 border-blue-100 active:scale-95' : 'bg-gray-50/90 border-gray-100 opacity-70'}`}>
                <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] ${brick.status === 'active' ? 'text-gray-800' : 'text-gray-500'}`}>{brick.title}</span>
                {brick.status === 'soon' ? (
                  <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Soon</span>
                ) : (
                  <ChevronRight size={16} className="text-blue-500 opacity-50" />
                )}
              </div>
            </Link>
          </div>
        ))}
        <div className={`mt-6 w-full max-w-[280px] text-center backdrop-blur-md px-6 py-4 rounded-[24px] border shadow-lg transition-colors duration-300 ${theme === 'white' ? 'bg-white/60 border-gray-100' : 'bg-gray-900/60 border-gray-800'}`}>
          <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 uppercase">Future of <span className="text-blue-600">Creation.</span></h1>
        </div>
        <div className="mt-4 flex items-center justify-center">
          <ThemeToggle />
        </div>
      </div>

      {/* DESKTOP PENTAGON MENU */}
      <div className="relative z-10 hidden md:flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative w-[550px] h-[550px] flex items-center justify-center">
          {bricks.map((brick, idx) => {
            const radius = 230;
            const x = (radius * Math.sin((brick.angle * Math.PI) / 180)).toFixed(2);
            const y = (-radius * Math.cos((brick.angle * Math.PI) / 180)).toFixed(2);
            return (
              <div key={idx} className="absolute transition-all duration-700 ease-out" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <div className="group relative">
                  {/* SYMMETRICAL ANIMATED BORDER (from bottom-center to top-center) */}
                  {brick.status === 'active' && (
                    <svg className="absolute -inset-[2px] w-[calc(100%+4px)] h-[calc(100%+4px)] pointer-events-none z-20 overflow-visible">
                      {/* RIGHT HALF PATH */}
                      <path
                        d="M 88 98 L 160 98 Q 176 98 176 82 L 176 16 Q 176 0 160 0 L 88 0"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        className="transition-all duration-700 ease-in-out opacity-0 group-hover:opacity-100 group-hover:[stroke-dashoffset:0]"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(37, 99, 235, 0.4))' }}
                      />
                      {/* LEFT HALF PATH */}
                      <path
                        d="M 88 98 L 16 98 Q 0 98 0 82 L 0 16 Q 0 0 16 0 L 88 0"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeDasharray="300"
                        strokeDashoffset="300"
                        className="transition-all duration-700 ease-in-out opacity-0 group-hover:opacity-100 group-hover:[stroke-dashoffset:0]"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(37, 99, 235, 0.4))' }}
                      />
                    </svg>
                  )}

                  <Link href={brick.link} className={brick.status === 'soon' ? 'pointer-events-none' : ''}>
                    <div className={`w-44 h-24 flex flex-col items-center justify-center p-4 text-center rounded-2xl border-2 transition-all duration-500 shadow-xl backdrop-blur-xl ${brick.status === 'active' ? 'bg-white border-blue-100 group-hover:border-transparent group-hover:scale-110' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                      {brick.status === 'active' ? (
                        <>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-800 group-hover:text-blue-600 transition-colors uppercase">{brick.title}</span>
                          {/* Underline removed as requested */}
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
