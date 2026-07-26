'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Package, Search, Eye, EyeOff, Trash2, Loader2, ExternalLink } from 'lucide-react';

import { getAdminToken } from '../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CATEGORY_COLOR: any = {
  physical: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  digital: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  job: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
};

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [token, setToken] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOffers = async () => {
    const adminToken = await getAdminToken();
    if (!adminToken) { setErrorMsg('No admin session token available'); setLoading(false); return; }
    setToken(adminToken);
    try {
      const res = await fetch('/api/admin/offers', { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || `Server returned HTTP ${res.status}`);
      } else {
        setOffers(data.offers || []);
        setErrorMsg(null);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Fetch error');
    }
    setLoading(false);
  };

  useEffect(() => { fetchOffers(); }, []);

  const toggleActive = async (offerId: string, current: boolean) => {
    await fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ offerId, is_active: !current }),
    });
    setOffers(prev => prev.map(o => o.id === offerId ? { ...o, is_active: !current } : o));
  };

  const deleteOffer = async (offerId: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nIf this offer has sales history, it will be archived (hidden) instead.`)) return;
    const res = await fetch('/api/admin/offers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ offerId }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.action === 'deleted') {
        setOffers(prev => prev.filter(o => o.id !== offerId));
      } else {
        setOffers(prev => prev.map(o => o.id === offerId ? { ...o, is_active: false } : o));
      }
    }
  };

  const filtered = offers.filter(o => {
    const matchSearch = !search || o.title?.toLowerCase().includes(search.toLowerCase()) || o.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || o.category === filterCat;
    return matchSearch && matchCat;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }} className="p-4 rounded-2xl font-bold text-sm">
          ⚠️ API Error: {errorMsg}
        </div>
      )}
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Package size={22} className="text-purple-400" /> Listings
        </h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{offers.length} total listings on platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} style={{ color: '#475569' }} className="absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or seller..."
            style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
            className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition placeholder-slate-600"
          />
        </div>
        <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', borderRadius: 14 }} className="flex p-1 gap-1">
          {['all', 'physical', 'digital', 'job'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              style={{
                background: filterCat === cat ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: filterCat === cat ? '#60a5fa' : '#64748b',
                borderRadius: 10,
              }}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest transition"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }}>
                {['Listing', 'Seller', 'Category', 'Price', 'Stock', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ color: '#475569', fontSize: '10px' }} className="px-4 py-4 text-left font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((offer, i) => {
                const catColor = CATEGORY_COLOR[offer.category] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
                return (
                  <tr key={offer.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} className="hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div style={{ width: 40, height: 40, background: '#1e293b', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                          {offer.image_urls?.[0]
                            ? <img src={offer.image_urls[0]} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center"><Package size={16} style={{ color: '#334155' }} /></div>
                          }
                        </div>
                        <p style={{ color: '#e2e8f0', fontSize: '13px', maxWidth: 180 }} className="font-black truncate">{offer.title}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: '#94a3b8', fontSize: '12px' }} className="font-bold whitespace-nowrap">{offer.profiles?.full_name || '—'}</p>
                      <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{offer.profiles?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ background: catColor.bg, color: catColor.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">{offer.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: '#60a5fa' }} className="font-black text-sm">€{Number(offer.price).toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: offer.stock === 0 ? '#ef4444' : '#94a3b8', fontSize: '12px' }} className="font-black">{offer.category === 'digital' ? '∞' : offer.stock}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{
                        background: offer.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: offer.is_active ? '#34d399' : '#f87171',
                        fontSize: '9px', padding: '2px 8px', borderRadius: 999
                      }} className="font-black uppercase tracking-widest">{offer.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold whitespace-nowrap">{new Date(offer.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a href={`/offer/${offer.id}`} target="_blank" style={{ color: '#475569', padding: 6, borderRadius: 8 }} className="hover:text-slate-300 hover:bg-white/5 transition flex items-center">
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => toggleActive(offer.id, offer.is_active)}
                          title={offer.is_active ? 'Deactivate' : 'Activate'}
                          style={{ color: offer.is_active ? '#fbbf24' : '#34d399', padding: 6, borderRadius: 8 }}
                          className="hover:bg-white/5 transition"
                        >
                          {offer.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => deleteOffer(offer.id, offer.title)}
                          style={{ color: '#475569', padding: 6, borderRadius: 8 }}
                          className="hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ color: '#334155' }} className="text-center py-16 font-bold">No listings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
