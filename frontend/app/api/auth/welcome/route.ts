import { NextResponse } from 'next/server';
import { sendEmail, EmailTemplates } from '@/app/lib/emailService';

export async function POST(req: Request) {
  try {
    const { email, fullName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Send the welcome email
    // Note: We use the 'welcome' template which is already in emailService.ts
    const html = EmailTemplates.welcome(fullName || email.split('@')[0]);
    
    await sendEmail({
      to: email,
      subject: '🎉 Welcome to Printsi! Let\'s get started',
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Welcome email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
