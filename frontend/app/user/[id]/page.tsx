'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { 
  MapPin, Calendar, Loader2, ArrowLeft, 
  Package, ShoppingBag, ArrowRight, User as UserIcon 
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!params.id) return;

      // 1. Pobierz dane profilu
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single();

      if (profileErr) {
        console.error(profileErr);
        router.push('/gallery');
        return;
      }

      // 2. Pobierz oferty tego użytkownika
      const { data: offersData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', params.id)
        .order('created_at', { ascending: false });

      setProfile(profileData);
      setOffers(offersData || []);
      setLoading(false);
    };

    fetchPublicData();
  }, [params.id, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
      
      {/* HEADER / NAVIGATION */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/gallery" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>
        <img src="/logo.jpg" alt="Printsi" className="h-6 w-auto" />
      </nav>

      {/* COVER SECTION */}
      <div className="h-48 bg-gray-900 relative">
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="relative -mt-16 mb-12 flex flex-col md:flex-row items-end gap-6">
          {/* AVATAR */}
          <div className="w-32 h-32 bg-white p-1 rounded-3xl shadow-xl flex-shrink-0">
            <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
               {profile?.avatar_url ? (
                 <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
               ) : (
                 <UserIcon size={48} className="text-gray-300" />
               )}
            </div>
          </div>
          
          <div className="flex-1 mb-2">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{profile?.full_name || 'Anonymous Maker'}</h1>
            <div className="flex flex-wrap gap-4 mt-2">
               <span className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider"><MapPin size={14}/> {profile?.country || 'Global'}</span>
               <span className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider"><Calendar size={14}/> Joined 2026</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* SIDEBAR: INFO */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black uppercase text-xs tracking-widest text-gray-400 mb-4">About Designer</h3>
              <p className="text-gray-600 text-sm leading-relaxed font-medium">
                {profile?.bio || "This creator hasn't shared a bio yet."}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black uppercase text-xs tracking-widest text-gray-400 mb-4">Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.roles?.map((role: string) => (
                  <span key={role} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-wide border border-gray-200">{role}</span>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT: OFFERS */}
          <div className="lg:col-span-3 space-y-6">
             <h2 className="text-xl font-black uppercase text-gray-900 flex items-center gap-3">
                <ShoppingBag className="text-blue-600" /> Listings by {profile?.full_name?.split(' ')[0]}
             </h2>

             {offers.length === 0 ? (
               <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                  <Package size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-400 font-bold uppercase text-xs">No active listings at the moment</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {offers.map((offer) => (
                   <Link key={offer.id} href={`/offer/${offer.id}`} className="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                      <div className="aspect-square relative overflow-hidden bg-gray-50">
                        <img 
                          src={offer.image_urls?.[0] || '/placeholder.jpg'} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        />
                        <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[8px] font-black uppercase tracking-wider">
                          {offer.category}
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{offer.title}</h4>
                          <p className="text-blue-600 font-black text-sm">€{offer.price}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
                           <ArrowRight size={16} />
                        </div>
                      </div>
                   </Link>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </main>
  );
}