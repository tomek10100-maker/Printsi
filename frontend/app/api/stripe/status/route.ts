import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // 0. Verify Auth using the standard supabase session approach or header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // 1. Get stripe_account_id from database
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_account_id) {
      return NextResponse.json({ isConnected: false });
    }

    // 2. Retrieve account status from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // 3. Sync status back to database if it changed
    if (account.details_submitted) {
      await supabaseAdmin
        .from('profiles')
        .update({ 
          stripe_connected: true, 
          onboarding_complete: true 
        })
        .eq('id', userId);
    }

    // details_submitted is true only after they finish the onboarding form
    return NextResponse.json({ 
      isConnected: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      accountId: account.id
    });

  } catch (error: any) {
    console.error('Stripe status check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
