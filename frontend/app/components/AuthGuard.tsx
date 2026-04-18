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

            // Fetch roles and verification status
            const { data: profile } = await supabase
                .from('profiles')
                .select('roles, is_verified')
                .eq('id', session.user.id)
                .single();

            // Jeśli profil nie jest zweryfikowany, uniemożliwiamy mu bycie po zalogowanej stronie
            if (profile && profile.is_verified === false) {
                await supabase.auth.signOut();
                router.push('/login');
                return;
            }

            // If missing roles, force onboarding
            if (!profile?.roles || profile.roles.length === 0) {
                router.push('/onboarding');
            }
        };

        checkUser();
    }, [pathname, router]);

    return null;
}
