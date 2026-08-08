'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Package, ShoppingBag, MessageSquare,
  CreditCard, LifeBuoy, LogOut, ChevronRight, Shield, Loader2,
  Menu, X, Flag
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/offers', label: 'Listings', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/chats', label: 'Conversations', icon: MessageSquare },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, roles')
        .eq('id', user.id)
        .single();

      if (!profile?.roles?.includes('admin')) {
        router.push('/');
        return;
      }

      setAdmin({ ...profile, email: user.email });
      setLoading(false);
    };
    checkAdmin();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ background: '#070c18' }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <div style={{ background: '#070c18', fontFamily: "'Inter', sans-serif" }} className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        style={{ background: '#0d1528', borderRight: '1px solid rgba(56, 97, 175, 0.2)', width: '260px' }}
        className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div style={{ borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }} className="px-6 py-5 flex items-center gap-3">
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <p style={{ color: '#f1f5f9' }} className="font-black text-sm tracking-tight">Printsi</p>
            <p style={{ color: '#3b82f6', fontSize: '10px' }} className="font-black uppercase tracking-widest">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ color: '#64748b' }}
            className="ml-auto lg:hidden hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: active ? '#93c5fd' : '#64748b',
                  borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:bg-white/5 hover:text-slate-300 group"
              >
                <item.icon size={18} className={active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'} />
                {item.label}
                {active && <ChevronRight size={14} className="ml-auto text-blue-400 opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Admin User Info */}
        <div style={{ borderTop: '1px solid rgba(56, 97, 175, 0.15)' }} className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59, 130, 246, 0.3)' }} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {admin?.avatar_url
                ? <img src={admin.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span style={{ color: '#93c5fd' }} className="text-xs font-black">{admin?.full_name?.[0] || 'A'}</span>
              }
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ color: '#e2e8f0' }} className="text-xs font-black truncate">{admin?.full_name || 'Admin'}</p>
              <p style={{ fontSize: '10px', color: '#3b82f6' }} className="font-black uppercase tracking-widest">Administrator</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}
              className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-center hover:text-slate-300 transition"
            >
              ← Site
            </Link>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              className="flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-red-500/20 transition"
            >
              <LogOut size={11} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-[260px] min-h-screen flex flex-col">
        {/* Top bar (mobile) */}
        <div
          style={{ background: '#0d1528', borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }}
          className="lg:hidden flex items-center gap-4 px-4 py-3 sticky top-0 z-20"
        >
          <button onClick={() => setSidebarOpen(true)} style={{ color: '#64748b' }} className="hover:text-white transition">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <span style={{ color: '#93c5fd' }} className="font-black text-sm">Admin Panel</span>
          </div>
        </div>

        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
