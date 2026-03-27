import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Find profile by token
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('id, is_verified')
      .eq('verification_token', token)
      .single();

    if (pError || !profile) {
      return NextResponse.json({ error: 'Invalid or inactive verification link.' }, { status: 404 });
    }

    if (profile.is_verified) {
      return NextResponse.json({ success: true, message: 'Account already verified!' });
    }

    // 2. Update profile verified status
    const { error: uError } = await supabase
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', profile.id);

    if (uError) throw uError;

    // 3. Ręcznie potwierdź e-mail w bazowym systemie autoryzacji Supabase
    const { error: authError } = await supabase.auth.admin.updateUserById(
      profile.id,
      { email_confirm: true }
    );

    if (authError) {
      console.error('Failed to confirm auth user:', authError);
      // Ignorujemy błąd, by nie blokować procesu, ew. jest już zapobiegliwio OFF
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Verify token error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
