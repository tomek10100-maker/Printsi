import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { itemId, newStatus, chatId, userId } = await req.json();

    if (!itemId || !newStatus || !chatId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    // Update status in order_items
    const { error: updateError } = await supabase
      .from('order_items')
      .update({ status: newStatus })
      .eq('id', itemId);

    if (updateError) throw updateError;

    // Add a system message about the status change
    let messageContent = '';
    
    if (newStatus === 'shipped') {
      messageContent = `📦 **Status:** Shipped. The seller has sent the package.`;
    } else if (newStatus === 'delivered') {
      messageContent = `📬 **Status:** Delivered. The buyer has confirmed receipt.`;
    } else if (newStatus === 'completed') {
      messageContent = `✅ **Status:** Completed. The buyer confirmed everything is fine. Transaction finalized, funds have been added to the seller's balance. Thank you!`;
    } else if (newStatus === 'disputed') {
      messageContent = `🚨 **Status:** Problem (Dispute). The buyer reported an issue. Funds are on hold. The case will be forwarded to Support.`;
    } else {
      messageContent = `🔄 **Status:** Changed to ${newStatus}`;
    }

    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId, // could be system, but using the user who triggered it is fine
      content: messageContent,
    });

    return NextResponse.json({ success: true, newStatus });

  } catch (error: any) {
    console.error('❌ Status Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
