import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET || 'printis-cron-secret';

/**
 * GET /api/cron/shipping-deadlines
 * Runs daily (Vercel Cron: 0 8 * * *) to:
 * 1. Warn/cancel sellers who missed the shipping deadline
 * 2. Auto-confirm receipt for buyers who did not confirm within 2 days of delivery
 */
export async function GET(req: Request) {
  // Auth
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: string[] = [];

  // ─── PASS 1: Overdue Sellers ─────────────────────────────────────────
  // Find physical/job order items past their ship_by_deadline and still 'pending'
  const { data: overdueItems } = await supabase
    .from('order_items')
    .select('id, order_id, seller_id, offer_id, ship_by_deadline, created_at')
    .eq('status', 'pending')
    .not('ship_by_deadline', 'is', null)
    .lt('ship_by_deadline', now.toISOString());

  for (const item of overdueItems || []) {
    const hoursOverdue = (now.getTime() - new Date(item.ship_by_deadline).getTime()) / (1000 * 60 * 60);

    // Find the chat for this order+offer
    const { data: chat } = await supabase
      .from('chats')
      .select('id, buyer_id')
      .eq('order_id', item.order_id)
      .maybeSingle();

    if (!chat) continue;

    if (hoursOverdue >= 48) {
      // 48h+ overdue → auto-cancel
      await supabase.from('order_items').update({ status: 'cancelled', cancellation_reason: 'Seller failed to ship within the deadline.' }).eq('id', item.id);
      await supabase.from('messages').insert({
        chat_id: chat.id,
        sender_id: item.seller_id,
        message_type: 'status_cancelled',
        content: JSON.stringify({ type: 'cancelled', reason: 'Seller failed to ship within the allowed time. The order has been automatically cancelled and a refund will be issued.' }),
      });
      await supabase.from('notifications').insert([
        { user_id: item.seller_id, title: '⚠️ Order auto-cancelled', message: 'Your order was automatically cancelled because you did not ship within the deadline.', type: 'warning', is_read: false },
        { user_id: chat.buyer_id, title: '🔄 Order cancelled — refund incoming', message: 'The seller did not ship in time. Your order has been cancelled and a refund will be issued.', type: 'info', is_read: false },
      ]);
      results.push(`cancelled:${item.id}`);
    } else if (hoursOverdue >= 24) {
      // 24-48h overdue → urgent warning (only if no warning message sent yet)
      const { data: existingWarn } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chat.id)
        .eq('message_type', 'system_deadline_urgent')
        .maybeSingle();
      if (!existingWarn) {
        await supabase.from('messages').insert({
          chat_id: chat.id,
          sender_id: item.seller_id,
          message_type: 'system_deadline_urgent',
          content: JSON.stringify({ type: 'deadline_urgent', message: 'Shipping deadline has passed. Ship immediately or this order will be automatically cancelled within 24 hours.' }),
        });
        await supabase.from('notifications').insert({
          user_id: item.seller_id, title: '🚨 Ship immediately!', message: 'Your shipping deadline has passed. Ship the order now or it will be auto-cancelled in 24h.', type: 'warning', is_read: false,
        });
        results.push(`urgent_warning:${item.id}`);
      }
    } else {
      // < 24h overdue → first warning
      const { data: existingWarn } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chat.id)
        .eq('message_type', 'system_deadline_warning')
        .maybeSingle();
      if (!existingWarn) {
        await supabase.from('messages').insert({
          chat_id: chat.id,
          sender_id: item.seller_id,
          message_type: 'system_deadline_warning',
          content: JSON.stringify({ type: 'deadline_warning', message: 'Shipping deadline has passed. Please ship your order as soon as possible to avoid automatic cancellation.' }),
        });
        await supabase.from('notifications').insert({
          user_id: item.seller_id, title: '⏰ Shipping deadline passed', message: 'You missed your shipping deadline. Please ship the order immediately.', type: 'warning', is_read: false,
        });
        results.push(`deadline_warning:${item.id}`);
      }
    }
  }

  // ─── PASS 2: Auto Buyer Confirm ──────────────────────────────────────
  // Find items delivered 2+ days ago where buyer hasn't confirmed
  const { data: autoConfirmItems } = await supabase
    .from('order_items')
    .select('id, order_id, seller_id, offer_id, price_at_purchase, quantity, buyer_confirm_deadline')
    .eq('status', 'delivered')
    .is('buyer_confirmed_at', null)
    .not('buyer_confirm_deadline', 'is', null)
    .lt('buyer_confirm_deadline', now.toISOString());

  for (const item of autoConfirmItems || []) {
    // Find chat
    const { data: chat } = await supabase
      .from('chats')
      .select('id, buyer_id')
      .eq('order_id', item.order_id)
      .maybeSingle();

    if (!chat) continue;

    // Mark as completed
    await supabase.from('order_items').update({
      status: 'completed',
      buyer_confirmed_at: now.toISOString(),
    }).eq('id', item.id);

    await supabase.from('messages').insert({
      chat_id: chat.id,
      sender_id: item.seller_id,
      message_type: 'status_completed',
      content: JSON.stringify({ type: 'completed', confirmed_by: 'auto', confirmed_at: now.toISOString() }),
    });

    await supabase.from('chats').update({ completed_at: now.toISOString() }).eq('id', chat.id);

    // Notify both parties
    const { data: offer } = await supabase.from('offers').select('title').eq('id', item.offer_id).single();
    const { data: sellerProfile } = await supabase.from('profiles').select('currency').eq('id', item.seller_id).single();
    const earnedEur = (item.price_at_purchase || 0) * (item.quantity || 1);
    const sellerCurrency = sellerProfile?.currency || 'EUR';
    const FALLBACK_RATES: Record<string, number> = { PLN: 4.25, USD: 1.08, GBP: 0.86, CZK: 25.0, SEK: 11.2, NOK: 11.5, DKK: 7.46, CHF: 0.96 };
    const rate = FALLBACK_RATES[sellerCurrency] || 1;
    const converted = sellerCurrency === 'EUR' ? `€${earnedEur.toFixed(2)}` : `${Math.ceil(earnedEur * rate * 100) / 100} ${sellerCurrency}`;

    await supabase.from('notifications').insert([
      { user_id: item.seller_id, title: '🎉 Payment released!', message: `No dispute was raised. ${converted} from \"${offer?.title || 'your item'}\" has been released to your balance.`, type: 'sale', is_read: false },
      { user_id: chat.buyer_id, title: '✅ Order auto-completed', message: `Your order for \"${offer?.title || 'an item'}\" has been automatically completed after 2 days. Thank you!`, type: 'info', is_read: false },
    ]);

    results.push(`auto_confirmed:${item.id}`);
  }

  return NextResponse.json({ success: true, processed: results, timestamp: now.toISOString() });
}
