import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from '@/app/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // We need to reach any profile bypass RLS
);

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'User ID and email are required' }, { status: 400 });
    }

    // 1. Fetch the newly created profile's verification token
    let { data: profile } = await supabase
      .from('profiles')
      .select('verification_token, full_name')
      .eq('id', userId)
      .single();
    
    let token = profile?.verification_token;
    let fullName = profile?.full_name || email.split('@')[0];

    // If no token or no profile (race condition with DB triggers or old profile), generate a new one
    if (!token) {
      token = crypto.randomUUID();
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, verification_token: token, is_verified: false, full_name: fullName })
        .eq('id', userId);
        
      if (upsertError) {
        console.error('Failed to update verification token', upsertError);
      }
    }

    // 2. Build the link
    const verificationLink = `${SITE_URL}/verify?token=${token}`;

    // 3. Send email
    const html = EmailTemplates.verification(fullName, verificationLink);
    
    await sendEmail({
      to: email,
      subject: '🛡️ Official Printsi Verification Link',
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Send verification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
