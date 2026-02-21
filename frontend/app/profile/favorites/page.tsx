'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Loader2, Trash2, Package } from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FavoritesPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data, error } = await supabase
        .from('favorites')
        .select('*, offers(*)')
        .eq('user_id', user.id);

      if (error) console.error(error);
      setFavorites(data || []);
      setLoading(false);
    };
    fetchFavorites();
  }, [router]);

  const removeFavorite = async (id: string) => {
    setFavorites(favorites.filter(fav => fav.id !== id));
    await supabase.from('favorites').delete().eq('id', id);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6 font-sans text-gray-900">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
          {/* Changed text-gray-500 to text-gray-900 */}
          <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          {/* Added text-gray-900 to ensure heading is dark */}
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-gray-900">
             <Heart className="text-red-500 fill-red-500" /> My Collection
          </h1>
        </div>

        {/* LIST */}
        {favorites.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Heart className="mx-auto mb-4 text-gray-200" size={48} />
              <h3 className="text-lg font-bold text-gray-900">It's empty here</h3>
              {/* Changed text-gray-400 to text-gray-900 */}
              <p className="text-gray-900 text-sm mt-1 font-medium">Save items you love for later.</p>
              <Link href="/gallery" className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Explore Gallery</Link>
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => {
              const offer = fav.offers;
              if (!offer) return null; 

              return (
                <div key={fav.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group flex flex-col">
                   <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden mb-4 relative">
                      {offer.image_urls?.[0] ? (
                        <img src={offer.image_urls[0]} alt={offer.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={32}/></div>
                      )}
                      
                      <button 
                        onClick={() => removeFavorite(fav.id)}
                        className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur rounded-full text-red-500 hover:bg-red-50 transition shadow-sm"
                        title="Remove from collection"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                   
                   <h3 className="font-bold text-gray-900 line-clamp-1">{offer.title}</h3>
                   <p className="text-blue-600 font-bold text-lg mt-1">{formatPrice(offer.price)}</p>
                   
                   <div className="mt-4 flex gap-2">
                     <Link href={`/offer/${offer.id}`} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center hover:bg-blue-600 transition">
                        View
                     </Link>
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}