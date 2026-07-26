import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../../lib/adminAuth';

export async function GET(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { chatId } = await context.params;

    const [{ data: chat, error: chatError }, { data: messages, error: msgError }] = await Promise.all([
      supabaseAdmin
        .from('chats')
        .select(`
          id, created_at, updated_at, archived_at, completed_at, offer_id, order_id,
          buyer:profiles!chats_buyer_id_fkey(id, full_name, email, avatar_url),
          seller:profiles!chats_seller_id_fkey(id, full_name, email, avatar_url),
          offers(id, title, category, price, image_urls)
        `)
        .eq('id', chatId)
        .single(),
      supabaseAdmin
        .from('messages')
        .select('id, content, message_type, is_read, created_at, sender_id, profiles!messages_sender_id_fkey(full_name, avatar_url)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true }),
    ]);

    if (chatError) throw chatError;
    if (msgError) throw msgError;

    return NextResponse.json({ chat, messages: messages || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
