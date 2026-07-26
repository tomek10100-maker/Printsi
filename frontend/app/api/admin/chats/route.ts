import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [
      { data: chats, error: chatsErr },
      { data: profiles },
      { data: offers },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin
        .from('chats')
        .select('id, created_at, updated_at, archived_at, completed_at, offer_id, order_id, buyer_id, seller_id')
        .order('updated_at', { ascending: false }),
      supabaseAdmin.from('profiles').select('id, full_name, avatar_url'),
      supabaseAdmin.from('offers').select('id, title, category, price, image_urls'),
      getAuthEmailMap(),
    ]);

    if (chatsErr) throw chatsErr;

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    const offerMap: Record<string, any> = {};
    (offers || []).forEach(o => { offerMap[o.id] = o; });

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

    const enriched = (chats || []).map((chat: any) => {
      const bProf = profileMap[chat.buyer_id];
      const sProf = profileMap[chat.seller_id];
      return {
        ...chat,
        buyer: bProf ? { ...bProf, email: emailMap[chat.buyer_id] || '' } : null,
        seller: sProf ? { ...sProf, email: emailMap[chat.seller_id] || '' } : null,
        offers: offerMap[chat.offer_id] || null,
        messageCount: countByChat[chat.id] || 0,
      };
    });

    return NextResponse.json({ chats: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
