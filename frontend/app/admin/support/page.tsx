'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LifeBuoy, Search, Loader2, ChevronDown } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_COLORS: any = {
  general: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  order: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  technical: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  copyright: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
};

const STATUS_COLORS: any = {
  open: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  in_progress: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  resolved: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  closed: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [token, setToken] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTickets = async () => {
    const adminToken = await getAdminToken();
    if (!adminToken) { setLoading(false); return; }
    setToken(adminToken);
    const res = await fetch('/api/admin/support', { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await res.json();
    setTickets(data.tickets || []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const updateStatus = async (ticketId: string, status: string) => {
    await fetch('/api/admin/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ticketId, status }),
    });
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status } : t));
  };

  const filtered = tickets.filter(t => {
    const matchSearch = !search || t.subject?.toLowerCase().includes(search.toLowerCase()) || t.contact?.toLowerCase().includes(search.toLowerCase()) || t.message?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: tickets.filter(t => t.status === s).length }), {} as any);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
          <LifeBuoy size={22} className="text-blue-400" /> Support Tickets
        </h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{tickets.length} total tickets</p>
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const sc = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              style={{
                background: filterStatus === s ? sc.bg : '#111d36',
                border: `1px solid ${filterStatus === s ? sc.text.replace(')', ',0.5)').replace('rgb', 'rgba') : 'rgba(56,97,175,0.2)'}`,
                borderRadius: 16
              }}
              className="p-4 text-left transition hover:scale-[1.02]"
            >
              <p style={{ color: sc.text, fontSize: '9px' }} className="font-black uppercase tracking-widest mb-1">{s.replace('_', ' ')}</p>
              <p style={{ color: '#f1f5f9' }} className="text-2xl font-black">{counts[s] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} style={{ color: '#475569' }} className="absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tickets..."
          style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
          className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition placeholder-slate-600"
        />
      </div>

      {/* Tickets */}
      <div className="space-y-3">
        {filtered.map((ticket) => {
          const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
          const cc = CATEGORY_COLORS[ticket.category] || CATEGORY_COLORS.general;
          const isExpanded = expanded === ticket.id;

          return (
            <div key={ticket.id} style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 20 }} className="overflow-hidden">
              {/* Header — always visible */}
              <button
                className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition"
                onClick={() => setExpanded(isExpanded ? null : ticket.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <span style={{ background: cc.bg, color: cc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">{ticket.category}</span>
                    <span style={{ background: sc.bg, color: sc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">{ticket.status?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: '#e2e8f0', fontSize: '14px' }} className="font-black truncate">{ticket.subject}</p>
                    <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold">{ticket.contact} · {new Date(ticket.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <ChevronDown size={16} style={{ color: '#475569', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }} />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="px-5 pb-5 pt-4 space-y-4">
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }} className="p-4">
                    <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.7' }} className="font-medium whitespace-pre-wrap">{ticket.message}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <p style={{ color: '#475569', fontSize: '11px' }} className="font-black uppercase tracking-widest">Update Status:</p>
                    <div className="flex gap-2 flex-wrap">
                      {STATUSES.map(s => {
                        const isCurrent = ticket.status === s;
                        const sc2 = STATUS_COLORS[s];
                        return (
                          <button
                            key={s}
                            onClick={() => updateStatus(ticket.id, s)}
                            style={{
                              background: isCurrent ? sc2.bg : 'rgba(255,255,255,0.04)',
                              color: isCurrent ? sc2.text : '#64748b',
                              border: `1px solid ${isCurrent ? sc2.text.replace(')', ', 0.4)').replace('rgb', 'rgba') : 'rgba(255,255,255,0.08)'}`,
                              fontSize: '9px', borderRadius: 8
                            }}
                            className="px-3 py-1.5 font-black uppercase tracking-widest hover:opacity-80 transition"
                          >
                            {s.replace('_', ' ')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ color: '#334155' }} className="text-center py-16 font-bold">No tickets found</div>
        )}
      </div>
    </div>
  );
}
