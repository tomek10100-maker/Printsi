import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceKey
);

/**
 * Verifies that the request comes from an authenticated admin user.
 * Returns the userId if valid, or sends a 401/403 response and returns null.
 */
export async function verifyAdmin(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  if (!token || token === 'undefined' || token === 'null') return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    console.warn('verifyAdmin: auth.getUser failed:', error?.message);
    return null;
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('roles')
    .eq('id', user.id)
    .single();

  if (profErr) {
    console.warn('verifyAdmin: profile query failed:', profErr.message);
  }

  if (!profile?.roles?.includes('admin')) {
    console.warn('verifyAdmin: roles missing admin:', profile?.roles);
    return null;
  }

  return user.id;
}

export const UNAUTHORIZED = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export const FORBIDDEN = () =>
  NextResponse.json({ error: 'Forbidden — admin access only' }, { status: 403 });

let cachedEmailMap: { map: Record<string, string>; expires: number } | null = null;
let cachedUserMap: { map: Record<string, { email: string; createdAt: string }>; expires: number } | null = null;

export async function getAuthEmailMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedEmailMap && cachedEmailMap.expires > now) {
    return cachedEmailMap.map;
  }

  const emailMap: Record<string, string> = {};
  try {
    const res = await supabaseAdmin.auth.admin.listUsers();
    if (res?.data?.users) {
      res.data.users.forEach((u: any) => {
        if (u.id && u.email) emailMap[u.id] = u.email;
      });
    }
    cachedEmailMap = { map: emailMap, expires: now + 60000 };
  } catch (err) {
    console.warn('getAuthEmailMap failed:', err);
  }
  return emailMap;
}

export async function getAuthUserMap(): Promise<Record<string, { email: string; createdAt: string }>> {
  const now = Date.now();
  if (cachedUserMap && cachedUserMap.expires > now) {
    return cachedUserMap.map;
  }

  const userMap: Record<string, { email: string; createdAt: string }> = {};
  try {
    const res = await supabaseAdmin.auth.admin.listUsers();
    if (res?.data?.users) {
      res.data.users.forEach((u: any) => {
        if (u.id) {
          userMap[u.id] = {
            email: u.email || '',
            createdAt: u.created_at || '',
          };
        }
      });
    }
    cachedUserMap = { map: userMap, expires: now + 60000 };
  } catch (err) {
    console.warn('getAuthUserMap failed:', err);
  }
  return userMap;
}
