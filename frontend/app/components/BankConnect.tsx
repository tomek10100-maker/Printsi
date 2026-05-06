'use client';

import { useState, useEffect } from 'react';
import {
  Landmark, CheckCircle2, Pencil, Loader2, AlertCircle,
  ArrowRight, X, ShieldCheck, Eye, EyeOff, ChevronDown
} from 'lucide-react';

interface BankConnectProps {
  profile: any;
  onSaved?: () => void;
  sessionToken: string | null;
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

  // Accordion open state — closed by default
  const [open, setOpen] = useState(false);
  const [ibanVisible, setIbanVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    recipientName: profile?.payout_recipient_name || '',
    iban: profile?.payout_iban ? formatIban(profile.payout_iban) : '',
    transferTitle: profile?.payout_transfer_title || '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        recipientName: profile.payout_recipient_name || '',
        iban: profile.payout_iban ? formatIban(profile.payout_iban) : '',
        transferTitle: profile.payout_transfer_title || '',
      });
    }
  }, [profile?.payout_iban, profile?.payout_recipient_name]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = raw.replace(/(.{4})/g, '$1 ').trim();
    setForm(prev => ({ ...prev, iban: formatted }));
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
      showToast('success', 'Bank account connected!');
      setEditMode(false);
      setOpen(false);
      onSaved?.();
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
      setEditMode(false);
      setOpen(false);
      onSaved?.();
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setRemoving(false);
    }
  };

  const inputCls = isDark
    ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder-gray-700 focus:border-blue-500/70'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500';
  const labelCls = isDark ? 'text-gray-500' : 'text-gray-400';
  const titleCls = isDark ? 'text-white' : 'text-gray-900';

  const showForm = open && (!hasBank || editMode);
  const showConnected = open && hasBank && !editMode;

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={`absolute -top-2 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/15 border border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.text}
        </div>
      )}

      {/* ── TRIGGER BUTTON ── */}
      <button
        onClick={() => { setOpen(o => !o); setEditMode(false); }}
        className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all duration-300 active:scale-[0.98] ${
          hasBank
            ? isDark
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            : isDark
              ? 'bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.1]'
              : 'bg-gray-900 border border-transparent text-white hover:bg-gray-700'
        }`}
      >
        <span className="flex items-center gap-2.5">
          {hasBank
            ? <CheckCircle2 size={14} />
            : <Landmark size={14} />
          }
          {hasBank ? `Connected  ···· ${profile.payout_iban?.slice(-4)}` : 'Connect your bank'}
        </span>
        <ChevronDown
          size={14}
          className="transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* ── ACCORDION BODY ── */}
      <div
        className="overflow-hidden transition-all duration-400 ease-in-out"
        style={{
          maxHeight: open ? '600px' : '0px',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}
      >
        <div className="pt-4 space-y-3">

          {/* ── CONNECTED VIEW ── */}
          {showConnected && (
            <div className="space-y-3">
              {/* IBAN row */}
              <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${
                isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'
              }`}>
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${labelCls}`}>IBAN</p>
                  <p className={`font-mono font-black text-sm tracking-wider ${titleCls}`}>
                    {ibanVisible ? formatIban(profile?.payout_iban || '') : maskIban(profile?.payout_iban || '')}
                  </p>
                </div>
                <button
                  onClick={() => setIbanVisible(v => !v)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isDark ? 'hover:bg-white/10 text-gray-500 hover:text-gray-300' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {ibanVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {/* Recipient + Title */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${labelCls}`}>Recipient</p>
                  <p className={`font-black text-xs truncate ${titleCls}`}>{profile?.payout_recipient_name || '—'}</p>
                </div>
                <div className={`px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${labelCls}`}>Title</p>
                  <p className={`font-black text-xs truncate ${titleCls}`}>{profile?.payout_transfer_title || '—'}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditMode(true)}
                  className={`flex-1 py-3 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 ${
                    isDark ? 'bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/[0.06]' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  <Pencil size={11} /> Change
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="py-3 px-4 rounded-2xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center transition-all active:scale-95 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10"
                >
                  {removing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              </div>
            </div>
          )}

          {/* ── FORM ── */}
          {showForm && (
            <div className="space-y-3">
              {/* Info badge */}
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl ${isDark ? 'bg-blue-500/[0.07] border border-blue-500/10' : 'bg-blue-50 border border-blue-100'}`}>
                <ShieldCheck size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] font-bold leading-relaxed text-blue-400">
                  Enter your bank details. Funds will be transferred directly to this account.
                </p>
              </div>

              {/* Recipient */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] pl-1 ${labelCls}`}>Legal Recipient Name *</label>
                <input
                  type="text"
                  value={form.recipientName}
                  onChange={e => setForm(p => ({ ...p, recipientName: e.target.value }))}
                  placeholder="e.g. Jan Kowalski"
                  className={`w-full px-4 py-3.5 rounded-2xl border-2 font-bold text-sm transition-all outline-none ${inputCls}`}
                />
              </div>

              {/* IBAN */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] pl-1 ${labelCls}`}>IBAN *</label>
                <input
                  type="text"
                  value={form.iban}
                  onChange={handleIbanChange}
                  placeholder="PL61 1090 1014 0000 0712 1981 2874"
                  maxLength={40}
                  className={`w-full px-4 py-3.5 rounded-2xl border-2 font-mono font-bold text-sm tracking-wider transition-all outline-none ${inputCls}`}
                />
                <p className={`text-[9px] font-bold pl-1 ${labelCls}`}>Include country code (e.g. PL, DE, GB)</p>
              </div>

              {/* Transfer title */}
              <div className="space-y-1">
                <label className={`text-[9px] font-black uppercase tracking-[0.2em] pl-1 ${labelCls}`}>Transfer Title</label>
                <input
                  type="text"
                  value={form.transferTitle}
                  onChange={e => setForm(p => ({ ...p, transferTitle: e.target.value }))}
                  placeholder="e.g. Printsi payout"
                  className={`w-full px-4 py-3.5 rounded-2xl border-2 font-bold text-sm transition-all outline-none ${inputCls}`}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {(hasBank || editMode) && (
                  <button
                    onClick={() => { setEditMode(false); if (!hasBank) setOpen(false); }}
                    className={`py-3.5 px-4 rounded-2xl font-black text-[10px] flex items-center justify-center transition-all active:scale-95 ${
                      isDark ? 'bg-white/[0.07] text-white hover:bg-white/[0.12] border border-white/[0.06]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <X size={12} />
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !form.recipientName || !form.iban}
                  className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.18em] text-[10px] flex items-center justify-center gap-2 hover:bg-blue-500 transition-all active:scale-95 disabled:opacity-40 shadow-lg shadow-blue-600/20"
                >
                  {saving
                    ? <Loader2 size={14} className="animate-spin" />
                    : <><ArrowRight size={13} /> {editMode ? 'Update' : 'Connect Bank'}</>
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
