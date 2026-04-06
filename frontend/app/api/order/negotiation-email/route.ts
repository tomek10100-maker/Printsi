import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  sendOfferEmail, 
  sendCounterOfferEmail, 
  sendSellerOfferEmail,
  sendOfferAcceptedEmail, 
  sendOfferRejectedEmail,
  getUserEmailInfo
} from '@/app/lib/sendNotificationEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/order/negotiation-email
 * Sends a notification email when a negotiation step occurs (offer, counter, accept, reject).
 */

export async function POST(req: Request) {
  try {
    const { chatId, senderId, type, price, productTitle } = await req.json();

    if (!chatId || !senderId || !type) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Fetch chat info to determine recipient
    const { data: chat } = await supabase
      .from('chats')
      .select('buyer_id, seller_id, offer_id, offers(title)')
      .eq('id', chatId)
      .single();

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const recipientId = senderId === chat.buyer_id ? chat.seller_id : chat.buyer_id;
    const resolvedProductTitle = productTitle || (chat as any).offers?.title || 'a product';
    
    // Get sender info
    const senderInfo = await getUserEmailInfo(senderId);
    const senderName = senderInfo?.name || 'Someone';

    switch (type) {
      case 'new_offer':
        await sendOfferEmail(recipientId, senderName, resolvedProductTitle, price);
        break;
      case 'counter_offer':
        await sendCounterOfferEmail(recipientId, senderName, resolvedProductTitle, price);
        break;
      case 'seller_offer':
        await sendSellerOfferEmail(recipientId, senderName, resolvedProductTitle, price);
        break;
      case 'accept':
        // Determine role of recipient
        const role = recipientId === chat.buyer_id ? 'buyer' : 'seller';
        await sendOfferAcceptedEmail(recipientId, senderName, resolvedProductTitle, role);
        break;
      case 'reject':
        await sendOfferRejectedEmail(recipientId, senderName, resolvedProductTitle);
        break;
      default:
        console.warn(`⚠️ Unknown negotiation email type: ${type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Negotiation email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
