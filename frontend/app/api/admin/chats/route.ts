import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [
      { data: chats, error },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin
        .from('chats')
        .select(`
          id,
          created_at,
          updated_at,
          archived_at,
          completed_at,
          offer_id,
          order_id,
          buyer_id,
          seller_id,
          buyer:profiles!chats_buyer_id_fkey(full_name, avatar_url),
          seller:profiles!chats_seller_id_fkey(full_name, avatar_url),
          offers(title, category, price, image_urls)
        `)
        .order('updated_at', { ascending: false }),
      getAuthEmailMap(),
    ]);

    if (error) throw error;

    // Get message counts per chat
    const chatIds = (chats || []).map(c => c.id);
    const { data: msgCounts } = chatIds.length > 0
      ? await supabaseAdmin
          .from('messages')
          .select('chat_id')
          .in('chat_id', chatIds)
      : { data: [] };

    const countByChat: Record<string, number> = {};
    (msgCounts || []).forEach(m => {
      countByChat[m.chat_id] = (countByChat[m.chat_id] || 0) + 1;
    });

    const enriched = (chats || []).map((chat: any) => ({
      ...chat,
      buyer: chat.buyer ? { ...chat.buyer, email: emailMap[chat.buyer_id] || '' } : null,
      seller: chat.seller ? { ...chat.seller, email: emailMap[chat.seller_id] || '' } : null,
      messageCount: countByChat[chat.id] || 0,
    }));

    return NextResponse.json({ chats: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
