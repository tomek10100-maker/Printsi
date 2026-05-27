import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { chatId, userId, unarchive } = await req.json();

    if (!chatId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing chatId or userId' }, { status: 400 });
    }

    // Verify user is participant in this chat
    const { data: chat, error: chatErr } = await supabase
      .from('chats')
      .select('id, buyer_id, seller_id')
      .eq('id', chatId)
      .single();

    if (chatErr || !chat) {
      return NextResponse.json({ success: false, error: 'Chat not found' }, { status: 404 });
    }

    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    if (unarchive) {
      // Restore from archive
      const { error } = await supabase
        .from('chats')
        .update({ archived_at: null, archived_by: null })
        .eq('id', chatId);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'unarchived' });
    } else {
      // Archive manually
      const { error } = await supabase
        .from('chats')
        .update({ archived_at: new Date().toISOString(), archived_by: 'manual' })
        .eq('id', chatId);

      if (error) throw error;
      return NextResponse.json({ success: true, action: 'archived' });
    }
  } catch (error: any) {
    console.error('❌ Chat archive error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
