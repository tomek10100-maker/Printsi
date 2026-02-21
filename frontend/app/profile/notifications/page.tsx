'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, ShoppingBag, CreditCard, Loader2, Trash2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    setNotifications(data || []);
    setLoading(false);

    if (data && data.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);

    if (error) {
      console.error("Error deleting notification:", error);
      alert("Failed to delete notification.");
      fetchNotifications();
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
          {/* Zmieniono na text-gray-900 dla lepszej widoczności */}
          <Link href="/profile" className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-900 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900">Notifications</h1>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
               <Bell className="mx-auto mb-4 text-gray-200" size={48} />
               {/* Zmieniono text-gray-400 na text-gray-900 */}
               <p className="text-gray-900 font-bold uppercase text-xs">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`p-6 rounded-2xl border transition-all flex gap-4 items-start ${n.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-100 shadow-sm'}`}>
                <div className={`p-3 rounded-full ${n.type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                   {n.type === 'sale' ? <CreditCard size={20}/> : <ShoppingBag size={20}/>}
                </div>
                <div className="flex-1">
                   <h3 className="font-bold text-gray-900 flex items-center gap-2">
                     {n.title}
                     {!n.is_read && <span className="w-2 h-2 bg-blue-600 rounded-full"></span>}
                   </h3>
                   {/* Zmieniono text-gray-500 na text-gray-900 */}
                   <p className="text-sm text-gray-900 mt-1 font-medium">{n.message}</p>
                   {/* Zmieniono text-gray-400 na text-gray-900 */}
                   <span className="text-[10px] text-gray-900 mt-2 block font-black uppercase">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => deleteNotification(n.id)} 
                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all p-2"
                  title="Delete notification"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}