'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function AuthGuard() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkUser = async () => {
            // Don't guard public routes
            if (pathname === '/login' || pathname === '/onboarding') return;

            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // user is not logged in, but allowed to view homepage and gallery
                return;
            }

            // Check if user has roles
            const { data: profile } = await supabase
                .from('profiles')
                .select('roles')
                .eq('id', session.user.id)
                .single();

            // If missing roles, force onboarding
            if (!profile?.roles || profile.roles.length === 0) {
                router.push('/onboarding');
            }
        };

        checkUser();
    }, [pathname, router]);

    return null;
}
