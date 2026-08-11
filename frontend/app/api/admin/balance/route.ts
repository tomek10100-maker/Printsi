import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN, getAuthEmailMap } from '../../../lib/adminAuth';
import { sendEmail, EmailTemplates } from '../../../lib/emailService';

/**
 * POST — Add or subtract balance from a user account.
 * Automatically posts a notification message into the user's Support Chat thread
 * and sends an official email notification from Printis Support.
 * Body: { userId: string, amount: number, note: string, action: 'add' | 'remove' }
 */
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { userId, amount, note, action } = await req.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 });
    }

    // 1. Verify user profile exists using guaranteed columns (id, full_name)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.error('[/api/admin/balance] Profile lookup error:', profileErr);
      return NextResponse.json({ error: 'User profile not found in database' }, { status: 404 });
    }

    const numAmount = Math.abs(Number(amount));
    // Negative amount in payouts = credit added to user wallet balance
    // Positive amount in payouts = debit removed from user wallet balance
    const payoutAmount = action === 'add' ? -numAmount : numAmount;
    const noteText = note ? `Admin adjustment: ${note}` : 'Admin balance adjustment';

    // 2. Log transaction in payouts table with automatic schema column fallback
    let { error: insertErr } = await supabaseAdmin.from('payouts').insert({
      user_id: userId,
      amount: payoutAmount,
      status: 'completed',
      notes: noteText,
    });

    if (insertErr) {
      console.warn('[/api/admin/balance] Retrying insert with core columns only:', insertErr.message);
      const { error: insertErr2 } = await supabaseAdmin.from('payouts').insert({
        user_id: userId,
        amount: payoutAmount,
        status: 'completed',
      });

      if (insertErr2) {
        console.error('[/api/admin/balance] DB Insert Error:', insertErr2);
        return NextResponse.json({ error: insertErr2.message }, { status: 500 });
      }
    }

    // 3. Find or Create Support Chat Thread with User
    const { data: existingChats } = await supabaseAdmin
      .from('chats')
      .select('id')
      .eq('buyer_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    let chatId = existingChats?.[0]?.id;

    if (!chatId) {
      const { data: newChat, error: chatErr } = await supabaseAdmin
        .from('chats')
        .insert({
          buyer_id: userId,
          seller_id: adminId,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!chatErr && newChat) {
        chatId = newChat.id;
      }
    }

    // 4. Post Support Notification Message into the Chat
    if (chatId) {
      const amountFormatted = `€${numAmount.toFixed(2)}`;
      const messageContent = `💳 Wallet Balance Adjusted: ${action === 'add' ? '+' : '-'}${amountFormatted} has been ${action === 'add' ? 'added to' : 'deducted from'} your account balance.${note ? `\n\nNote / Reason: ${note}` : ''}`;

      await supabaseAdmin.from('messages').insert({
        chat_id: chatId,
        sender_id: adminId,
        content: messageContent,
        message_type: 'admin_chat',
      });

      await supabaseAdmin
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);
    }

    // 5. Send Official Email Notification from Printis Support
    try {
      const emailMap = await getAuthEmailMap();
      const userEmail = emailMap[userId];

      if (userEmail) {
        const userName = profile.full_name || 'Printis User';
        const amountFormatted = `€${numAmount.toFixed(2)}`;
        const subject = `Printis Support - Balance Adjusted (${action === 'add' ? '+' : '-'}${amountFormatted})`;
        const html = EmailTemplates.balanceAdjusted(userName, action, amountFormatted, note);

        await sendEmail({ to: userEmail, subject, html });
      }
    } catch (emailErr) {
      console.warn('⚠️ [/api/admin/balance] Failed to send notification email (non-fatal):', emailErr);
    }

    return NextResponse.json({
      success: true,
      action,
      amount: numAmount,
      note: note || '',
      chatId,
    });
  } catch (error: any) {
    console.error('[/api/admin/balance] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
