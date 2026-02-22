'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Bell, X, ShoppingBag, CreditCard } from 'lucide-react';
import Link from 'next/link';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Toast {
    id: string;
    title: string;
    message: string;
    type: string;
}

export default function NotificationToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Get current user
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) setUserId(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!userId) return;

        // Subscribe to real-time new notifications for this user
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const notif = payload.new as any;
                    const newToast: Toast = {
                        id: notif.id,
                        title: notif.title,
                        message: notif.message,
                        type: notif.type,
                    };
                    setToasts((prev) => [...prev, newToast]);

                    // Auto-dismiss after 6 seconds
                    setTimeout(() => {
                        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
                    }, 6000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const dismiss = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="bg-white border border-gray-100 rounded-2xl shadow-2xl p-4 flex gap-3 items-start animate-slide-in"
                    style={{
                        animation: 'slideIn 0.3s ease-out',
                    }}
                >
                    {/* Icon */}
                    <div className={`p-2 rounded-xl flex-shrink-0 ${toast.type === 'sale' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {toast.type === 'sale' ? <CreditCard size={18} /> : <Bell size={18} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-sm leading-tight">{toast.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium leading-relaxed line-clamp-2">{toast.message}</p>
                        <Link
                            href="/profile/notifications"
                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline mt-1 inline-block"
                            onClick={() => dismiss(toast.id)}
                        >
                            View all →
                        </Link>
                    </div>

                    {/* Dismiss */}
                    <button
                        onClick={() => dismiss(toast.id)}
                        className="text-gray-300 hover:text-gray-600 transition flex-shrink-0 p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}

            <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
        </div>
    );
}
