import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendNewMessageEmail, getUserEmailInfo } from '@/app/lib/sendNotificationEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/order/new-message-email
 * Sends a notification email when a new chat message is sent.
 * Throttled: only sends if the last email for this chat was > 15 min ago
 * to avoid spamming.
 */

// Simple in-memory throttle to avoid flooding inboxes
const lastSentMap = new Map<string, number>();
const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const { chatId, senderId, content } = await req.json();

    if (!chatId || !senderId || !content) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Skip system/proposal messages
    if (content.startsWith('[PROPOSAL]') || content.startsWith('[') || content.length < 2) {
      return NextResponse.json({ success: true, skipped: 'system message' });
    }

    // Throttle check
    const throttleKey = `${chatId}`;
    const lastSent = lastSentMap.get(throttleKey) || 0;
    if (Date.now() - lastSent < THROTTLE_MS) {
      return NextResponse.json({ success: true, skipped: 'throttled' });
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

    // Determine recipient (the other person)
    const recipientId = senderId === chat.buyer_id ? chat.seller_id : chat.buyer_id;
    const productTitle = (chat as any).offers?.title || 'a product';

    // Get sender name
    const senderInfo = await getUserEmailInfo(senderId);
    const senderName = senderInfo?.name || 'Someone';

    // Send email
    await sendNewMessageEmail(recipientId, senderName, productTitle, content);

    // Update throttle
    lastSentMap.set(throttleKey, Date.now());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ New message email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
