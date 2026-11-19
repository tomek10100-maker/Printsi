import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDisputeEmail } from '@/app/lib/sendNotificationEmail';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_service_key_for_build')
);

const PROBLEM_LABELS: Record<string, string> = {
  damaged: 'Damaged Item',
  wrong_item: 'Wrong Item Received',
  not_received: 'Item Not Received',
  quality_issue: 'Quality Issue',
  missing_parts: 'Missing Parts',
  other: 'Other Issue',
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing login session' }, { status: 401 });
    }

    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📥 Dispute Request Body:', body);

    const { itemId, chatId, problemType, description, contactEmail } = body;
    const buyerId = authUser.id;

    // Input validation
    if (!itemId || !chatId || !problemType || !description || !contactEmail) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Verify item and check that authenticated user is indeed the buyer
    const { data: itemData, error: itemErr } = await supabase
      .from('order_items')
      .select('seller_id, order_id')
      .eq('id', itemId)
      .single();

    if (itemErr || !itemData) {
      return NextResponse.json({ success: false, error: 'Order item not found' }, { status: 404 });
    }

    const { data: ordData } = await supabase
      .from('orders')
      .select('buyer_id')
      .eq('id', itemData.order_id)
      .single();

    if (String(ordData?.buyer_id) !== String(buyerId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Only the verified buyer can open a dispute' }, { status: 403 });
    }

    const sellerId = itemData.seller_id;

    // 1. Próba utworzenia rekordu sporu
    const { data: dispute, error: disputeError } = await supabase
      .from('disputes')
      .insert({
        order_item_id: itemId,
        chat_id: chatId,
        buyer_id: buyerId,
        seller_id: sellerId || null,
        problem_type: problemType,
        description: description,
        contact_email: contactEmail,
        status: 'open',
      })
      .select()
      .single();

    if (disputeError) {
      console.error('❌ Database Dispute Error:', disputeError);
      return NextResponse.json({ 
        success: false, 
        error: `Database error (Dispute): ${disputeError.message}`,
        details: disputeError.code 
      }, { status: 500 });
    }

    // 2. Aktualizacja statusu itemu
    const { error: itemError } = await supabase
      .from('order_items')
      .update({ status: 'disputed' })
      .eq('id', itemId);

    if (itemError) {
      console.error('❌ Database Item status Error:', itemError);
      return NextResponse.json({ 
        success: false, 
        error: `Database error (ItemStatus): ${itemError.message}` 
      }, { status: 500 });
    }

    // 3. Wysłanie wiadomości systemowej
    const problemLabel = PROBLEM_LABELS[problemType] || problemType;

    const { error: msgError } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: buyerId,
      content: JSON.stringify({
        problemType: problemLabel,
        description: description,
        disputeId: dispute.id,
      }),
      message_type: 'dispute_opened',
    });

    if (msgError) {
      console.error('❌ Message error:', msgError);
    }

    // 4. Get product title for email
    const { data: orderItem } = await supabase
      .from('order_items')
      .select('offer_id')
      .eq('id', itemId)
      .single();

    let productTitle = 'Your product';
    if (orderItem?.offer_id) {
      const { data: offer } = await supabase
        .from('offers')
        .select('title')
        .eq('id', orderItem.offer_id)
        .single();
      productTitle = offer?.title || productTitle;
    }

    // 5. Send dispute emails to both parties
    if (sellerId) {
      try {
        await sendDisputeEmail(
          sellerId,
          buyerId,
          productTitle,
          problemLabel,
          description
        );
      } catch (emailErr) {
        console.error('❌ Dispute email failed (non-fatal):', emailErr);
      }
    }

    return NextResponse.json({ success: true, disputeId: dispute.id });

  } catch (error: any) {
    console.error('❌ Critical API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected server error occurred' 
    }, { status: 500 });
  }
}
