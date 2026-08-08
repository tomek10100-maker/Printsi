'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, Search, Loader2, ChevronDown, AlertTriangle, MessageSquare, ShieldAlert, CheckCircle2, ExternalLink } from 'lucide-react';
import { getAdminToken } from '../../lib/getAdminToken';

const STATUS_COLORS: any = {
  open: { bg: 'rgba(239,68,68,0.18)', text: '#f87171' },
  in_progress: { bg: 'rgba(245,158,11,0.18)', text: '#fbbf24' },
  resolved: { bg: 'rgba(16,185,129,0.18)', text: '#34d399' },
  closed: { bg: 'rgba(100,116,139,0.18)', text: '#94a3b8' },
};

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'reports' | 'disputes'>('all');
  const [token, setToken] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReports = async () => {
    const adminToken = await getAdminToken();
    if (!adminToken) { setLoading(false); return; }
    setToken(adminToken);
    try {
      const res = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      setReports(data.reports || []);
      setDisputes(data.disputes || []);
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const updateReportStatus = async (id: string, isDispute: boolean, status: string) => {
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(isDispute ? { disputeId: id, status } : { reportId: id, status }),
    });
    if (isDispute) {
      setDisputes(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    } else {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
  };

  // Combine items with a type tag
  const allItems = [
    ...reports.map(r => ({
      id: r.id,
      itemType: 'report',
      title: r.subject || 'User Report',
      message: r.message,
      contact: r.contact,
      status: r.status || 'open',
      createdAt: r.created_at,
      raw: r
    })),
    ...disputes.map(d => ({
      id: d.id,
      itemType: 'dispute',
      title: `Order Dispute: ${d.problem_type || 'General Problem'}`,
      message: d.description,
      contact: d.contact_email,
      status: d.status || 'open',
      createdAt: d.created_at,
      raw: d
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = allItems.filter(item => {
    if (activeTab === 'reports' && item.itemType !== 'report') return false;
    if (activeTab === 'disputes' && item.itemType !== 'dispute') return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchMsg = item.message?.toLowerCase().includes(q);
      const matchContact = item.contact?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchContact) return false;
    }
    return true;
  });

  const counts = STATUSES.reduce((acc, s) => ({
    ...acc,
    [s]: allItems.filter(i => i.status === s).length
  }), {} as any);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-amber-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Flag size={24} className="text-amber-400" /> User Reports & Disputes
          </h1>
          <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">
            {allItems.length} total issues reported by users
          </p>
        </div>

        {/* Tab Filters */}
        <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)' }} className="p-1 rounded-2xl flex gap-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('all')}
            style={{
              background: activeTab === 'all' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: activeTab === 'all' ? '#fbbf24' : '#64748b'
            }}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            All ({allItems.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            style={{
              background: activeTab === 'reports' ? 'rgba(245,158,11,0.2)' : 'transparent',
              color: activeTab === 'reports' ? '#fbbf24' : '#64748b'
            }}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('disputes')}
            style={{
              background: activeTab === 'disputes' ? 'rgba(239,68,68,0.2)' : 'transparent',
              color: activeTab === 'disputes' ? '#f87171' : '#64748b'
            }}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Disputes ({disputes.length})
          </button>
        </div>
      </div>

      {/* Status Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const sc = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              style={{
                background: filterStatus === s ? sc.bg : '#111d36',
                border: `1px solid ${filterStatus === s ? sc.text : 'rgba(56,97,175,0.2)'}`,
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
          placeholder="Search by subject, description, user..."
          style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
          className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-amber-500 transition placeholder-slate-600"
        />
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const sc = STATUS_COLORS[item.status] || STATUS_COLORS.open;
          const isExpanded = expanded === item.id;
          const isDispute = item.itemType === 'dispute';

          // Extract link or chat ID if embedded in message
          let chatIdMatch = item.message?.match(/Chat ID:\s*([a-zA-Z0-9_-]+)/);
          let extractedChatId = chatIdMatch ? chatIdMatch[1] : item.raw?.chat_id;

          return (
            <div key={item.id} style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 20 }} className="overflow-hidden">
              {/* Header */}
              <button
                className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition"
                onClick={() => setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex flex-col gap-1.5 mt-0.5 shrink-0">
                    <span
                      style={{
                        background: isDispute ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: isDispute ? '#f87171' : '#fbbf24',
                        fontSize: '9px', padding: '2px 8px', borderRadius: 999
                      }}
                      className="font-black uppercase tracking-widest whitespace-nowrap"
                    >
                      {isDispute ? 'DISPUTE' : 'REPORT'}
                    </span>
                    <span style={{ background: sc.bg, color: sc.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest whitespace-nowrap">
                      {item.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p style={{ color: '#e2e8f0', fontSize: '14px' }} className="font-black truncate">{item.title}</p>
                    <p style={{ color: '#64748b', fontSize: '11px' }} className="font-bold">
                      {item.contact || 'User'} · {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} style={{ color: '#475569', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }} />
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }} className="px-5 pb-5 pt-4 space-y-4">
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12 }} className="p-4">
                    <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: '1.7' }} className="font-medium whitespace-pre-wrap">
                      {item.message}
                    </p>
                  </div>

                  {/* Actions & Links */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {extractedChatId ? (
                      <Link
                        href={`/admin/chats/${extractedChatId}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition"
                      >
                        <MessageSquare size={14} /> View Related Chat <ExternalLink size={12} />
                      </Link>
                    ) : <div />}

                    {/* Status switcher */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{ color: '#475569', fontSize: '10px' }} className="font-black uppercase tracking-widest mr-1">Set Status:</p>
                      {STATUSES.map(s => {
                        const isCurrent = item.status === s;
                        const sc2 = STATUS_COLORS[s];
                        return (
                          <button
                            key={s}
                            onClick={() => updateReportStatus(item.id, isDispute, s)}
                            style={{
                              background: isCurrent ? sc2.bg : 'rgba(255,255,255,0.04)',
                              color: isCurrent ? sc2.text : '#64748b',
                              border: `1px solid ${isCurrent ? sc2.text : 'rgba(255,255,255,0.08)'}`,
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
          <div style={{ color: '#475569' }} className="text-center py-16 font-bold text-sm">
            No reports or disputes found.
          </div>
        )}
      </div>
    </div>
  );
}
