'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, MapPin, Loader2, Phone, Globe } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AddressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Stan Formularza
  const [formData, setFormData] = useState({
    address: '',
    city: '',
    zip_code: '',
    country: 'Poland',
    phone_number: ''
  });

  // 1. Pobierz dane
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('address, city, zip_code, country, phone_number')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFormData({
          address: profile.address || '',
          city: profile.city || '',
          zip_code: profile.zip_code || '',
          country: profile.country || 'Poland',
          phone_number: profile.phone_number || ''
        });
      }
      setLoading(false);
    };
    fetchData();
  }, [router]);

  // 2. Zapisz dane
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          address: formData.address,
          city: formData.city,
          zip_code: formData.zip_code,
          country: formData.country,
          phone_number: formData.phone_number,
          updated_at: new Date()
        })
        .eq('id', user.id);

      if (error) throw error;
      alert('Address saved successfully!');
      router.push('/profile'); // Wróć do profilu po zapisaniu
    } catch (error: any) {
      alert('Error saving address: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black uppercase text-gray-900 tracking-tight">Shipping Address</h1>
            <p className="text-gray-500 text-sm font-medium">This address will be pre-filled at checkout.</p>
          </div>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSave} className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Street Address</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g. Kwiatowa 12/5"
                className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">City</label>
              <input 
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Warsaw"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Zip Code</label>
              <input 
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                placeholder="00-001"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Country</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all appearance-none"
                >
                  <option value="Poland">Poland</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="USA">USA</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  placeholder="+48 123 456 789"
                  className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Save Address</>}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}