'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

export function AuthGuard() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkUser = async () => {
            // Don't guard public and auth flow routes
            const UNGUARDED_PATHS = [
                '/login',
                '/forgot-password',
                '/reset-password',
                '/auth/callback',
                '/verify',
                '/verify-email',
                '/onboarding',
            ];

            const isUnguarded = UNGUARDED_PATHS.some(path => 
                pathname === path || pathname.startsWith(path + '/')
            );

            if (isUnguarded) return;

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

            // Skip verification check for social logins (Google, etc.)
            const isSocialLogin = session.user.app_metadata.provider !== 'email';

            // Jeśli profil nie jest zweryfikowany I nie jest to logowanie społecznościowe
            if (profile && profile.is_verified === false && !isSocialLogin) {
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
