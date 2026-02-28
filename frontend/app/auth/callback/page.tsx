'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// This page handles the redirect after Google OAuth.
// Supabase sends the user here, we check if they need onboarding, then route them.
export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            // Wait briefly for Supabase to process the OAuth session from the URL hash
            await new Promise((res) => setTimeout(res, 800));

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                // Something went wrong — send to login
                router.replace('/login');
                return;
            }

            // Check if this user has completed onboarding
            const { data: profile } = await supabase
                .from('profiles')
                .select('onboarding_complete')
                .eq('id', user.id)
                .single();

            if (!profile || !profile.onboarding_complete) {
                router.replace('/onboarding');
            } else {
                router.replace('/');
            }
        };

        handleCallback();
    }, [router]);

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center gap-4">
            <img src="/logo.jpg" alt="Printsi Logo" className="h-9 w-auto mb-4 opacity-80" />
            <Loader2 className="animate-spin text-blue-400" size={36} />
            <p className="text-slate-400 text-sm font-medium">Signing you in...</p>
        </main>
    );
}
