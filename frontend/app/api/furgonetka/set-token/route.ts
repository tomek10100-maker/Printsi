import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../../../lib/adminAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_service_key_for_build')
);

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    const isAdmin = await verifyAdmin(req);
    const isValidSecret = Boolean(process.env.FURGONETKA_WEBHOOK_SECRET && secret === process.env.FURGONETKA_WEBHOOK_SECRET);

    if (!isAdmin && !isValidSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return NextResponse.json({ error: 'Missing access_token or refresh_token' }, { status: 400 });
    }

    const { error } = await supabase.from('furgonetka_tokens').upsert({
      id: 1,
      access_token,
      refresh_token,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tokens saved to Supabase successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
