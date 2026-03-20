import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { itemId, newStatus, chatId, userId, trackingCode } = await req.json();

    if (!itemId || !newStatus || !chatId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    // Update status in order_items (with optional tracking code)
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'shipped' && trackingCode) {
      updatePayload.tracking_code = trackingCode;
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update(updatePayload)
      .eq('id', itemId);


    if (updateError) throw updateError;

    // Add a system message about the status change
    let messageContent = '';
    let messageType = 'system';
    
    if (newStatus === 'shipped') {
      messageContent = `The seller has shipped the package. It's on the way!`;
      messageType = 'status_shipped';
    } else if (newStatus === 'delivered') {
      messageContent = `The buyer has confirmed receiving the package.`;
      messageType = 'status_delivered';
    } else if (newStatus === 'completed') {
      messageContent = `Transaction completed successfully! The buyer confirmed everything is fine. Funds have been released to the seller's balance.`;
      messageType = 'status_completed';
    } else if (newStatus === 'disputed') {
      messageContent = `A dispute has been opened. Funds are on hold until the issue is resolved by support.`;
      messageType = 'status_disputed';
    } else {
      messageContent = `Status changed to: ${newStatus}`;
    }

    // Insert as system message (sender_id = userId who triggered, but message_type marks it as system)
    await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: userId,
      content: messageContent,
      message_type: messageType,
    });

    return NextResponse.json({ success: true, newStatus });

  } catch (error: any) {
    console.error('❌ Status Update Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
