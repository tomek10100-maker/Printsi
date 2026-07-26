import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../../lib/adminAuth';

export async function GET(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { chatId } = await context.params;

    const [
      { data: chat, error: chatError },
      { data: messages, error: msgError },
      { data: profiles },
      { data: offers },
      emailMap,
    ] = await Promise.all([
      supabaseAdmin
        .from('chats')
        .select('id, created_at, updated_at, archived_at, completed_at, offer_id, order_id, buyer_id, seller_id')
        .eq('id', chatId)
        .single(),
      supabaseAdmin
        .from('messages')
        .select('id, content, message_type, is_read, created_at, sender_id')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('profiles').select('id, full_name, avatar_url'),
      supabaseAdmin.from('offers').select('id, title, category, price, image_urls'),
      getAuthEmailMap(),
    ]);

    if (chatError) throw chatError;
    if (msgError) throw msgError;

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    const offerMap: Record<string, any> = {};
    (offers || []).forEach(o => { offerMap[o.id] = o; });

    const bProf = chat ? profileMap[chat.buyer_id] : null;
    const sProf = chat ? profileMap[chat.seller_id] : null;

    const enrichedChat = chat ? {
      ...chat,
      buyer: bProf ? { ...bProf, email: emailMap[chat.buyer_id] || '' } : null,
      seller: sProf ? { ...sProf, email: emailMap[chat.seller_id] || '' } : null,
      offers: offerMap[chat.offer_id] || null,
    } : null;

    const enrichedMessages = (messages || []).map((m: any) => ({
      ...m,
      profiles: profileMap[m.sender_id] || null,
    }));

    return NextResponse.json({ chat: enrichedChat, messages: enrichedMessages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
