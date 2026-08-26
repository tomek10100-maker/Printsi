import { NextResponse } from 'next/server';
import { sendVerificationReadyEmail } from '@/app/lib/sendNotificationEmail';

export async function POST(req: Request) {
  try {
    const { buyerId, productTitle, sellerName, photoCount } = await req.json();
    if (!buyerId) {
      return NextResponse.json({ success: false, error: 'buyerId is required' }, { status: 400 });
    }

    await sendVerificationReadyEmail(
      buyerId,
      productTitle || '3D Printed Item',
      sellerName || 'Seller',
      photoCount || 1
    );

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (err: any) {
    console.error('[Verification Email API] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
