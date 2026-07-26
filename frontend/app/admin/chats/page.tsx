'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, Search, Loader2, ArrowRight, Package } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function Avatar({ user, size = 32 }: { user: any, size?: number }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d1b69)', border: '1px solid rgba(59,130,246,0.3)', width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}
      className="flex items-center justify-center">
      {user?.avatar_url
        ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        : <span style={{ color: '#93c5fd', fontSize: size * 0.35 + 'px' }} className="font-black">{user?.full_name?.[0] || '?'}</span>
      }
    </div>
  );
}

const CATEGORY_COLOR: any = {
  physical: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  digital: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  job: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
};

export default function AdminChatsPage() {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchChats = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/chats', { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await res.json();
      setChats(data.chats || []);
      setLoading(false);
    };
    fetchChats();
  }, []);

  const filtered = chats.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.buyer?.full_name?.toLowerCase().includes(q) ||
      c.seller?.full_name?.toLowerCase().includes(q) ||
      c.buyer?.email?.toLowerCase().includes(q) ||
      c.seller?.email?.toLowerCase().includes(q) ||
      c.offers?.title?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ color: '#f1f5f9' }} className="text-2xl font-black tracking-tight flex items-center gap-2">
          <MessageSquare size={22} className="text-purple-400" /> Conversations
        </h1>
        <p style={{ color: '#64748b' }} className="text-sm font-bold mt-0.5">{chats.length} total chat threads</p>
      </div>

      <div className="relative">
        <Search size={16} style={{ color: '#475569' }} className="absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by buyer, seller, or listing..."
          style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)', color: '#e2e8f0', borderRadius: 14 }}
          className="w-full pl-11 pr-4 py-3.5 font-bold text-sm outline-none focus:border-blue-500 transition placeholder-slate-600"
        />
      </div>

      <div style={{ background: '#111d36', border: '1px solid rgba(56, 97, 175, 0.2)' }} className="rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56, 97, 175, 0.15)' }}>
                {['Buyer', '', 'Seller', 'Listing', 'Category', 'Messages', 'Last Activity', 'View'].map(h => (
                  <th key={h} style={{ color: '#475569', fontSize: '10px' }} className="px-4 py-4 text-left font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((chat, i) => {
                const catColor = CATEGORY_COLOR[chat.offers?.category] || { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' };
                const isArchived = !!chat.archived_at;
                const isCompleted = !!chat.completed_at;
                return (
                  <tr key={chat.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} className="hover:bg-white/[0.02] transition">
                    {/* Buyer */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar user={chat.buyer} size={30} />
                        <div>
                          <p style={{ color: '#e2e8f0', fontSize: '12px' }} className="font-black whitespace-nowrap">{chat.buyer?.full_name || '—'}</p>
                          <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{chat.buyer?.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Arrow */}
                    <td className="px-2">
                      <ArrowRight size={14} style={{ color: '#334155' }} />
                    </td>
                    {/* Seller */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar user={chat.seller} size={30} />
                        <div>
                          <p style={{ color: '#e2e8f0', fontSize: '12px' }} className="font-black whitespace-nowrap">{chat.seller?.full_name || '—'}</p>
                          <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">{chat.seller?.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Listing */}
                    <td className="px-4 py-4" style={{ maxWidth: 180 }}>
                      <div className="flex items-center gap-2">
                        {chat.offers?.image_urls?.[0]
                          ? <img src={chat.offers.image_urls[0]} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} alt="" />
                          : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#1e293b', flexShrink: 0 }} className="flex items-center justify-center"><Package size={12} style={{ color: '#334155' }} /></div>
                        }
                        <p style={{ color: '#94a3b8', fontSize: '11px', maxWidth: 140 }} className="font-bold truncate">{chat.offers?.title || '—'}</p>
                      </div>
                    </td>
                    {/* Category */}
                    <td className="px-4 py-4">
                      {chat.offers?.category && (
                        <span style={{ background: catColor.bg, color: catColor.text, fontSize: '9px', padding: '2px 8px', borderRadius: 999 }} className="font-black uppercase tracking-widest">{chat.offers.category}</span>
                      )}
                    </td>
                    {/* Messages */}
                    <td className="px-4 py-4">
                      <span style={{ color: '#60a5fa' }} className="font-black text-sm">{chat.messageCount}</span>
                    </td>
                    {/* Last activity */}
                    <td className="px-4 py-4">
                      <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold whitespace-nowrap">{new Date(chat.updated_at || chat.created_at).toLocaleDateString()}</p>
                      {isCompleted && <span style={{ color: '#34d399', fontSize: '9px' }} className="font-black uppercase">Completed</span>}
                      {isArchived && !isCompleted && <span style={{ color: '#64748b', fontSize: '9px' }} className="font-black uppercase">Archived</span>}
                    </td>
                    {/* View */}
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/chats/${chat.id}`}
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', fontSize: '10px', borderRadius: 8 }}
                        className="px-3 py-1.5 font-black uppercase tracking-widest hover:bg-blue-500/25 transition flex items-center gap-1 whitespace-nowrap w-fit"
                      >
                        View <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ color: '#334155' }} className="text-center py-16 font-bold">No conversations found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
