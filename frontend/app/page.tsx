'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Globe, Zap, Shield, Users, ChevronRight, User, UploadCloud, ShoppingBag } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 1. Sprawdź usera
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        checkNotifications(session.user.id);
      }
    };
    checkUser();

    // 2. Obsługa zmian sesji
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkNotifications(session.user.id);
      } else {
        setUnreadCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
          src="/background.jpg" 
          alt="3D Printer Background" 
          className="h-full w-full object-cover opacity-100" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/20" />
      </div>

      {/* NAVBAR */}
      <nav className="relative z-20 flex items-center justify-between px-12 py-8">
        <div className="flex items-center gap-14">
          <Link href="/">
             <img src="/logo.jpg" alt="Printsi Logo" className="h-9 w-auto" />
          </Link>
          
          <div className="hidden lg:flex items-center gap-10 text-[12px] uppercase tracking-[0.2em] font-black text-gray-800">
            <Link href="/support" className="hover:text-blue-600 transition-colors">Support</Link>
            <Link href="/about" className="hover:text-blue-600 transition-colors">About Us</Link>
            <Link href="/faq" className="hover:text-blue-600 transition-colors">FAQ</Link>
            <Link href="/how-it-works" className="hover:text-blue-600 transition-colors">How it Works</Link>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link 
            href={user ? "/upload" : "/login"} 
            className="hidden md:flex w-10 h-10 items-center justify-center bg-white/80 backdrop-blur rounded-full text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-white"
            title="Add New Listing"
          >
            <UploadCloud size={20} />
          </Link>

          <Link 
            href={user ? "/cart" : "/login"} 
            className="hidden md:flex w-10 h-10 items-center justify-center bg-white/80 backdrop-blur rounded-full text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-white"
            title="Your Cart"
          >
            <ShoppingBag size={20} />
          </Link>

          <div className="h-6 w-px bg-gray-400/30 mx-2 hidden md:block"></div>

          {user ? (
            <Link 
              href="/profile" 
              className="relative bg-blue-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl flex items-center gap-2 group"
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
              className="bg-gray-900 text-white px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-2xl"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>

      {/* PENTAGON MENU */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative w-[550px] h-[550px] flex items-center justify-center">
          {bricks.map((brick, idx) => {
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
                      bg-white/10 backdrop-blur-md border border-white/40 rounded-3xl
                      shadow-sm hover:shadow-2xl hover:bg-white/90 hover:border-blue-500
                      transition-all duration-300 transform hover:-translate-y-2
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
        
        <div className="mt-8 text-center bg-white/10 backdrop-blur-sm px-8 py-4 rounded-3xl border border-white/20">
          <h1 className="text-4xl font-black tracking-tighter text-gray-900 uppercase">
            Future of <span className="text-blue-600">Creation.</span>
          </h1>
        </div>

      </div>

      <footer className="relative z-10 py-10">
        <div className="max-w-7xl mx-auto px-12 flex justify-between items-center">
          <div className="flex gap-10 opacity-40">
            <FooterIcon icon={<Globe size={16}/>} />
            <FooterIcon icon={<Zap size={16}/>} />
            <FooterIcon icon={<Shield size={16}/>} />
            <FooterIcon icon={<Users size={16}/>} />
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