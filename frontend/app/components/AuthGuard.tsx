'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

export function AuthGuard() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkUser = async () => {
            // Don't guard public routes
            if (pathname === '/login' || pathname === '/onboarding') return;

            const { data: { session }, error } = await supabase.auth.getSession();

            if (error && (error.message.includes('Refresh Token') || error.message.includes('invalid refresh token'))) {
                await supabase.auth.signOut();
                if (pathname !== '/') router.push('/login');
                return;
            }

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

            // Jeśli profil nie jest zweryfikowany, sprawdzamy czy to użytkownik Google
            if (profile && profile.is_verified === false) {
                const isGoogleUser = session.user.app_metadata?.provider === 'google';
                
                if (isGoogleUser) {
                    // Automatycznie weryfikujemy użytkowników Google w bazie profilu
                    await supabase.from('profiles').update({ is_verified: true }).eq('id', session.user.id);
                } else {
                    await supabase.auth.signOut();
                    router.push('/login');
                    return;
                }
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
