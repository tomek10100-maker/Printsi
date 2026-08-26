'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  User, Shield, LayoutGrid, LogOut, Check, ChevronRight, Eye, Trash2, Globe, Menu, X, Coins, AlertCircle, Loader2, MapPin, UploadCloud, CheckCircle2,
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';
import { DHL_COUNTRIES } from '../lib/dhlRates';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Waluty krajów obsługiwanych przez Vinted (wysyłka z PL)
const CURRENCIES = [
  { code: 'EUR', label: '🇪🇺 Euro (€)' },
  { code: 'PLN', label: '🇵🇱 Polish Zloty (PLN)' },
  { code: 'CZK', label: '🇨🇿 Czech Koruna (Kč)' },
  { code: 'HUF', label: '🇭🇺 Hungarian Forint (Ft)' },
  { code: 'RON', label: '🇷🇴 Romanian Leu (lei)' },
  { code: 'SEK', label: '🇸🇪 Swedish Krona (kr)' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { currency, setCurrency, formatPrice } = useCurrency();
  const [exchangeModal, setExchangeModal] = useState<{ show: boolean; newCode: string; fee: number } | null>(null);
  const [showContactSales, setShowContactSales] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [roleError, setRoleError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [country, setCountry] = useState('PL');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (roleError) {
      const timer = setTimeout(() => setRoleError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [roleError]);

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setBio(profile.bio || '');
        setRoles(profile.roles || ['customer']);
        setCountry(profile.country || 'PL');
        setAvatarUrl(profile.avatar_url || '');
      }
      setLoading(false);
    };
    getData();
  }, [router]);

  const handleAvatarUpload = async (file: File) => {
    if (!user || !file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('printsi-files1')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('printsi-files1')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      alert('Failed to upload avatar: ' + (err.message || 'Unknown error'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setRoleError('');
    try {
      const updates = {
        id: user.id,
        full_name: fullName,
        bio,
        roles,
        country,
        avatar_url: avatarUrl,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => {
        router.push('/profile');
      }, 2000);
    } catch (error: any) {
      setRoleError('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return setRoleError("Please enter a new password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setRoleError(error.message);
    else {
      setSaveSuccess(true);
      setNewPassword('');
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const toggleRole = (role: string) => {
    let newRoles = [...roles];
    const group1 = ['customer', 'designer', 'printer'];
    const group2 = ['hobbyist', 'business'];

    if (group1.includes(role)) {
      if (newRoles.includes(role)) {
        const othersInGroup1 = newRoles.filter(r => group1.includes(r) && r !== role);
        if (othersInGroup1.length > 0) {
          newRoles = newRoles.filter(r => r !== role);
        } else {
          setRoleError('At least one marketplace role must be selected.');
          return;
        }
      } else {
        newRoles.push(role);
      }
    } else if (group2.includes(role)) {
      if (newRoles.includes(role)) {
        // Trying to deselect the only active account type
        setRoleError('At least one account type must be selected.');
        return;
      } else {
        // Switch account type (max 1)
        newRoles = newRoles.filter(r => !group2.includes(r));
        newRoles.push(role);
      }
    }

    setRoles(newRoles);
    setRoleError('');
  };

  const handleCurrencyChange = async (newCode: string) => {
    if (newCode === currency) return;
    if (!user) return;

    setSaving(true);
    try {
      const [salesRes, ordersRes, payoutsRes] = await Promise.all([
        supabase.from('order_items').select('price_at_purchase, quantity, status').eq('seller_id', user.id),
        supabase.from('orders').select('total_amount').eq('buyer_id', user.id).like('stripe_payment_intent_id', 'balance_%'),
        supabase.from('payouts').select('amount, status').eq('user_id', user.id)
      ]);

      const totalEarned = salesRes.data?.reduce((acc, s) => s.status === 'completed' ? acc + (s.price_at_purchase * (s.quantity || 1)) : acc, 0) || 0;
      const totalSpent = ordersRes.data?.reduce((acc, o) => acc + Number(o.total_amount), 0) || 0;
      const totalPayouts = payoutsRes.data?.reduce((acc, p) => (p.status === 'completed' || p.status === 'pending') ? acc + Number(p.amount) : acc, 0) || 0;

      const balance = totalEarned - totalSpent - totalPayouts;

      if (balance > 0) {
        setExchangeModal({ show: true, newCode, fee: balance * 0.03 });
      } else {
        await setCurrency(newCode as any);
      }
    } catch (err: any) {
      setRoleError('Failed to check balance: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmExchange = async () => {
    if (!exchangeModal) return;
    setSaving(true);
    try {
      const res = await fetch('/api/billing/exchange-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await setCurrency(exchangeModal.newCode as any);
      setExchangeModal(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      setRoleError('Exchange failed: ' + err.message);
      setExchangeModal(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-800">Loading settings...</div>;

  return (
    <main className="min-h-screen bg-gray-50 flex font-sans text-gray-900 relative">

      {/* MOBILE MENU TOGGLE */}
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-white rounded-lg shadow-md border border-gray-200">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`
        fixed md:sticky top-0 inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 h-screen flex flex-col transform transition-transform duration-300 ease-in-out shrink-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-8 border-b border-gray-100 shrink-0">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900 uppercase">
            <LayoutGrid className="text-blue-600" /> Settings
          </h1>
        </div>

        <nav className="p-6 space-y-2 flex-1 overflow-y-auto">
          <button
            onClick={() => router.push('/profile')}
            className="w-full flex items-center gap-3 px-5 py-4 mb-8 bg-blue-50 text-blue-600 rounded-2xl font-black border border-blue-100 hover:bg-blue-100 transition-all shadow-sm"
          >
            <Eye size={18} /> View Profile
          </button>

          <div className="text-xs font-black text-gray-400 uppercase tracking-widest px-4 mb-3">Account</div>
          <SidebarItem icon={<User size={18} />} label="General Profile" id="general" active={activeTab} set={(id: string) => { setActiveTab(id); setMobileMenuOpen(false); }} />
          <SidebarItem icon={<Shield size={18} />} label="Roles & Permissions" id="roles" active={activeTab} set={(id: string) => { setActiveTab(id); setMobileMenuOpen(false); }} />
          <SidebarItem icon={<Globe size={18} />} label="Preferences" id="preferences" active={activeTab} set={(id: string) => { setActiveTab(id); setMobileMenuOpen(false); }} />
        </nav>

        <div className="p-6 border-t border-gray-100 shrink-0 bg-white">
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex items-center gap-3 px-5 py-4 text-red-600 hover:bg-red-50 rounded-2xl w-full font-bold transition-colors uppercase text-sm tracking-wide">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      {/* Dodano pb-32 aby chronić przed schowaniem się pod floating bar */}
      <div className="flex-1 p-8 md:p-16 pb-32 md:pb-32 overflow-y-auto w-full relative">

        {/* TAB: GENERAL */}
        {activeTab === 'general' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">General Profile</h2>
              <p className="text-gray-500 font-medium mt-2">Manage your public information and identity.</p>
            </div>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm space-y-8">
              <div className="flex items-center gap-8 border-b border-gray-100 pb-8">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-black text-3xl overflow-hidden border-2 border-gray-200 shadow-md">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>{fullName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}</span>
                    )}
                  </div>
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <Loader2 className="animate-spin text-white" size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Profile Picture</h3>
                  <p className="text-sm text-gray-400 mb-3">Upload your custom avatar (JPEG, PNG, WEBP).</p>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAvatarUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wide hover:bg-blue-600 transition-colors shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {avatarUploading ? 'Uploading...' : 'Change Avatar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Display Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-bold text-gray-900 placeholder:text-gray-400" placeholder="e.g. John Doe" />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Bio / About</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none transition-all font-medium text-gray-900 placeholder:text-gray-400 min-h-[120px]" placeholder="Tell us about yourself..." />
              </div>
            </div>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm space-y-8">
              <h3 className="font-black text-xl text-gray-900 uppercase">Login Details</h3>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Email Address</label>
                <input type="text" value={user.email} disabled className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl text-gray-500 font-bold cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Change Password</label>
                <div className="flex gap-4">
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-blue-600 focus:bg-white outline-none font-bold text-gray-900 placeholder:text-gray-400" placeholder="New password" />
                  <button onClick={handleUpdatePassword} className="px-8 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-colors">Update</button>
                </div>
              </div>
            </div>

            <ActionButtons onSave={handleSaveProfile} saving={saving} saveSuccess={saveSuccess} />
          </div>
        )}

        {/* TAB: ROLES */}
        {activeTab === 'roles' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Roles & Permissions</h2>
              <p className="text-gray-500 font-medium mt-2">Select how you want to interact with the marketplace.</p>
            </div>

            <div className="space-y-8">
              {roleError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
                  ⚠️ {roleError}
                </div>
              )}
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 italic">What do you want to do? (Select at least one)</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <RoleCard title="Customer" desc="I want to buy products." active={roles.includes('customer')} onClick={() => toggleRole('customer')} />
                  <RoleCard title="CAD Designer" desc="I want to sell models." active={roles.includes('designer')} onClick={() => toggleRole('designer')} />
                  <RoleCard title="3D Printer" desc="I want to offer printing services." active={roles.includes('printer')} onClick={() => toggleRole('printer')} />
                </div>
              </div>

              <div className="pt-4">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 italic">Account Type (Choose one)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <RoleCard title="Hobbyist / Maker" desc="I do this for fun." active={roles.includes('hobbyist')} onClick={() => toggleRole('hobbyist')} />
                  <RoleCard
                    title="Business / Studio"
                    desc="I represent a company."
                    active={roles.includes('business')}
                    onClick={() => toggleRole('business')}
                    disabled={true}
                    badge="Contact Sales"
                    onContactSales={() => setShowContactSales(true)}
                  />
                </div>
              </div>
            </div>

            <div className="bg-red-50 p-8 rounded-3xl border border-red-100 space-y-4 mt-8">
              <h3 className="font-black text-red-800 flex items-center gap-2 uppercase text-sm tracking-widest"><Trash2 size={18} /> Danger Zone</h3>
              <p className="text-red-600/80 text-sm font-medium">Once you delete your account, there is no going back. Please be certain.</p>
              <button onClick={() => setRoleError("Support contact is being updated. Please try again later.")} className="px-6 py-3 bg-white border border-red-200 text-red-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm">
                Delete Account
              </button>
            </div>

            <ActionButtons onSave={handleSaveProfile} saving={saving} saveSuccess={saveSuccess} />
          </div>
        )}

        {/* TAB: PREFERENCES (CURRENCY) */}
        {activeTab === 'preferences' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Regional Preferences</h2>
              <p className="text-gray-500 font-medium mt-2">Customize your currency and region settings.</p>
            </div>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm space-y-10">
              <div>
                <h3 className="font-black text-xl text-gray-900 mb-6 flex items-center gap-3 uppercase">
                  <Coins className="text-blue-600" size={24} /> Currency
                </h3>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed max-w-lg">
                  Choose your preferred currency. Prices across the store will be automatically converted from EUR based on real-time exchange rates.
                </p>

                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Display Currency</label>
                <div className="relative max-w-sm">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600">
                    <Coins size={20} />
                  </div>
                  <select
                    value={exchangeModal?.newCode || currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    disabled={saving}
                    className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer text-gray-900 disabled:opacity-50"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                </div>

                {/* EXCHANGE WARNING MODAL */}
                {exchangeModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-md w-full border border-gray-100 animate-in zoom-in-95 duration-300">
                      <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-3xl flex items-center justify-center mb-6 shadow-orange-500/10">
                        <AlertCircle size={32} />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-4">Currency Conversion Fee</h3>
                      <p className="text-gray-500 font-bold italic text-sm mb-8 leading-relaxed">
                        Converting your current balance to <span className="text-gray-900">{CURRENCIES.find(c => c.code === exchangeModal.newCode)?.label}</span> will incur a <span className="text-orange-600">3% transaction fee</span>.
                      </p>
                      
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-8 space-y-4">
                        <div className="flex justify-between items-center text-xs font-black uppercase text-gray-400 tracking-widest">
                          <span>Service Fee (3%)</span>
                          <span className="text-orange-600">-{formatPrice(exchangeModal.fee)}</span>
                        </div>
                        <div className="h-px bg-gray-200" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed text-center">
                          This fee applies only to your currently available funds. Future earnings will not be affected.
                        </p>
                      </div>

                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={confirmExchange}
                          disabled={saving}
                          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/10"
                        >
                          {saving ? <Loader2 className="animate-spin" size={18} /> : 'Accept & Convert'}
                        </button>
                        <button 
                          onClick={() => setExchangeModal(null)}
                          disabled={saving}
                          className="w-full py-4 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-50 hover:text-gray-900 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-100" />

              {/* Region Section */}
              <div>
                <h3 className="font-black text-xl text-gray-900 mb-6 flex items-center gap-3 uppercase">
                  <Globe className="text-blue-600" size={24} /> Region / Country
                </h3>
                <p className="text-gray-500 text-sm mb-8 leading-relaxed max-w-lg">
                  Select your country to calculate shipping rates, carrier options, and tax estimates in the checkout flow.
                </p>

                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Your Region</label>
                <div className="relative max-w-sm">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600">
                    <MapPin size={20} />
                  </div>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={saving}
                    className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer text-gray-900 disabled:opacity-50"
                  >
                    {DHL_COUNTRIES.map((c) => {
                      const codePoints = c.code
                        .toUpperCase()
                        .split('')
                        .map(char => 127397 + char.charCodeAt(0));
                      let flag = '';
                      try {
                        flag = String.fromCodePoint(...codePoints);
                      } catch (e) {}
                      return (
                        <option key={c.code} value={c.code}>
                          {flag} {c.name} ({c.code})
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                </div>
              </div>
            </div>

            <ActionButtons onSave={handleSaveProfile} saving={saving} saveSuccess={saveSuccess} />
          </div>
        )}

      </div>
      <ContactSalesModal isOpen={showContactSales} onClose={() => setShowContactSales(false)} userEmail={user?.email} />
    </main>
  );
}

function SidebarItem({ icon, label, id, active, set }: any) {
  const isActive = active === id;
  return (
    <button
      onClick={() => set(id)}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all duration-200 ${isActive
        ? 'bg-gray-900 text-white shadow-lg transform scale-105'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        }`}
    >
      {icon} <span className="text-sm">{label}</span>
      {isActive && <ChevronRight className="ml-auto opacity-100 text-white" size={16} strokeWidth={3} />}
    </button>
  );
}

function RoleCard({ title, desc, active, onClick, disabled, badge, onContactSales }: any) {
  return (
    <div
      onClick={disabled && onContactSales ? onContactSales : disabled ? undefined : onClick}
      className={`p-6 rounded-3xl border-2 transition-all relative overflow-hidden ${disabled
        ? 'border-amber-200/80 bg-amber-50/20 cursor-pointer hover:border-amber-400 hover:shadow-lg'
        : active
        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 cursor-pointer hover:scale-[1.02]'
        : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg cursor-pointer hover:scale-[1.02]'
        }`}
    >
      {badge && (
        <span className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 shadow-sm">
          {badge}
        </span>
      )}
      <h3 className={`font-black text-lg ${disabled ? 'text-gray-400' : active ? 'text-blue-900' : 'text-gray-900'}`}>{title}</h3>
      <p className="text-xs text-gray-500 mt-3 leading-relaxed font-bold">{desc}</p>
      {disabled ? (
        <div className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
          💬 Click to Contact Sales
        </div>
      ) : active ? (
        <div className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600"><Check size={14} strokeWidth={4} /> Selected</div>
      ) : null}
    </div>
  );
}

function ActionButtons({ onSave, saving, saveSuccess }: any) {
  return (
    <div className="fixed bottom-8 left-0 md:left-80 right-0 px-8 flex justify-end z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-10 duration-500">
        <div className="max-w-3xl w-full mx-auto flex justify-end">
        {saveSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in duration-500 p-6">
            <div className="text-center p-12 bg-[#111111] rounded-[40px] shadow-2xl flex flex-col items-center gap-6 transform animate-in zoom-in-95 duration-500 max-w-sm w-full mx-auto border border-white/5">
              <div className="w-20 h-20 bg-[#00d46a] text-white rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 animate-bounce">
                <Check size={40} strokeWidth={3} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tight uppercase leading-none">Success!</h2>
                <p className="text-gray-400 font-bold mt-3 text-xs italic">Settings updated successfully.</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="pointer-events-auto px-10 py-4 bg-gray-900 border-2 border-gray-900 text-white rounded-2xl font-black shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] hover:bg-blue-600 hover:border-blue-600 hover:shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] hover:-translate-y-1 transition-all flex items-center gap-3 transform active:scale-95 uppercase text-xs tracking-widest"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function ContactSalesModal({ isOpen, onClose, userEmail }: { isOpen: boolean; onClose: () => void; userEmail?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
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
          category: 'business_inquiry',
          subject: `Business Inquiry from ${name}`,
          message: `Company / Name: ${name}\nContact: ${email}\n\nMessage:\n${message}`,
          contact: email,
        }),
      });
      if (!res.ok) throw new Error('Failed to send inquiry');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 relative text-gray-900">
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 cursor-pointer">
          <X size={20} />
        </button>
        
        {sent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Inquiry Sent!</h3>
            <p className="text-xs text-gray-500 font-medium mb-6">Our sales team will contact your company within 24 hours.</p>
            <button onClick={onClose} className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-black uppercase text-xs tracking-widest cursor-pointer">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                Business & Enterprise
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-2">Contact Sales</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">Interested in a custom business account or volume manufacturing?</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold">{error}</div>
            )}

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Company / Your Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme 3D Studio"
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="contact@acme.com"
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Message / Fleet Requirements</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us about your company, volume, or custom integrations needed..."
                rows={3}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : 'Send Inquiry'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}