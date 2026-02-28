'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  User, Shield, LayoutGrid, LogOut, Check, ChevronRight, Eye, Trash2, Globe, Menu, X, Coins
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PEŁNA LISTA 15 WALUT
const CURRENCIES = [
  { code: 'EUR', label: '🇪🇺 Euro (€)' },
  { code: 'USD', label: '🇺🇸 US Dollar ($)' },
  { code: 'GBP', label: '🇬🇧 British Pound (£)' },
  { code: 'PLN', label: '🇵🇱 Polski Złoty (zł)' },
  { code: 'SEK', label: '🇸🇪 Swedish Krona (kr)' },
  { code: 'NOK', label: '🇳🇴 Norwegian Krone (kr)' },
  { code: 'DKK', label: '🇩🇰 Danish Krone (kr)' },
  { code: 'CHF', label: '🇨🇭 Swiss Franc (Fr)' },
  { code: 'CZK', label: '🇨🇿 Czech Koruna (Kč)' },
  { code: 'HUF', label: '🇭🇺 Hungarian Forint (Ft)' },
  { code: 'RON', label: '🇷🇴 Romanian Leu (lei)' },
  { code: 'BGN', label: '🇧🇬 Bulgarian Lev (лв)' },
  { code: 'ISK', label: '🇮🇸 Icelandic Króna (kr)' },
  { code: 'TRY', label: '🇹🇷 Turkish Lira (₺)' },
  { code: 'UAH', label: '🇺🇦 Ukrainian Hryvnia (₴)' }, // Note: Może wymagać ręcznego kursu jeśli API nie zwróci
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('general');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { currency, setCurrency } = useCurrency();

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');

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
      }
      setLoading(false);
    };
    getData();
  }, [router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updates = {
        id: user.id,
        full_name: fullName,
        bio,
        roles,
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);
      if (error) throw error;
      alert('Profile updated successfully!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return alert("Enter a new password");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else alert("Password updated successfully!");
  };

  const toggleRole = (role: string) => {
    let newRoles = [...roles];

    if (role === 'business') {
      newRoles = newRoles.filter(r => r !== 'hobbyist');
    } else if (role === 'hobbyist') {
      newRoles = newRoles.filter(r => r !== 'business');
    }

    if (newRoles.includes(role)) {
      setRoles(newRoles.filter(r => r !== role));
    } else {
      setRoles([...newRoles, role]);
    }
  };

  const handleCurrencyChange = async (newCode: string) => {
    setCurrency(newCode as any);
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
        fixed md:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 min-h-screen flex flex-col transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-8 border-b border-gray-100">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-gray-900 uppercase">
            <LayoutGrid className="text-blue-600" /> Settings
          </h1>
        </div>

        <nav className="p-6 space-y-2 flex-1">
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

        <div className="p-6 border-t border-gray-100">
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
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-black text-3xl overflow-hidden">
                  {user.email[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Profile Picture</h3>
                  <p className="text-sm text-gray-400 mb-3">We use Gravatar or upload your own.</p>
                  <button className="px-5 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-blue-600 transition-colors">Change Avatar</button>
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

            <ActionButtons onSave={handleSaveProfile} saving={saving} />
          </div>
        )}

        {/* TAB: ROLES */}
        {activeTab === 'roles' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Roles & Permissions</h2>
              <p className="text-gray-500 font-medium mt-2">Select how you want to interact with the marketplace.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RoleCard title="Customer" desc="I want to buy products." active={roles.includes('customer')} onClick={() => toggleRole('customer')} />
              <RoleCard title="CAD Designer" desc="I want to sell models." active={roles.includes('designer')} onClick={() => toggleRole('designer')} />
              <RoleCard title="3D Printer" desc="I want to offer printing services." active={roles.includes('printer')} onClick={() => toggleRole('printer')} />
              <RoleCard title="Business / Studio" desc="I represent a company." active={roles.includes('business')} onClick={() => toggleRole('business')} />
              <RoleCard title="Hobbyist / Maker" desc="I do this for fun." active={roles.includes('hobbyist')} onClick={() => toggleRole('hobbyist')} />
            </div>

            <div className="bg-red-50 p-8 rounded-3xl border border-red-100 space-y-4 mt-8">
              <h3 className="font-black text-red-800 flex items-center gap-2 uppercase text-sm tracking-widest"><Trash2 size={18} /> Danger Zone</h3>
              <p className="text-red-600/80 text-sm font-medium">Once you delete your account, there is no going back. Please be certain.</p>
              <button onClick={() => alert("Contact support.")} className="px-6 py-3 bg-white border border-red-200 text-red-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm">
                Delete Account
              </button>
            </div>

            <ActionButtons onSave={handleSaveProfile} saving={saving} />
          </div>
        )}

        {/* TAB: PREFERENCES (CURRENCY) */}
        {activeTab === 'preferences' && (
          <div className="max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tight">Regional Preferences</h2>
              <p className="text-gray-500 font-medium mt-2">Customize your currency and region settings.</p>
            </div>

            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm space-y-8">
              <div>
                <h3 className="font-black text-xl text-gray-900 mb-6 flex items-center gap-3 uppercase">
                  <Globe className="text-blue-600" size={24} /> Currency
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
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all appearance-none cursor-pointer text-gray-900"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 font-bold text-xs">▼</div>
                </div>
              </div>
            </div>

            <ActionButtons onSave={() => alert(`Currency changed to ${currency} and saved!`)} saving={false} />
          </div>
        )}

      </div>
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

function RoleCard({ title, desc, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-3xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${active
        ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
        : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg'
        }`}
    >
      <h3 className={`font-black text-lg ${active ? 'text-blue-900' : 'text-gray-900'}`}>{title}</h3>
      <p className="text-xs text-gray-500 mt-3 leading-relaxed font-bold">{desc}</p>
      {active && <div className="mt-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-600"><Check size={14} strokeWidth={4} /> Selected</div>}
    </div>
  );
}

function ActionButtons({ onSave, saving }: any) {
  return (
    <div className="fixed bottom-8 left-0 md:left-80 right-0 px-8 flex justify-end z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="max-w-3xl w-full mx-auto flex justify-end">
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