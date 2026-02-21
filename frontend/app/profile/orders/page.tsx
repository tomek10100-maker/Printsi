'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Loader2, CheckCircle, Truck, Clock } from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function OrderHistoryPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id) // <--- ZMIANA: szukamy po buyer_id
        .order('created_at', { ascending: false });

      if (error) console.error('Error fetching orders:', error);
      setOrders(data || []);
      setLoading(false);
    };
    fetchOrders();
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6 font-sans text-gray-900">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
             <Package className="text-blue-600" /> Order History
          </h1>
        </div>

        {orders.length === 0 ? (
           <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Package className="mx-auto mb-4 text-gray-200" size={48} />
              <h3 className="text-lg font-bold text-gray-900">No orders yet</h3>
              <p className="text-gray-400 text-sm mt-1">Looks like you haven't bought anything yet.</p>
           </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-blue-200 transition-all">
                 
                 <div className="flex items-start gap-4">
                    <div className={`mt-1 p-3 rounded-full ${order.status === 'paid' ? 'bg-green-100 text-green-600' : order.status === 'shipped' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                       {order.status === 'paid' ? <CheckCircle size={24}/> : order.status === 'shipped' ? <Truck size={24}/> : <Clock size={24}/>}
                    </div>
                    <div>
                       <h3 className="font-bold text-gray-900 text-lg">Order #{order.id.slice(0, 8)}</h3>
                       <p className="text-gray-500 text-sm mb-2">{new Date(order.created_at).toLocaleDateString()}</p>
                       <p className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                          {order.items_summary || "Items list not available"}
                       </p>
                    </div>
                 </div>

                 <div className="text-right flex flex-col items-end">
                    <span className="text-2xl font-black text-gray-900">{formatPrice(order.total_amount)}</span>
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full mt-2 ${
                        order.status === 'paid' ? 'bg-green-100 text-green-700' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                        {order.status}
                    </span>
                 </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}