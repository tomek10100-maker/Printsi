'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Search, Plus, Minus, Loader2, X, Check, ExternalLink } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function Avatar({ user }: { user: any }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59,130,246,0.3)', width: 36, height: 36, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}
      className="flex items-center justify-center">
      {user?.avatar_url
        ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        : <span style={{ color: '#93c5fd', fontSize: '12px' }} className="font-black">{user?.full_name?.[0] || '?'}</span>
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
    <span style={{ background: c.bg, color: c.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">
      {role}
    </span>
  );
}

function BalanceModal({ user, onClose, onDone, token }: any) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setLoading(true);
    const res = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: user.id, amount: Number(amount), action, note: note.trim() }),
    });
    const data = await res.json();
    if (data.success) {
      setResult(`Successfully ${action === 'add' ? 'added' : 'removed'} €${amount} ${action === 'add' ? 'to' : 'from'} ${user.full_name}'s balance.`);
      onDone();
    } else {
      setResult('Error: ' + data.error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.3)', borderRadius: 24, maxWidth: 440, width: '100%' }} className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ color: '#f1f5f9' }} className="font-black text-lg">Adjust Balance</h3>
          <button onClick={onClose} style={{ color: '#64748b' }} className="hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Avatar user={user} />
          <div>
            <p style={{ color: '#e2e8f0' }} className="font-black text-sm">{user.full_name}</p>
            <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold">{user.email}</p>
          </div>
          <div className="ml-auto text-right">
            <p style={{ color: '#64748b', fontSize: '10px' }} className="font-black uppercase">Current</p>
            <p style={{ color: '#34d399' }} className="font-black">€{(user.balance || 0).toFixed(2)}</p>
          </div>
        </div>

        {result ? (
          <div style={{ background: result.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: result.startsWith('Error') ? '#f87171' : '#34d399', border: `1px solid ${result.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }} className="p-4 rounded-xl text-sm font-bold mb-4">
            {result}
          </div>
        ) : (
          <>
            {/* Action toggle */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }} className="flex rounded-xl p-1 mb-5">
              {(['add', 'remove'] as const).map(act => (
                <button
                  key={act}
                  onClick={() => setAction(act)}
                  style={{
                    background: action === act ? (act === 'add' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)') : 'transparent',
                    color: action === act ? (act === 'add' ? '#34d399' : '#f87171') : '#64748b',
                    borderRadius: 10,
                  }}
                  className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition"
                >
                  {act === 'add' ? <Plus size={14} /> : <Minus size={14} />} {act} Funds
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <span style={{ color: '#64748b' }} className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg">€</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', borderRadius: 14 }}
                className="w-full pl-9 pr-4 py-3.5 font-black text-2xl outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Note / Reason Message Field */}
            <div className="mb-5">
              <label style={{ color: '#64748b', fontSize: '10px' }} className="font-black uppercase tracking-wider block mb-1.5">
                Note / Message (Optional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Refund for order #1234, dispute resolution, or bonus..."
                rows={2}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', borderRadius: 12 }}
                className="w-full p-3 font-medium text-xs outline-none focus:border-blue-500 transition placeholder-slate-600 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !amount}
              style={{
                background: action === 'add' ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)',
                color: '#fff',
                borderRadius: 14,
              }}
              className="w-full py-4 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : (action === 'add' ? <Plus size={16} /> : <Minus size={16} />)}
              {action === 'add' ? 'Add' : 'Remove'} €{amount || '0.00'} {action === 'add' ? 'to' : 'from'} Balance
            </button>
          </>
        )}

        <button onClick={onClose} style={{ color: '#64748b', fontSize: '11px' }} className="w-full mt-4 font-black uppercase tracking-widest hover:text-slate-300 transition">
          Close
        </button>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [token, setToken] = useState('');
  const [balanceUser, setBalanceUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchUsers = async () => {
    const adminToken = await getAdminToken();
    if (!adminToken) { setErrorMsg('No admin session token available'); setLoading(false); return; }
    setToken(adminToken);
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Server returned HTTP ${res.status}`);
      } else {
        setUsers(data.users || []);
        setErrorMsg(null);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Fetch error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const fmt = (n: number) => `€${n.toFixed(2)}`;

  const filtered = users.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }} className="p-4 rounded-2xl font-bold text-sm">
          ⚠️ API Error: {errorMsg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Users size={22} className="text-blue-400" /> Users
          </h1>
          <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{users.length} accounts registered</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} style={{ color: '#475569' }} className="absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
          className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition placeholder-slate-600"
        />
      </div>

      {/* Table */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }}>
                {['User', 'Email', 'Roles', 'Balance', 'Earned', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ color: '#475569', fontSize: '10px' }} className="px-4 py-4 text-left font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, i) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  className="hover:bg-white/[0.02] transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar user={user} />
                      <div>
                        <p style={{ color: '#e2e8f0', fontSize: '13px' }} className="font-black whitespace-nowrap">{user.full_name || '—'}</p>
                        <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{user.country || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: '#94a3b8', fontSize: '12px' }} className="font-bold">{user.email || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles || []).map((r: string) => <RoleBadge key={r} role={r} />)}
                      {(!user.roles || user.roles.length === 0) && <span style={{ color: '#334155', fontSize: '11px' }} className="font-bold">No roles</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: '#34d399' }} className="font-black text-sm">{fmt(user.balance || 0)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: '#60a5fa' }} className="font-black text-sm">{fmt(user.totalEarned || 0)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold whitespace-nowrap">{new Date(user.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBalanceUser(user)}
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', fontSize: '10px', borderRadius: 8 }}
                        className="px-3 py-1.5 font-black uppercase tracking-widest hover:bg-blue-500/25 transition whitespace-nowrap"
                      >
                        Balance
                      </button>
                      <a
                        href={`/user/${user.id}`}
                        target="_blank"
                        style={{ color: '#475569', padding: 6, borderRadius: 8 }}
                        className="hover:text-slate-300 hover:bg-white/5 transition flex items-center"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ color: '#334155' }} className="text-center py-16 font-bold">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {balanceUser && (
        <BalanceModal
          user={balanceUser}
          token={token}
          onClose={() => setBalanceUser(null)}
          onDone={() => { fetchUsers(); }}
        />
      )}
    </div>
  );
}
