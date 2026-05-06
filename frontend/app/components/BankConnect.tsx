'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Landmark, CheckCircle2, Pencil, Loader2, AlertCircle,
  ArrowRight, X, ShieldCheck, Eye, EyeOff, ChevronsUpDown
} from 'lucide-react';

interface BankConnectProps {
  /** Pre-loaded profile data from the billing page */
  profile: any;
  /** Called after successful save so parent can refresh data */
  onSaved?: () => void;
  /** Supabase session token for the API call */
  sessionToken: string | null;
  /** Current theme string */
  theme?: string;
}

function formatIban(raw: string) {
  return raw.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

function maskIban(iban: string) {
  const clean = iban.replace(/\s/g, '');
  if (clean.length < 8) return iban;
  return clean.slice(0, 2) + ' •••• •••• •••• ' + clean.slice(-4);
}

export default function BankConnect({ profile, onSaved, sessionToken, theme = 'white' }: BankConnectProps) {
  const isDark = theme !== 'white';

  const hasBank = !!(profile?.payout_iban && profile?.payout_recipient_name);

  const [mode, setMode] = useState<'view' | 'form'>(!hasBank ? 'form' : 'view');
  const [ibanVisible, setIbanVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [animating, setAnimating] = useState(false);

  const [form, setForm] = useState({
    recipientName: profile?.payout_recipient_name || '',
    iban: profile?.payout_iban ? formatIban(profile.payout_iban) : '',
    transferTitle: profile?.payout_transfer_title || '',
  });

  const ibanRef = useRef<HTMLInputElement>(null);

  // Sync external profile changes
  useEffect(() => {
    if (profile) {
      setForm({
        recipientName: profile.payout_recipient_name || '',
        iban: profile.payout_iban ? formatIban(profile.payout_iban) : '',
        transferTitle: profile.payout_transfer_title || '',
      });
      setMode(profile.payout_iban ? 'view' : 'form');
    }
  }, [profile?.payout_iban]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setForm(prev => ({ ...prev, iban: formatted }));
  };

  const switchToForm = () => {
    setAnimating(true);
    setTimeout(() => { setMode('form'); setAnimating(false); }, 250);
  };

  const handleSave = async () => {
    if (!form.recipientName.trim()) { showToast('error', 'Recipient name is required.'); return; }
    const cleanIban = form.iban.replace(/\s/g, '');
    if (cleanIban.length < 15) { showToast('error', 'Please enter a valid IBAN.'); return; }
    if (!sessionToken) { showToast('error', 'Session expired. Please reload.'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/payout/bank-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          recipientName: form.recipientName,
          iban: cleanIban,
          transferTitle: form.transferTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      showToast('success', 'Bank account connected successfully!');
      setAnimating(true);
      setTimeout(() => { setMode('view'); setAnimating(false); onSaved?.(); }, 350);
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!sessionToken) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/payout/bank-details', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ recipientName: '', iban: '', transferTitle: '' });
      showToast('success', 'Bank account removed.');
      setMode('form');
      onSaved?.();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setRemoving(false);
    }
  };

  /* ─────────────────────────── STYLES ─────────────────────────── */
  const card = isDark
    ? 'bg-[#0d1117] border-white/[0.06]'
    : 'bg-white border-gray-100';
  const labelCls = isDark ? 'text-gray-500' : 'text-gray-400';
  const inputCls = isDark
    ? 'bg-white/[0.04] border-white/[0.08] text-white placeholder-gray-700 focus:border-blue-500/60 focus:bg-white/[0.07]'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white';
  const titleCls = isDark ? 'text-white' : 'text-gray-900';
  const mutedCls = isDark ? 'text-gray-400' : 'text-gray-500';

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="relative">

      {/* ── TOAST ── */}
      {toast && (
        <div className={`absolute -top-4 left-0 right-0 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-wider shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/15 border border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.text}
        </div>
      )}

      <div className={`rounded-[32px] border shadow-2xl overflow-hidden transition-all duration-500 ${card}`}
           style={{ transform: animating ? 'scale(0.98)' : 'scale(1)', opacity: animating ? 0 : 1, transition: 'transform 0.25s ease, opacity 0.25s ease' }}>

        {/* ── HEADER ── */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                hasBank && mode === 'view'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {hasBank && mode === 'view' ? <CheckCircle2 size={20} /> : <Landmark size={20} />}
              </div>
              <div>
                <h3 className={`text-base font-black uppercase tracking-tight ${titleCls}`}>
                  {hasBank && mode === 'view' ? 'Bank Connected' : 'Connect Your Bank'}
                </h3>
                <p className={`text-[10px] font-bold uppercase tracking-[0.15em] ${mutedCls}`}>
                  {hasBank && mode === 'view' ? 'Payout destination' : 'For receiving payouts'}
                </p>
              </div>
            </div>

            {/* status pill */}
            {mode === 'view' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            )}
          </div>
        </div>

        <div className="p-8 pt-6 space-y-4">

          {/* ══════════════ VIEW MODE ══════════════ */}
          {mode === 'view' && (
            <div className={`transition-all duration-300 space-y-4`}>

              {/* IBAN display */}
              <div className={`rounded-[20px] p-5 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${labelCls}`}>IBAN</p>
                <div className="flex items-center justify-between">
                  <span className={`font-black text-sm tracking-wider ${titleCls}`}>
                    {ibanVisible
                      ? formatIban(profile?.payout_iban || '')
                      : maskIban(profile?.payout_iban || '')}
                  </span>
                  <button
                    onClick={() => setIbanVisible(v => !v)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isDark ? 'hover:bg-white/10 text-gray-500 hover:text-gray-300' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}
                  >
                    {ibanVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Recipient + Title */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-[20px] p-4 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${labelCls}`}>Recipient</p>
                  <p className={`font-black text-sm truncate ${titleCls}`}>{profile?.payout_recipient_name || '—'}</p>
                </div>
                <div className={`rounded-[20px] p-4 border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${labelCls}`}>Transfer Title</p>
                  <p className={`font-black text-sm truncate ${titleCls}`}>{profile?.payout_transfer_title || '—'}</p>
                </div>
              </div>

              {/* Security badge */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${isDark ? 'bg-blue-500/[0.06] border border-blue-500/10' : 'bg-blue-50 border-blue-100'}`}>
                <ShieldCheck size={14} className="text-blue-400 flex-shrink-0" />
                <p className="text-[10px] font-bold text-blue-400">
                  Bank details are encrypted and stored securely. Only you can see them.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={switchToForm}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    isDark
                      ? 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.06]'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  <Pencil size={13} /> Change Account
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="py-4 px-5 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10"
                >
                  {removing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ FORM MODE ══════════════ */}
          {mode === 'form' && (
            <div className="space-y-4">

              {/* Subtle info banner */}
              <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl ${isDark ? 'bg-blue-500/[0.06] border border-blue-500/10' : 'bg-blue-50/70 border border-blue-100'}`}>
                <ShieldCheck size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] font-bold leading-relaxed text-blue-400">
                  Enter your bank details below. Funds will be transferred directly to this account during payouts.
                </p>
              </div>

              {/* Recipient name */}
              <div className="space-y-1.5">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] ${labelCls}`}>
                  Legal Recipient Name *
                </label>
                <input
                  type="text"
                  value={form.recipientName}
                  onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))}
                  placeholder="e.g. Jan Kowalski"
                  className={`w-full px-5 py-4 rounded-2xl border-2 font-bold text-sm transition-all duration-200 outline-none ${inputCls}`}
                />
              </div>

              {/* IBAN */}
              <div className="space-y-1.5">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] ${labelCls}`}>
                  IBAN *
                </label>
                <div className="relative">
                  <input
                    ref={ibanRef}
                    type={ibanVisible ? 'text' : 'text'}
                    value={form.iban}
                    onChange={handleIbanChange}
                    placeholder="PL 61 1090 1014 0000 0712 1981 2874"
                    maxLength={40}
                    className={`w-full pl-5 pr-12 py-4 rounded-2xl border-2 font-mono font-bold text-sm tracking-widest transition-all duration-200 outline-none ${inputCls}`}
                  />
                  <span className={`absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-[9px] font-black uppercase ${labelCls}`}>
                    <ChevronsUpDown size={14} />
                  </span>
                </div>
                <p className={`text-[9px] font-bold ${labelCls} pl-1`}>
                  International Bank Account Number — include country code (e.g. PL, DE, GB)
                </p>
              </div>

              {/* Transfer title */}
              <div className="space-y-1.5">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] ${labelCls}`}>
                  Transfer Title
                </label>
                <input
                  type="text"
                  value={form.transferTitle}
                  onChange={e => setForm(p => ({ ...p, transferTitle: e.target.value }))}
                  placeholder="e.g. Printsi payout — Jan Kowalski"
                  className={`w-full px-5 py-4 rounded-2xl border-2 font-bold text-sm transition-all duration-200 outline-none ${inputCls}`}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {hasBank && (
                  <button
                    onClick={() => setMode('view')}
                    className={`py-4 px-5 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      isDark
                        ? 'bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.06]'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !form.recipientName || !form.iban}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.18em] text-[10px] flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
                >
                  {saving
                    ? <Loader2 size={15} className="animate-spin" />
                    : (
                      <>
                        {hasBank ? 'Update Account' : 'Connect Bank'}
                        <ArrowRight size={14} />
                      </>
                    )
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
