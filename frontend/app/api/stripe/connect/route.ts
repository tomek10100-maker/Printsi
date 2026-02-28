import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // fallback to typical api version
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Get user profile to check if they already have an account attached
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, email, full_name')
      .eq('id', userId)
      .single();

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      // 2. Create a new Express account optimized for individuals/makers
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email || undefined,
        business_type: 'individual',
        business_profile: {
          product_description: 'Selling 3D prints, custom models, and maker services on Printsi marketplace.',
          url: 'https://printsi.com', // fallback URL if they don't have one
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'manual',
            }
          }
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // 3. Save it to their profile in Supabase
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);

      if (error) {
        console.error("Failed to save stripe_account_id:", error);
        return NextResponse.json({ error: 'Failed to save account ID' }, { status: 500 });
      }
    }

    const domain = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 4. Generate onboarding link in English
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${domain}/profile/billing`,
      return_url: `${domain}/profile/billing?connected=true`,
      type: 'account_onboarding',
      collection_options: {
        fields: 'currently_due', // only ask for the minimum required fields
      }
    });

    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error('Stripe Connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}