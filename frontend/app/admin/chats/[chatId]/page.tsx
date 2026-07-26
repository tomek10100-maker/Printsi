'use client';

import { use, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Loader2, Package, MessageSquare, User } from 'lucide-react';
import Link from 'next/link';
import { getAdminToken } from '../../../lib/getAdminToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function Avatar({ user, size = 36 }: { user: any, size?: number }) {
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

function parseProposal(content: string) {
  try {
    const json = content.startsWith('[PROPOSAL]') ? content.substring(10) : content;
    return JSON.parse(json);
  } catch { return null; }
}

export default function AdminChatDetailPage({ params }: { params: Promise<{ chatId: string }> }) {
  const resolvedParams = use(params);
  const chatId = resolvedParams.chatId;

  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChat = async () => {
      const token = await getAdminToken();
      if (!token) { setLoading(false); return; }
      const res = await fetch(`/api/admin/chats/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setChat(data.chat);
      setMessages(data.messages || []);
      setLoading(false);
    };
    fetchChat();
  }, [chatId]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  if (!chat) return <div style={{ color: '#f87171' }} className="text-center py-16 font-bold">Chat not found</div>;

  const buyerId = (chat.buyer as any)?.id;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/chats" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b', width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }} className="flex items-center justify-center hover:text-white transition flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ color: '#f1f5f9' }} className="text-xl font-black tracking-tight flex items-center gap-2">
            <MessageSquare size={18} className="text-purple-400" /> Conversation
          </h1>
          <p style={{ color: '#475569', fontSize: '11px' }} className="font-bold">{chatId}</p>
        </div>
      </div>

      {/* Participants + Offer */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)' }} className="rounded-2xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Buyer */}
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 16 }} className="p-4">
            <p style={{ color: '#3b82f6', fontSize: '9px' }} className="font-black uppercase tracking-widest mb-3">Buyer</p>
            <div className="flex items-center gap-3">
              <Avatar user={chat.buyer} />
              <div className="min-w-0">
                <p style={{ color: '#e2e8f0', fontSize: '13px' }} className="font-black truncate">{chat.buyer?.full_name || '—'}</p>
                <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold truncate">{chat.buyer?.email}</p>
              </div>
            </div>
          </div>

          {/* Offer */}
          <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16 }} className="p-4">
            <p style={{ color: '#8b5cf6', fontSize: '9px' }} className="font-black uppercase tracking-widest mb-3">Listing</p>
            <div className="flex items-center gap-3">
              {chat.offers?.image_urls?.[0]
                ? <img src={chat.offers.image_urls[0]} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} alt="" />
                : <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1e293b', flexShrink: 0 }} className="flex items-center justify-center"><Package size={14} style={{ color: '#334155' }} /></div>
              }
              <div className="min-w-0">
                <p style={{ color: '#e2e8f0', fontSize: '12px' }} className="font-black truncate">{chat.offers?.title || '—'}</p>
                <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold">€{Number(chat.offers?.price || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Seller */}
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16 }} className="p-4">
            <p style={{ color: '#10b981', fontSize: '9px' }} className="font-black uppercase tracking-widest mb-3">Seller</p>
            <div className="flex items-center gap-3">
              <Avatar user={chat.seller} />
              <div className="min-w-0">
                <p style={{ color: '#e2e8f0', fontSize: '13px' }} className="font-black truncate">{chat.seller?.full_name || '—'}</p>
                <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold truncate">{chat.seller?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex gap-3 mt-4 flex-wrap">
          <span style={{ color: '#475569', fontSize: '10px' }} className="font-bold">Started: <span style={{ color: '#94a3b8' }}>{new Date(chat.created_at).toLocaleString()}</span></span>
          {chat.completed_at && <span style={{ color: '#34d399', fontSize: '10px' }} className="font-black">✓ Completed: {new Date(chat.completed_at).toLocaleString()}</span>}
          {chat.archived_at && <span style={{ color: '#64748b', fontSize: '10px' }} className="font-black">Archived: {new Date(chat.archived_at).toLocaleString()}</span>}
        </div>
      </div>

      {/* Messages */}
      <div style={{ background: '#111d36', border: '1px solid rgba(56,97,175,0.2)' }} className="rounded-2xl p-5">
        <h2 style={{ color: '#94a3b8', fontSize: '11px' }} className="font-black uppercase tracking-widest mb-5 flex items-center gap-2">
          <MessageSquare size={13} /> {messages.length} Messages
        </h2>

        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {messages.map((msg) => {
            const sender = (msg as any).profiles;
            const isBuyer = msg.sender_id === buyerId;
            const isSystem = msg.message_type === 'system';
            const isProposal = msg.content?.startsWith('[PROPOSAL]') || msg.message_type === 'proposal' || msg.message_type === 'job_proposal';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span style={{ background: 'rgba(255,255,255,0.05)', color: '#475569', fontSize: '10px', padding: '4px 12px', borderRadius: 999 }} className="font-bold">{msg.content}</span>
                </div>
              );
            }

            if (isProposal) {
              const proposal = parseProposal(msg.content);
              return (
                <div key={msg.id} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 16 }} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar user={sender} size={24} />
                    <p style={{ color: '#a78bfa', fontSize: '10px' }} className="font-black uppercase tracking-widest">
                      {isBuyer ? 'Buyer' : 'Seller'} — {msg.message_type === 'job_proposal' ? 'Job Proposal' : 'Custom Offer'}
                    </p>
                    <p style={{ color: '#475569', fontSize: '10px' }} className="font-bold ml-auto">{new Date(msg.created_at).toLocaleString()}</p>
                  </div>
                  {proposal && (
                    <div className="space-y-1">
                      {proposal.price && <p style={{ color: '#e2e8f0', fontSize: '13px' }} className="font-black">Price: <span style={{ color: '#a78bfa' }}>€{proposal.price}</span></p>}
                      {proposal.message && <p style={{ color: '#94a3b8', fontSize: '12px' }} className="font-bold">{proposal.message}</p>}
                      {proposal.status && (
                        <span style={{
                          background: proposal.status === 'accepted' ? 'rgba(16,185,129,0.2)' : proposal.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                          color: proposal.status === 'accepted' ? '#34d399' : proposal.status === 'rejected' ? '#f87171' : '#fbbf24',
                          fontSize: '9px', padding: '2px 8px', borderRadius: 999
                        }} className="font-black uppercase tracking-widest">{proposal.status}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-3 ${isBuyer ? 'flex-row' : 'flex-row-reverse'}`}>
                <Avatar user={sender} size={28} />
                <div className={`max-w-[70%] ${isBuyer ? '' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <p style={{ color: '#475569', fontSize: '10px' }} className="font-black uppercase tracking-widest">
                      {isBuyer ? 'Buyer' : 'Seller'} — {sender?.full_name || '—'}
                    </p>
                    <p style={{ color: '#334155', fontSize: '10px' }} className="font-bold">{new Date(msg.created_at).toLocaleString()}</p>
                  </div>
                  <div
                    style={{
                      background: isBuyer ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.12)',
                      border: `1px solid ${isBuyer ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.2)'}`,
                      borderRadius: isBuyer ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    }}
                    className="px-4 py-3"
                  >
                    <p style={{ color: '#e2e8f0', fontSize: '13px' }} className="font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {!msg.is_read && (
                    <p style={{ color: '#f59e0b', fontSize: '9px' }} className="font-black uppercase tracking-widest mt-1">Unread</p>
                  )}
                </div>
              </div>
            );
          })}

          {messages.length === 0 && (
            <p style={{ color: '#334155' }} className="text-center py-8 font-bold">No messages in this conversation</p>
          )}
        </div>
      </div>
    </div>
  );
}
