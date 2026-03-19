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

    let domain = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    // Ensure domain has protocol
    if (!domain.startsWith('http')) {
      domain = 'http://' + domain;
    }

    // Stripe business_profile.url requires a valid URL, and sometimes rejects localhost in certain contexts.
    // We'll use a real domain as a fallback for the business profile if we are on localhost.
    const businessProfileUrl = domain.includes('localhost') ? 'https://printsi.com' : `${domain}/user/${userId}`;
    
    const businessProfile = {
      product_description: `Sales of 3D prints and maker services on Printsi platform by user ${profile?.full_name || userId}.`,
      url: businessProfileUrl,
    };

    if (!accountId) {
      // 2. Create a new Express account optimized for individuals/makers
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email || undefined,
        business_type: 'individual',
        business_profile: businessProfile,
        settings: {
          payouts: {
            schedule: {
              interval: 'manual',
            }
          }
        },
        capabilities: {
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
    } else {
      // 2. Update existing account to ensure business_profile is set (this skips the "Professional details" section)
      try {
        await stripe.accounts.update(accountId, {
          business_profile: businessProfile,
        });
      } catch (err) {
        console.error("Failed to update Stripe account business profile:", err);
      }
    }

    // 4. Generate onboarding link
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