'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Loader2, ShieldAlert, MessageSquare, ArrowRight, CheckCircle2, DollarSign, RefreshCw, XCircle } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

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

  // Dispute resolution modal state
  const [selectedDisputeItem, setSelectedDisputeItem] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveSuccess, setResolveSuccess] = useState<string | null>(null);

  const fetchOrders = async () => {
    const token = await getAdminToken();
    if (!token) { setLoading(false); return; }
    const res = await fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fmt = (n: number) => `€${Number(n).toFixed(2)}`;

  const handleResolveDispute = async (action: 'refund_buyer' | 'payout_seller') => {
    if (!selectedDisputeItem) return;
    setResolving(true);
    setResolveSuccess(null);

    try {
      const token = await getAdminToken();
      const res = await fetch('/api/admin/disputes/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          disputeId: selectedDisputeItem.dispute?.id,
          orderItemId: selectedDisputeItem.id,
          action,
          adminNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to resolve dispute');

      setResolveSuccess(data.message);
      await fetchOrders();
      setTimeout(() => {
        setSelectedDisputeItem(null);
        setResolveSuccess(null);
        setAdminNotes('');
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Resolution failed');
    } finally {
      setResolving(false);
    }
  };

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
          <ShoppingBag size={22} className="text-green-400" /> Orders & Dispute Resolution
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

              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span style={{ background: isBalance ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: isBalance ? '#a78bfa' : '#60a5fa', fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">
                    {isBalance ? 'Wallet' : 'Stripe'}
                  </span>
                  <span style={{ color: '#334155', fontSize: '10px' }} className="font-mono">{order.id.slice(0, 8)}...</span>
                </div>
              </div>

              {(order.items || []).length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} className="pt-3 space-y-3">
                  {order.items.map((item: any) => {
                    const sc = STATUS_COLORS[item.status] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
                    const isDisputed = item.status === 'disputed' || item.status === 'cancellation_requested' || !!item.dispute;

                    return (
                      <div key={item.id} className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.text, flexShrink: 0 }} />
                            <p style={{ color: '#94a3b8', fontSize: '12px' }} className="font-bold">
                              Seller: <span style={{ color: '#cbd5e1' }}>{item.profiles?.full_name || '—'}</span>
                              <span style={{ color: '#475569' }}> · {item.quantity || 1}× · {fmt(item.price_at_purchase)}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span style={{ background: sc.bg, color: sc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">
                              {item.status}
                            </span>

                            {/* Direct Admin Open Chat Button */}
                            {item.chat_id && (
                              <Link
                                href={`/admin/chats/${item.chat_id}`}
                                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', fontSize: '10px' }}
                                className="px-2.5 py-1 rounded-lg font-black uppercase tracking-wider hover:bg-purple-500/25 transition flex items-center gap-1"
                              >
                                <MessageSquare size={11} /> Open Chat
                              </Link>
                            )}

                            {/* Resolve Dispute Button */}
                            {isDisputed && (
                              <button
                                onClick={() => setSelectedDisputeItem({ ...item, buyer, orderId: order.id })}
                                style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', fontSize: '10px' }}
                                className="px-3 py-1 rounded-lg font-black uppercase tracking-wider hover:bg-red-500/30 transition flex items-center gap-1 shadow-sm"
                              >
                                <ShieldAlert size={12} /> Resolve Dispute
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dispute details preview if available */}
                        {item.dispute && (
                          <div className="mt-1 p-2.5 bg-red-950/30 border border-red-500/20 rounded-lg text-xs text-red-300">
                            <p className="font-bold flex items-center gap-1.5 text-red-400">
                              <ShieldAlert size={13} /> Reported Problem: <span className="uppercase font-black text-red-200">{item.dispute.problem_type}</span>
                            </p>
                            <p className="text-[11px] text-slate-300 mt-1 italic leading-relaxed font-medium">"{item.dispute.description}"</p>
                            <p className="text-[10px] text-slate-400 mt-1">Contact Email: <span className="font-mono text-slate-200">{item.dispute.contact_email}</span></p>
                          </div>
                        )}
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

      {/* ── DISPUTE RESOLUTION MODAL ── */}
      {selectedDisputeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-red-400" size={24} />
                <h3 className="text-lg font-black uppercase tracking-wide">Resolve Dispute</h3>
              </div>
              <button
                onClick={() => setSelectedDisputeItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Dispute Order Summary</p>
              <div className="flex justify-between items-center text-slate-200 font-medium">
                <span>Buyer: <strong className="text-white font-bold">{selectedDisputeItem.buyer?.full_name}</strong></span>
                <span>Seller: <strong className="text-white font-bold">{selectedDisputeItem.profiles?.full_name}</strong></span>
              </div>
              <div className="flex justify-between items-center text-slate-200 font-medium pt-1 border-t border-slate-800/80">
                <span>Item Value (excl. shipping):</span>
                <span className="text-emerald-400 font-black text-sm">{fmt(selectedDisputeItem.price_at_purchase * selectedDisputeItem.quantity)}</span>
              </div>
            </div>

            {selectedDisputeItem.dispute && (
              <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-2xl text-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Claim Details</span>
                <p className="font-bold text-red-200 uppercase">{selectedDisputeItem.dispute.problem_type}</p>
                <p className="text-slate-300 italic">"{selectedDisputeItem.dispute.description}"</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Admin Resolution Notes / Official Statement</label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Explain the administration decision (will be sent as official notice in chat)..."
                rows={3}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {resolveSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} /> {resolveSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                disabled={resolving}
                onClick={() => handleResolveDispute('refund_buyer')}
                className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                Refund Buyer (Excl. Shipping)
              </button>

              <button
                disabled={resolving}
                onClick={() => handleResolveDispute('payout_seller')}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="animate-spin" size={16} /> : <DollarSign size={16} />}
                Pay Out to Seller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
