import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../../../lib/adminAuth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  const { chatId } = await params;

  try {
    const { content } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: adminId,
        content: content.trim(),
        message_type: 'admin_chat',
      })
      .select()
      .single();

    if (error) throw error;

    // Update chat updated_at
    await supabaseAdmin
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    console.error('[/api/admin/chats/[chatId]/message] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
  }
}
