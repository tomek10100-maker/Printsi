import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, EmailTemplates } from '@/app/lib/emailService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate recovery link using service role bypass
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${SITE_URL}/reset-password`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Generate link error:', linkError);
      // Fail silently to prevent email enumeration
      return NextResponse.json({ success: true, fake: true });
    }

    const actionLink = linkData.properties.action_link;

    // Fetch user profile for their name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', linkData.user.id)
      .single();

    const name = profile?.full_name || email.split('@')[0];

    const html = EmailTemplates.resetPassword(name, actionLink);

    await sendEmail({
      to: email,
      subject: '🔒 Reset Your Password - Printsi',
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Reset password error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
