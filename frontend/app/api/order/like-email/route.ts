import { NextResponse } from 'next/server';
import { sendLikeEmail } from '@/app/lib/sendNotificationEmail';

export async function POST(req: Request) {
  try {
    const { sellerId, productTitle } = await req.json();

    if (!sellerId || !productTitle) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    await sendLikeEmail(sellerId, productTitle);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Like email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
