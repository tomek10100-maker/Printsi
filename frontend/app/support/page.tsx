'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, ShieldCheck, Truck, Send, X, CheckCircle, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type FormCategory = 'general' | 'order' | 'technical' | 'copyright';

interface FormConfig {
  label: string;
  color: string;             // tło headera formularza
  accent: string;            // kolor przycisku
  accentHover: string;
  border: string;            // kolor ramki
  badgeBg: string;           // tło badge kategorii
  badgeText: string;
  defaultSubject: string;
}

const FORM_CONFIGS: Record<FormCategory, FormConfig> = {
  general: {
    label: 'General Inquiry',
    color: 'from-blue-600 to-blue-500',
    accent: 'bg-blue-600 hover:bg-blue-700',
    accentHover: '',
    border: 'border-blue-500/30',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    defaultSubject: '',
  },
  order: {
    label: 'Order Issues',
    color: 'from-sky-600 to-blue-500',
    accent: 'bg-sky-600 hover:bg-sky-700',
    accentHover: '',
    border: 'border-sky-500/30',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    defaultSubject: 'Order Issue — ',
  },
  technical: {
    label: 'Technical Help',
    color: 'from-purple-600 to-violet-500',
    accent: 'bg-purple-600 hover:bg-purple-700',
    accentHover: '',
    border: 'border-purple-500/30',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    defaultSubject: 'Technical Help — ',
  },
  copyright: {
    label: 'Copyright Report',
    color: 'from-emerald-600 to-green-500',
    accent: 'bg-emerald-600 hover:bg-emerald-700',
    accentHover: '',
    border: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    defaultSubject: 'Copyright / Policy Violation — ',
  },
};

export default function SupportPage() {
  const [activeForm, setActiveForm] = useState<FormCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const openForm = (category: FormCategory) => {
    setActiveForm(category);
    setSubject(FORM_CONFIGS[category].defaultSubject);
    setMessage('');
    setContact('');
    setSent(false);
    setError('');
  };

  const closeForm = () => {
    setActiveForm(null);
    setSent(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeForm) return;
    if (!subject.trim() || !message.trim() || !contact.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeForm,
          subject: subject.trim(),
          message: message.trim(),
          contact: contact.trim(),
        }),
      });
      const data = await res.json();
      setSending(false);
      if (!res.ok) {
        setError(`Error: ${data.error || 'Something went wrong. Please try again.'}`);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setSending(false);
      setError(`Error: ${err.message || 'Network error. Please try again.'}`);
    }
  };

  const cfg = activeForm ? FORM_CONFIGS[activeForm] : null;

  return (
    <main className="min-h-screen bg-[#0f1115] py-12 px-6 font-sans text-white">
      <div className="max-w-4xl mx-auto">

        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-10 font-bold uppercase text-xs tracking-widest transition-colors"
        >
          <ArrowLeft size={16} /> Back to Home
        </Link>

        {/* HERO */}
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-500 text-white p-12 rounded-[40px] shadow-2xl mb-12 text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-[-30%] left-[-5%] w-80 h-80 bg-blue-400 rounded-full opacity-40 blur-3xl" />
            <div className="absolute bottom-[-30%] right-[-5%] w-80 h-80 bg-blue-300 rounded-full opacity-30 blur-3xl" />
          </div>
          <div className="relative z-10">
            <h1 className="text-5xl font-black uppercase tracking-tighter mb-4 leading-tight">
              We've got your back.
            </h1>
            <p className="text-blue-100 text-lg max-w-xl mx-auto font-medium mb-10 leading-relaxed">
              Need help with an order or have a technical question? Our team is here to assist you.
            </p>
            <button
              onClick={() => openForm('general')}
              className="inline-flex items-center gap-3 bg-white text-blue-700 px-10 py-4 rounded-full font-black uppercase tracking-widest hover:bg-blue-50 transition-all shadow-2xl text-sm active:scale-95"
            >
              <Mail size={18} /> Contact Support
            </button>
          </div>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SupportCard
            icon={<Truck size={32} />}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-400"
            title="Order Issues"
            desc="Haven't received your package? Let us know the Order ID."
            onClick={() => openForm('order')}
            borderColor="hover:border-sky-500/40"
          />
          <SupportCard
            icon={<MessageSquare size={32} />}
            iconBg="bg-purple-500/10"
            iconColor="text-purple-400"
            title="Technical Help"
            desc="Trouble downloading a file or setting up a print?"
            onClick={() => openForm('technical')}
            borderColor="hover:border-purple-500/40"
          />
          <SupportCard
            icon={<ShieldCheck size={32} />}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-400"
            title="Copyright"
            desc="Report intellectual property infringement or policy violations."
            onClick={() => openForm('copyright')}
            borderColor="hover:border-emerald-500/40"
          />
        </div>
      </div>

      {/* ---- FORM MODAL ---- */}
      {activeForm && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={closeForm}
        >
          <div
            className={`bg-[#16181e] w-full max-w-lg rounded-[40px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.6)] border ${cfg.border} animate-in fade-in zoom-in-95 duration-300`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`bg-gradient-to-r ${cfg.color} px-8 py-7 relative overflow-hidden`}>
              <div className="absolute top-[-40%] right-[-5%] w-48 h-48 bg-white/10 rounded-full blur-2xl" />
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className={`inline-block text-[10px] font-black uppercase tracking-[0.2em] ${cfg.badgeBg} ${cfg.badgeText} px-3 py-1 rounded-full mb-3`}>
                    {cfg.label}
                  </span>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">
                    Send a Message
                  </h2>
                  <p className="text-white/70 text-xs font-bold mt-1">
                    We'll get back to you within 24 hours.
                  </p>
                </div>
                <button
                  onClick={closeForm}
                  className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors mt-1"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-8 py-8">
              {sent ? (
                /* SUCCESS STATE */
                <div className="text-center py-6">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-emerald-500/10">
                    <CheckCircle size={40} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">
                    Message Sent!
                  </h3>
                  <p className="text-gray-400 text-sm font-medium mb-8">
                    Your ticket has been submitted. Our team will review it shortly.
                  </p>
                  <button
                    onClick={closeForm}
                    className="w-full py-4 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                  >
                    ← Back to Support
                  </button>
                </div>
              ) : (
                /* FORM STATE */
                <form onSubmit={handleSubmit} className="space-y-5">

                  {/* Subject */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 block mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Brief description of your issue"
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-2xl text-sm font-bold text-white outline-none transition-colors placeholder-gray-600"
                      required
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 block mb-2">
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      rows={5}
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-2xl text-sm font-bold text-white outline-none resize-none transition-colors placeholder-gray-600"
                      required
                    />
                  </div>

                  {/* Contact */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 block mb-2">
                      Your Email / Contact
                    </label>
                    <input
                      type="email"
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-3.5 bg-white/5 border border-white/10 focus:border-white/30 rounded-2xl text-sm font-bold text-white outline-none transition-colors placeholder-gray-600"
                      required
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
                      {error}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className={`flex-1 py-4 ${cfg.accent} text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60`}
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <><Send size={14} /> Send Message</>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SupportCard({
  icon, iconBg, iconColor, title, desc, onClick, borderColor
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  onClick: () => void;
  borderColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white/5 border border-white/10 ${borderColor} p-8 rounded-[32px] text-center hover:-translate-y-2 hover:bg-white/8 transition-all duration-300 cursor-pointer group w-full`}
    >
      <div className={`${iconBg} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <h3 className="font-black uppercase text-white mb-3 text-sm tracking-widest">{title}</h3>
      <p className="text-gray-400 text-xs font-bold leading-relaxed">{desc}</p>
    </button>
  );
}