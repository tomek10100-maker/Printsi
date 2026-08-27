'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  Users, Package, ShoppingBag, CreditCard, Clock, TrendingUp,
  ArrowUpRight, MessageSquare, AlertCircle, Loader2
} from 'lucide-react';
import { getAdminToken } from '../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function StatCard({ label, value, icon: Icon, color, href, sublabel }: any) {
  const colorMap: any = {
    blue: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
    purple: { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
    green: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.25)' },
    orange: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
    red: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.25)' },
    teal: { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf', border: 'rgba(20,184,166,0.25)' },
  };
  const c = colorMap[color] || colorMap.blue;

  const card = (
    <div
      style={{ background: '#111d36', border: `1px solid ${c.border}`, transition: 'transform 0.2s, box-shadow 0.2s' }}
      className="p-6 rounded-2xl flex flex-col gap-4 hover:scale-[1.02] hover:shadow-2xl cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div style={{ background: c.bg, color: c.text, borderRadius: '12px' }} className="w-12 h-12 flex items-center justify-center">
          <Icon size={22} />
        </div>
        <ArrowUpRight size={16} style={{ color: '#334155' }} className="group-hover:text-blue-400 transition" />
      </div>
      <div>
        <p style={{ color: '#64748b', fontSize: '11px' }} className="font-black uppercase tracking-widest mb-1">{label}</p>
        <p style={{ color: '#f1f5f9' }} className="text-3xl font-black tracking-tight">{value}</p>
        {sublabel && <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold mt-1">{sublabel}</p>}
      </div>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

function Avatar({ user }: { user: any }) {
  return (
    <div
      style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59,130,246,0.3)', width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}
      className="flex items-center justify-center"
    >
      {user?.avatar_url
        ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        : <span style={{ color: '#93c5fd', fontSize: '11px' }} className="font-black">{user?.full_name?.[0] || '?'}</span>
      }
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: any = {
    admin: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    printer: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
    designer: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
    customer: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    hobbyist: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
    business: { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
  };
  const c = colors[role] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">
      {role}
    </span>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const token = await getAdminToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, []);

  const fmt = (n: number) => `€${n.toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-1">Platform overview — all data in real time</p>
      </div>

      {/* Furgonetka OAuth Re-authorization Action Banner */}
      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xl shrink-0">
            🚚
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-100 uppercase tracking-wider">Furgonetka.pl Courier OAuth Connection</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Click to re-authorize carrier API connection whenever shipping label generation requires OAuth refresh.</p>
          </div>
        </div>
        <a
          href="/api/furgonetka/auth?secret=ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition-all shrink-0 cursor-pointer"
        >
          🔗 Re-Authorize Furgonetka
        </a>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={stats?.totalUsers?.toLocaleString()} icon={Users} color="blue" href="/admin/users" />
        <StatCard label="Active Listings" value={stats?.totalOffers?.toLocaleString()} icon={Package} color="purple" href="/admin/offers" />
        <StatCard label="Total Orders" value={stats?.totalOrders?.toLocaleString()} icon={ShoppingBag} color="green" href="/admin/orders" />
        <StatCard label="Total Revenue" value={fmt(stats?.totalRevenue || 0)} icon={TrendingUp} color="teal" href="/admin/payments" />
        <StatCard
          label="Pending Payouts"
          value={stats?.pendingPayouts?.toLocaleString()}
          icon={Clock}
          color={stats?.pendingPayouts > 0 ? 'orange' : 'blue'}
          href="/admin/payments"
          sublabel={stats?.pendingPayouts > 0 ? `${fmt(stats?.pendingPayoutsTotal || 0)} awaiting` : 'None pending'}
        />
        <StatCard label="Conversations" value="View All" icon={MessageSquare} color="purple" href="/admin/chats" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ color: '#e2e8f0' }} className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <ShoppingBag size={15} className="text-blue-400" /> Recent Orders
            </h2>
            <Link href="/admin/orders" style={{ color: '#3b82f6', fontSize: '11px' }} className="font-black uppercase tracking-widest hover:text-blue-300">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {(stats?.recentOrders || []).slice(0, 7).map((order: any) => (
              <div key={order.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} className="flex items-center justify-between px-4 py-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <Avatar user={(order as any).profiles} />
                  <div>
                    <p style={{ color: '#cbd5e1', fontSize: '12px' }} className="font-black">{(order as any).profiles?.full_name || 'Unknown'}</p>
                    <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <p style={{ color: '#34d399' }} className="font-black text-sm">{fmt(order.total_amount)}</p>
              </div>
            ))}
            {(!stats?.recentOrders || stats.recentOrders.length === 0) && (
              <p style={{ color: '#334155' }} className="text-center py-8 text-sm font-bold">No orders yet</p>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ color: '#e2e8f0' }} className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
              <Users size={15} className="text-purple-400" /> New Users
            </h2>
            <Link href="/admin/users" style={{ color: '#8b5cf6', fontSize: '11px' }} className="font-black uppercase tracking-widest hover:text-purple-300">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {(stats?.recentUsers || []).map((user: any) => (
              <div key={user.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} className="flex items-center gap-3 px-4 py-3 rounded-xl">
                <Avatar user={user} />
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#cbd5e1', fontSize: '12px' }} className="font-black truncate">{user.full_name || 'Unknown'}</p>
                  <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold truncate">{user.email}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {(user.roles || []).map((r: string) => <RoleBadge key={r} role={r} />)}
                </div>
              </div>
            ))}
            {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
              <p style={{ color: '#334155' }} className="text-center py-8 text-sm font-bold">No users yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Pending payouts alert */}
      {stats?.pendingPayouts > 0 && (
        <Link href="/admin/payments">
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }} className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer hover:bg-amber-500/15 transition">
            <AlertCircle size={18} />
            <p className="font-black text-sm">
              {stats.pendingPayouts} payout request{stats.pendingPayouts > 1 ? 's' : ''} pending — total {fmt(stats.pendingPayoutsTotal)}
            </p>
            <ArrowUpRight size={16} className="ml-auto" />
          </div>
        </Link>
      )}
    </div>
  );
}
