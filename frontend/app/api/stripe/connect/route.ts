import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/stripe';
import { createClient } from '@supabase/supabase-js';



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

    if (!accountId) {
      // 2. Create a new Express account with pre-filled business details to skip questions
      const [firstName, ...lastNameParts] = (profile?.full_name || 'User').split(' ');
      const lastName = lastNameParts.join(' ') || 'User';

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'PL',
        email: profile?.email || undefined,
        business_type: 'individual',
        individual: {
           email: profile?.email || undefined,
           first_name: firstName,
           last_name: lastName,
        },
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: false },
        },
        business_profile: {
          mcc: '7399', // Miscellaneous and Specialty Retail Stores
          url: 'https://printis.store',
          product_description: 'Sprzedaż usług druku 3D oraz modeli cyfrowych przez platformę Printis.',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'manual',
            }
          }
        }
      });

      accountId = account.id;

      // 3. Save it to their profile in Supabase
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);

      if (updateError) {
        console.error("Failed to save stripe_account_id:", updateError);
        return NextResponse.json({ error: 'Failed to save account ID' }, { status: 500 });
      }
    } else {
      // Ensure existing accounts also have the business profile set to skip sections
      try {
        await stripe.accounts.update(accountId, {
          business_type: 'individual',
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: false },
          },
          business_profile: {
            mcc: '7399',
            url: 'https://printis.store',
            product_description: 'Sprzedaż usług druku 3D oraz modeli cyfrowych przez platformę Printis.',
          },
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