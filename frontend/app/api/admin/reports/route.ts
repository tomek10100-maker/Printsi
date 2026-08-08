import { NextResponse } from 'next/server';
import { verifyAdmin, supabaseAdmin, FORBIDDEN } from '../../../lib/adminAuth';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    // 1. Fetch user reports from support_tickets (category = 'report')
    const { data: tickets, error: ticketsErr } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('category', 'report')
      .order('created_at', { ascending: false });

    if (ticketsErr) throw ticketsErr;

    // 2. Fetch order disputes
    const { data: disputes, error: disputesErr } = await supabaseAdmin
      .from('disputes')
      .select('*')
      .order('created_at', { ascending: false });

    if (disputesErr) {
      console.warn('Could not fetch disputes table:', disputesErr.message);
    }

    return NextResponse.json({
      reports: tickets || [],
      disputes: disputes || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) return FORBIDDEN();

  try {
    const { reportId, disputeId, status } = await req.json();
    const allowed = ['open', 'in_progress', 'resolved', 'closed'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    if (reportId) {
      const { error } = await supabaseAdmin
        .from('support_tickets')
        .update({ status })
        .eq('id', reportId);
      if (error) throw error;
    } else if (disputeId) {
      const { error } = await supabaseAdmin
        .from('disputes')
        .update({ status })
        .eq('id', disputeId);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Missing reportId or disputeId' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
