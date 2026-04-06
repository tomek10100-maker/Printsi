'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DebugPage() {
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<any[]>([]);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase.from('offers').select('*').eq('user_id', user.id);
        setOffers(data || []);
      }
      const { data: all } = await supabase.from('offers').select('id, title, user_id').limit(5);
      setAllOffers(all || []);
    }
    check();
  }, []);

  return (
    <div className="p-10 bg-white text-black min-h-screen">
      <h1 className="text-2xl font-bold">Debug Offers</h1>
      <p>My User ID: {user?.id}</p>
      <h2 className="mt-4 font-bold">My Offers ({offers.length}):</h2>
      <pre className="bg-gray-100 p-4 rounded mt-2">{JSON.stringify(offers, null, 2)}</pre>
      
      <h2 className="mt-8 font-bold">Latest 5 Global Offers:</h2>
      <pre className="bg-gray-100 p-4 rounded mt-2">{JSON.stringify(allOffers, null, 2)}</pre>
    </div>
  );
}
