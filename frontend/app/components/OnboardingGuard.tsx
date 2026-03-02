`'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const EXEMPT_PATHS = ['/onboarding', '/login', '/auth'];
const SESSION_KEY = 'printsi_onboarding_ok';

export default function OnboardingGuard() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Don't run on exempt pages
        if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return;

        // Already confirmed this session — don't re-check on every navigation
        if (sessionStorage.getItem(SESSION_KEY) === 'true') return;

        const check = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            // Not logged in — nothing to guard
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('onboarding_complete')
                .eq('id', user.id)
                .single();

            if (profile?.onboarding_complete) {
                // Cache so we never check again this session
                sessionStorage.setItem(SESSION_KEY, 'true');
            } else {
                router.replace('/onboarding');
            }
        };

        check();
        // Only run on first mount, not on every navigation
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
