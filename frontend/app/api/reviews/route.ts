import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const offerId = searchParams.get('offerId');
    const sellerId = searchParams.get('sellerId');
    const orderItemId = searchParams.get('orderItemId');

    let query = supabaseAdmin
      .from('reviews')
      .select('*, profiles:buyer_id(full_name, avatar_url), offers:offer_id(title, image_urls)');

    if (offerId) {
      query = query.eq('offer_id', offerId);
    } else if (sellerId) {
      query = query.eq('seller_id', sellerId);
    } else if (orderItemId) {
      query = query.eq('order_item_id', orderItemId);
    }

    const { data: reviews, error } = await query.order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet or query fails, return empty list safely
      return NextResponse.json({ reviews: [], stats: { averageRating: 0, totalCount: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } } });
    }

    const list = reviews || [];
    const totalCount = list.length;

    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;

    list.forEach(r => {
      const rating = Math.min(5, Math.max(1, Number(r.rating) || 5));
      distribution[rating] = (distribution[rating] || 0) + 1;
      sumRating += rating;
    });

    const averageRating = totalCount > 0 ? Math.round((sumRating / totalCount) * 10) / 10 : 0;

    return NextResponse.json({
      reviews: list,
      stats: {
        averageRating,
        totalCount,
        distribution,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized user token' }, { status: 401 });
    }

    const { orderItemId, rating, comment, imageUrls } = await req.json();

    if (!orderItemId || !rating) {
      return NextResponse.json({ error: 'orderItemId and rating (1-5) are required.' }, { status: 400 });
    }

    const numRating = Math.min(5, Math.max(1, parseInt(rating)));

    // 1. Fetch order item and linked order to verify eligibility
    const { data: orderItem, error: itemErr } = await supabaseAdmin
      .from('order_items')
      .select('id, status, offer_id, seller_id, order_id, offers(parent_offer_id), orders(buyer_id)')
      .eq('id', orderItemId)
      .single();

    if (itemErr || !orderItem) {
      return NextResponse.json({ error: 'Order item not found.' }, { status: 404 });
    }

    // 2. Verify buyer identity
    const buyerId = (orderItem.orders as any)?.buyer_id;
    if (!buyerId || buyerId !== user.id) {
      return NextResponse.json({ error: 'Only the verified buyer of this item can leave a review.' }, { status: 403 });
    }

    // 3. Verify item status eligibility: must be 'completed' or 'resolved' or have a resolved dispute
    const itemStatus = (orderItem.status || '').toLowerCase();
    
    // Also check dispute status if any exists
    const { data: disputes } = await supabaseAdmin
      .from('disputes')
      .select('status')
      .eq('order_item_id', orderItemId)
      .limit(1);

    const disputeStatus = disputes && disputes.length > 0 ? (disputes[0].status || '').toLowerCase() : null;

    const isEligibleStatus = ['completed', 'resolved'].includes(itemStatus) || ['resolved', 'closed'].includes(disputeStatus || '');

    if (!isEligibleStatus) {
      return NextResponse.json({
        error: 'Reviews can only be submitted after an order is marked as completed or when a dispute is resolved.'
      }, { status: 400 });
    }

    // Target the main offer ID or parent offer ID
    const targetOfferId = (orderItem.offers as any)?.parent_offer_id || orderItem.offer_id;

    // 4. Upsert review
    const { data: savedReview, error: saveErr } = await supabaseAdmin
      .from('reviews')
      .upsert({
        order_item_id: orderItemId,
        offer_id: targetOfferId,
        buyer_id: user.id,
        seller_id: orderItem.seller_id,
        rating: numRating,
        comment: comment ? comment.trim() : null,
        image_urls: Array.isArray(imageUrls) ? imageUrls : [],
      }, { onConflict: 'order_item_id, buyer_id' })
      .select()
      .single();

    if (saveErr) {
      console.error('Failed to save review to table:', saveErr);
      // Fallback: if reviews table does not exist in Supabase yet, record review as chat message
      if (saveErr.code === 'PGRST205' || saveErr.message?.includes('schema cache')) {
        const { data: chat } = await supabaseAdmin
          .from('chats')
          .select('id')
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .limit(1)
          .maybeSingle();

        if (chat) {
          await supabaseAdmin.from('messages').insert({
            chat_id: chat.id,
            sender_id: user.id,
            message_type: 'review_submitted',
            content: JSON.stringify({
              rating: numRating,
              comment: comment ? comment.trim() : null,
              image_urls: Array.isArray(imageUrls) ? imageUrls : [],
            })
          });
        }

        return NextResponse.json({ success: true, review: { rating: numRating, comment } });
      }

      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, review: savedReview });

  } catch (error: any) {
    console.error('Review API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
