'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CreditCard, Loader2, Check, X, Clock, Filter } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STATUS_COLORS: any = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  completed: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  failed: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
};

function Avatar({ user }: { user: any }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59,130,246,0.3)', width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}
      className="flex items-center justify-center">
      {user?.avatar_url
        ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        : <span style={{ color: '#93c5fd', fontSize: '12px' }} className="font-black">{user?.full_name?.[0] || '?'}</span>
      }
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPayouts = async () => {
    const adminToken = await getAdminToken();
    if (!adminToken) { setLoading(false); return; }
    setToken(adminToken);
    const res = await fetch('/api/admin/payouts', { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await res.json();
    setPayouts(data.payouts || []);
    setLoading(false);
  };

  useEffect(() => { fetchPayouts(); }, []);

  const handlePayout = async (payoutId: string, action: 'approve' | 'reject') => {
    setProcessing(payoutId);
    await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ payoutId, action }),
    });
    await fetchPayouts();
    setProcessing(null);
  };

  const fmt = (n: number) => {
    const abs = Math.abs(Number(n));
    const isTopup = Number(n) < 0;
    return `${isTopup ? '+' : '-'}€${abs.toFixed(2)}`;
  };

  const fmtAbs = (n: number) => `€${Math.abs(Number(n)).toFixed(2)}`;

  const pending = payouts.filter(p => p.status === 'pending' && Number(p.amount) > 0);
  const displayed = tab === 'pending' ? pending : payouts;

  const pendingTotal = pending.reduce((acc, p) => acc + Number(p.amount), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
          <CreditCard size={22} className="text-teal-400" /> Payments & Payouts
        </h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{payouts.length} total payout records</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{ background: pending.length > 0 ? 'rgba(245,158,11,0.1)' : '#111d36', border: `1px solid ${pending.length > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(56,97,175,0.2)'}`, borderRadius: 20 }} className="p-5">
          <p style={{ color: '#94a3b8', fontSize: '10px' }} className="font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Clock size={12} /> Pending Payouts</p>
          <p style={{ color: pending.length > 0 ? '#fbbf24' : '#f1f5f9' }} className="text-3xl font-black">{pending.length}</p>
          {pending.length > 0 && <p style={{ color: '#f59e0b', fontSize: '12px' }} className="font-black mt-1">Total: €{pendingTotal.toFixed(2)}</p>}
        </div>
        <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 20 }} className="p-5">
          <p style={{ color: '#94a3b8', fontSize: '10px' }} className="font-black uppercase tracking-widest mb-2">All Records</p>
          <p style={{ color: '#f1f5f9' }} className="text-3xl font-black">{payouts.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 14 }} className="flex p-1 gap-1 w-fit">
        {(['pending', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: tab === t ? '#60a5fa' : '#64748b',
              borderRadius: 10,
            }}
            className="px-5 py-2 text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2"
          >
            {t === 'pending' && pending.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#000', width: 18, height: 18, borderRadius: '50%', fontSize: '9px' }} className="flex items-center justify-center font-black">{pending.length}</span>
            )}
            {t === 'pending' ? 'Pending Requests' : 'All Records'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }}>
                {['User', 'Amount', 'Type', 'Bank / IBAN', 'Status', 'Date', tab === 'pending' ? 'Actions' : ''].filter(Boolean).map(h => (
                  <th key={h} style={{ color: '#475569', fontSize: '10px' }} className="px-4 py-4 text-left font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((payout, i) => {
                const sc = STATUS_COLORS[payout.status] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
                const isTopup = Number(payout.amount) < 0;
                const isWithdrawal = Number(payout.amount) > 0;
                return (
                  <tr key={payout.id} style={{ borderBottom: i < displayed.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar user={payout.profiles} />
                        <div className="min-w-0">
                          <p style={{ color: '#e2e8f0', fontSize: '12px' }} className="font-black truncate">{payout.profiles?.full_name || '—'}</p>
                          <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold truncate">{payout.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: isTopup ? '#34d399' : '#f87171', fontSize: '14px' }} className="font-black whitespace-nowrap">
                        {isTopup ? '+' : '-'}€{Math.abs(Number(payout.amount)).toFixed(2)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{
                        background: isTopup ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                        color: isTopup ? '#34d399' : '#fca5a5',
                        fontSize: '9px', padding: '2px 8px', borderRadius: 999
                      }} className="font-black uppercase tracking-widest">{isTopup ? 'Top-up / Credit' : 'Withdrawal'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {payout.profiles?.payout_iban ? (
                        <div>
                          <p style={{ color: '#94a3b8', fontSize: '11px' }} className="font-mono">{payout.profiles.payout_iban}</p>
                          <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{payout.profiles.payout_recipient_name}</p>
                        </div>
                      ) : (
                        <span style={{ color: '#334155', fontSize: '10px' }} className="font-bold">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ background: sc.bg, color: sc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">{payout.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold whitespace-nowrap">{new Date(payout.created_at).toLocaleDateString()}</p>
                    </td>
                    {tab === 'pending' && (
                      <td className="px-4 py-3">
                        {payout.status === 'pending' && isWithdrawal ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePayout(payout.id, 'approve')}
                              disabled={processing === payout.id}
                              style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8 }}
                              className="p-2 hover:bg-green-500/30 transition flex items-center gap-1 text-[10px] font-black uppercase"
                              title="Approve — mark as completed (you still need to manually send the SEPA transfer)"
                            >
                              {processing === payout.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve
                            </button>
                            <button
                              onClick={() => handlePayout(payout.id, 'reject')}
                              disabled={processing === payout.id}
                              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8 }}
                              className="p-2 hover:bg-red-500/25 transition flex items-center gap-1 text-[10px] font-black uppercase"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#334155', fontSize: '10px' }} className="font-bold">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={7} style={{ color: '#334155' }} className="text-center py-16 font-bold">No records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {tab === 'pending' && (
        <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold text-center">
          ⚠ Approving a payout only marks it as completed in the system. You still need to manually send the SEPA bank transfer to the user's IBAN.
        </p>
      )}
    </div>
  );
}
