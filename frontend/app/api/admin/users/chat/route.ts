import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../../lib/adminAuth';
import { sendEmail, EmailTemplates } from '../../../../lib/emailService';

/**
 * GET — Fetch or create dedicated support chat messages for a specific user.
 * Query param: userId
 */
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    // 1. Find existing DEDICATED support chat (offer_id IS NULL AND order_id IS NULL)
    let { data: chat } = await supabaseAdmin
      .from('chats')
      .select('id, created_at, updated_at')
      .eq('buyer_id', userId)
      .is('offer_id', null)
      .is('order_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chat) {
      // Create new dedicated support chat
      const { data: newChat, error: createErr } = await supabaseAdmin
        .from('chats')
        .insert({
          buyer_id: userId,
          seller_id: adminId,
          offer_id: null,
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) throw createErr;
      chat = newChat;
    }

    if (!chat) {
      return NextResponse.json({ error: 'Failed to access support chat' }, { status: 500 });
    }

    // 2. Fetch messages in this chat
    const { data: messages, error: msgErr } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({
      success: true,
      chatId: chat.id,
      messages: messages || [],
    });
  } catch (error: any) {
    console.error('[/api/admin/users/chat GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Send a direct support message from Admin to a User in a dedicated Support Chat thread.
 * Body: { userId: string, content: string }
 */
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { userId, content } = await req.json();

    if (!userId || !content || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    // 1. Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle();

    // 2. Find or Create DEDICATED Support Chat Thread (offer_id IS NULL AND order_id IS NULL)
    let { data: chat } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('buyer_id', userId)
      .is('offer_id', null)
      .is('order_id', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chat) {
      const { data: newChat, error: createErr } = await supabaseAdmin
        .from('chats')
        .insert({
          buyer_id: userId,
          seller_id: adminId,
          offer_id: null,
          order_id: null,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) throw createErr;
      chat = newChat;
    }

    if (!chat) {
      return NextResponse.json({ error: 'Failed to access support chat' }, { status: 500 });
    }

    // 3. Insert Support Message
    const { data: message, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chat.id,
        sender_id: adminId,
        content: content.trim(),
        message_type: 'admin_chat',
      })
      .select()
      .single();

    if (msgErr) throw msgErr;

    // Update chat updated_at
    await supabaseAdmin
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chat.id);

    // 4. Send Official Email Notification from Printis Support
    try {
      const emailMap = await getAuthEmailMap();
      const userEmail = emailMap[userId];

      if (userEmail) {
        const userName = profile?.full_name || 'Printis User';
        const subject = `Printis Support - New Message from Support`;
        const html = EmailTemplates.adminSupportMessage(userName, content.trim());

        await sendEmail({ to: userEmail, subject, html });
      }
    } catch (emailErr) {
      console.warn('⚠️ [/api/admin/users/chat] Failed to send email (non-fatal):', emailErr);
    }

    return NextResponse.json({
      success: true,
      chatId: chat.id,
      message,
    });
  } catch (error: any) {
    console.error('[/api/admin/users/chat POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
