import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
        global: {
            // Suppress internal fetch errors from printing to console
            fetch: (...args) => {
                return fetch(...args).catch((err) => {
                    // Silently swallow network errors – Supabase will retry automatically
                    return Promise.reject(err);
                });
            },
        },
    }
);
