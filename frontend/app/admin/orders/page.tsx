'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Search, Loader2 } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STATUS_COLORS: any = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  accepted: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  shipped: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  delivered: { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
  completed: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  cancelled: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  cancellation_requested: { bg: 'rgba(239,68,68,0.1)', text: '#fca5a5' },
  disputed: { bg: 'rgba(239,68,68,0.25)', text: '#f87171' },
  transfer_completed: { bg: 'rgba(16,185,129,0.2)', text: '#6ee7b7' },
};

function Avatar({ user }: { user: any }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59,130,246,0.3)', width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}
      className="flex items-center justify-center">
      {user?.avatar_url
        ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        : <span style={{ color: '#93c5fd', fontSize: '10px' }} className="font-black">{user?.full_name?.[0] || '?'}</span>
      }
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchOrders = async () => {
      const token = await getAdminToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setOrders(data.orders || []);
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const fmt = (n: number) => `€${Number(n).toFixed(2)}`;

  // Collect all unique statuses from items
  const allStatuses = Array.from(new Set(orders.flatMap(o => (o.items || []).map((i: any) => i.status)).filter(Boolean)));

  const filtered = orders.filter(o => {
    const buyerName = (o as any).profiles?.full_name?.toLowerCase() || '';
    const matchSearch = !search || buyerName.includes(search.toLowerCase()) || o.id.includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (o.items || []).some((i: any) => i.status === filterStatus);
    return matchSearch && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
          <ShoppingBag size={22} className="text-green-400" /> Orders
        </h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{orders.length} total orders on platform</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} style={{ color: '#475569' }} className="absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by buyer name or order ID..."
            style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
            className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition placeholder-slate-600"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
          className="px-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition"
        >
          <option value="all">All statuses</option>
          {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((order) => {
          const buyer = (order as any).profiles;
          const isBalance = order.stripe_payment_intent_id?.startsWith('balance_');
          return (
            <div key={order.id} style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 20 }} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar user={buyer} />
                  <div>
                    <p style={{ color: '#e2e8f0' }} className="font-black text-sm">{buyer?.full_name || 'Unknown Buyer'}</p>
                    <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{buyer?.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p style={{ color: '#34d399' }} className="font-black text-lg">{fmt(order.total_amount)}</p>
                  <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <span style={{ background: isBalance ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: isBalance ? '#a78bfa' : '#60a5fa', fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">
                  {isBalance ? 'Wallet' : 'Stripe'}
                </span>
                <span style={{ color: '#334155', fontSize: '10px' }} className="font-mono">{order.id.slice(0, 8)}...</span>
              </div>

              {(order.items || []).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} className="pt-3 space-y-2">
                  {order.items.map((item: any) => {
                    const sc = STATUS_COLORS[item.status] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.text, flexShrink: 0 }} />
                          <p style={{ color: '#94a3b8', fontSize: '12px' }} className="font-bold">
                            Seller: <span style={{ color: '#cbd5e1' }}>{item.profiles?.full_name || '—'}</span>
                            <span style={{ color: '#475569' }}> · {item.quantity || 1}× · {fmt(item.price_at_purchase)}</span>
                          </p>
                        </div>
                        <span style={{ background: sc.bg, color: sc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">{item.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ color: '#334155' }} className="text-center py-16 font-bold">No orders found</div>
        )}
      </div>
    </div>
  );
}
