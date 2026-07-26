import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const [{ data: offers, error }, { data: { users: authUsers } }] = await Promise.all([
      supabaseAdmin
        .from('offers')
        .select('id, title, category, price, stock, is_active, is_custom, is_negotiable, image_urls, created_at, user_id, profiles!offers_user_id_fkey(full_name, avatar_url)')
        .order('created_at', { ascending: false }),
      supabaseAdmin.auth.admin.listUsers(),
    ]);

    if (error) throw error;

    const emailMap: Record<string, string> = {};
    (authUsers || []).forEach(u => { emailMap[u.id] = u.email || ''; });

    const enriched = (offers || []).map((o: any) => ({
      ...o,
      profiles: o.profiles ? { ...o.profiles, email: emailMap[o.user_id] || '' } : null,
    }));

    return NextResponse.json({ offers: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { offerId, is_active } = await req.json();
    if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('offers')
      .update({ is_active })
      .eq('id', offerId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { offerId } = await req.json();
    if (!offerId) return NextResponse.json({ error: 'offerId required' }, { status: 400 });

    // Clear favorites first to avoid FK constraints
    await supabaseAdmin.from('favorites').delete().eq('offer_id', offerId);
    
    const { error } = await supabaseAdmin.from('offers').delete().eq('id', offerId);
    if (error) {
      // If it has order history, archive instead
      if (error.code === '23503') {
        const { error: archiveError } = await supabaseAdmin
          .from('offers')
          .update({ is_active: false })
          .eq('id', offerId);
        if (archiveError) throw archiveError;
        return NextResponse.json({ success: true, action: 'archived' });
      }
      throw error;
    }

    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
