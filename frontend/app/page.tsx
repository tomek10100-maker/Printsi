'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Globe, Zap, Shield, Users, ChevronRight, User, UploadCloud, ShoppingBag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        checkNotifications(session.user.id);
        const profileData = await checkOnboarding(session.user);
        if (profileData && profileData.roles) {
          setUserRoles(profileData.roles);
        }
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkNotifications(session.user.id);
        checkOnboarding(session.user).then(profile => {
          if (profile && profile.roles) {
            setUserRoles(profile.roles);
          }
        });
      } else {
        setUnreadCount(0);
        setUserRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkOnboarding = async (authUser: any) => {
    // Only redirect if the account was created in the last 2 minutes
    const createdAt = new Date(authUser.created_at).getTime();
    const now = Date.now();
    const isNewAccount = (now - createdAt) < 2 * 60 * 1000;

    if (isNewAccount) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles')
        .eq('id', authUser.id)
        .single();

      if (isNewAccount) {
        if (!profile?.roles || profile.roles.length === 0) {
          router.push('/onboarding');
        }
      }

      return profile;
    }
  };

  const checkNotifications = async (userId: string) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (!error && count !== null) {
      setUnreadCount(count);
    }
  };

  const bricks = [
    { title: 'Physical Items', link: '/gallery?category=physical', angle: 0, status: 'active', reqRole: null },
    { title: '3D Files', link: '/gallery?category=digital', angle: 72, status: 'active', reqRole: null },
    { title: 'Shop', link: '#', angle: 144, status: 'soon', reqRole: null },
    { title: 'Partnership', link: '#', angle: 216, status: 'soon', reqRole: null },
    { title: 'Print on Demand', link: '/gallery?category=job', angle: 288, status: 'active', reqRole: 'printer' },
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

      {/* NAVBAR */}
      <div className="relative z-50 px-6 py-6 md:px-12">
        <nav className="mx-auto w-full max-w-7xl flex items-center justify-between bg-white/80 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center gap-14">
            <Link href="/">
              <img src="/logo.jpg" alt="Printsi Logo" className="h-10 w-auto rounded-xl object-cover" />
            </Link>

            <div className="hidden lg:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-black text-gray-800">
              <Link href="/support" className="hover:text-blue-600 transition-colors">Support</Link>
              <Link href="/about" className="hover:text-blue-600 transition-colors">About Us</Link>
              <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link>
              <Link href="/how-it-works" className="hover:text-blue-600 transition-colors">How it Works</Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={user ? "/upload" : "/login"}
              className="hidden md:flex w-10 h-10 items-center justify-center bg-gray-100 rounded-full text-gray-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-gray-200"
              title="Add New Listing"
            >
              <UploadCloud size={20} />
            </Link>

            <Link
              href={user ? "/cart" : "/login"}
              className="hidden md:flex w-10 h-10 items-center justify-center bg-gray-100 rounded-full text-gray-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-gray-200"
              title="Your Cart"
            >
              <ShoppingBag size={20} />
            </Link>

            <div className="h-6 w-px bg-gray-300 mx-1 hidden md:block"></div>

            {user ? (
              <Link
                href="/profile"
                className="relative bg-blue-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2"
              >
                <User size={16} /> Account
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse">
                    {unreadCount > 9 ? '!' : unreadCount}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                href="/login"
                className="bg-gray-900 text-white px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg border border-gray-800"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>

      {/* PENTAGON MENU */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative w-[550px] h-[550px] flex items-center justify-center">
          {bricks.map((brick, idx) => {

            // FILTROWANIE usunięte - teraz każdy widzi Print on Demand

            const radius = 230;
            const x = (radius * Math.sin((brick.angle * Math.PI) / 180)).toFixed(2);
            const y = (-radius * Math.cos((brick.angle * Math.PI) / 180)).toFixed(2);

            return (
              <div
                key={idx}
                className="absolute transition-all duration-700 ease-out"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <div className="group relative">
                  <Link href={brick.link} className={brick.status === 'soon' ? 'pointer-events-none' : ''}>
                    <div className={`
                      w-44 h-24 flex flex-col items-center justify-center p-4 text-center
                      rounded-3xl shadow-lg border
                      transition-all duration-300 transform hover:-translate-y-2
                      ${theme === 'white'
                        ? 'bg-white/80 backdrop-blur-md border-gray-100 hover:border-blue-500'
                        : 'bg-gray-900/80 backdrop-blur-md border-gray-800 hover:border-blue-500'}
                      ${brick.status === 'soon' ? 'cursor-default opacity-80' : 'cursor-pointer'}
                    `}>
                      {brick.status === 'active' ? (
                        <>
                          <span className="text-[11px] font-black uppercase tracking-widest leading-tight text-gray-900 group-hover:hidden transition-all">
                            {brick.title}
                          </span>
                          <span className="hidden group-hover:flex items-center gap-1 text-[12px] font-black uppercase tracking-widest text-blue-600 transition-all">
                            Explore <ChevronRight size={14} strokeWidth={3} />
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-black uppercase tracking-widest leading-tight text-gray-500">
                            {brick.title}
                          </span>
                          <span className="mt-2 text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            Soon
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className={`mt-8 text-center backdrop-blur-md px-8 py-4 rounded-3xl border shadow-lg transition-colors duration-300 ${theme === 'white' ? 'bg-white/60 border-gray-100' : 'bg-gray-900/60 border-gray-800'
          }`}>
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 uppercase">
            Future of <span className="text-blue-600">Creation.</span>
          </h1>
        </div>

      </div>

      <footer className="relative z-10 py-10">
        <div className="max-w-7xl mx-auto px-12 flex justify-between items-center">
          <div className="flex gap-10 opacity-40">
            <FooterIcon icon={<Globe size={16} />} />
            <FooterIcon icon={<Zap size={16} />} />
            <FooterIcon icon={<Shield size={16} />} />
            <FooterIcon icon={<Users size={16} />} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
            © 2026 Printis Ecosystem
          </p>
        </div>
      </footer>
    </main>
  );
}

function FooterIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="text-gray-900 hover:text-blue-600 transition-colors cursor-pointer">
      {icon}
    </div>
  );
}