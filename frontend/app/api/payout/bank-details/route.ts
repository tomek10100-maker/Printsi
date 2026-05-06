import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user's JWT
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { recipientName, iban, transferTitle } = await req.json();

    if (!recipientName || !iban) {
      return NextResponse.json({ error: 'Recipient name and IBAN are required' }, { status: 400 });
    }

    // Basic IBAN sanitization: strip spaces, uppercase
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        payout_recipient_name: recipientName.trim(),
        payout_iban: cleanIban,
        payout_transfer_title: (transferTitle || '').trim(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to save bank details:', error);
      return NextResponse.json({ error: 'Failed to save bank details: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Bank details error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        payout_recipient_name: null,
        payout_iban: null,
        payout_transfer_title: null,
      })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
