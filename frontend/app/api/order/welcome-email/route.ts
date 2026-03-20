import { NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/app/lib/sendNotificationEmail';

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    await sendWelcomeEmail(email, name);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Welcome email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
