import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';
const ENV = process.env.FURGONETKA_ENV || 'production';
const BASE_URL = ENV === 'sandbox'
  ? 'https://api.sandbox.furgonetka.pl'
  : 'https://api.furgonetka.pl';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateStr = url.searchParams.get('state');

    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }
    if (!stateStr) {
      return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
    }

    let statePayload;
    try {
      statePayload = JSON.parse(Buffer.from(stateStr, 'base64').toString('utf8'));
    } catch (e) {
      return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
    }

    // Verify secret
    if (statePayload.secret !== FURGONETKA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized: State secret does not match' }, { status: 401 });
    }

    const clientId = process.env.FURGONETKA_CLIENT_ID;
    const clientSecret = process.env.FURGONETKA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Missing Furgonetka client credentials in env' }, { status: 500 });
    }

    const redirectUri = statePayload.redirectUri;

    // Exchange code for tokens
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = `${BASE_URL}/oauth/token`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error('Failed to exchange code for tokens:', text);
      return NextResponse.json({ error: 'Failed to exchange authorization code', details: text }, { status: tokenResponse.status });
    }

    const data = await tokenResponse.json();
    if (!data.access_token || !data.refresh_token) {
      return NextResponse.json({ error: 'Invalid token response structure', data }, { status: 500 });
    }

    // Save tokens to Supabase
    const { error: dbError } = await supabase
      .from('furgonetka_tokens')
      .upsert({
        id: 1,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (dbError) {
      console.error('Failed to save tokens to database:', dbError);
      return NextResponse.json({ error: 'Failed to persist tokens', details: dbError }, { status: 500 });
    }

    // Return success page
    const htmlResponse = `
      <html>
        <head>
          <title>Furgonetka Authorized</title>
          <style>
            body { font-family: sans-serif; padding: 2rem; background: #f9fafb; color: #111827; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            h1 { color: #10b981; }
            textarea { width: 100%; height: 100px; margin-top: 10px; padding: 10px; font-family: monospace; border: 1px solid #d1d5db; border-radius: 4px; }
            .hint { margin-top: 20px; padding: 10px; background: #eff6ff; border-left: 4px solid #3b82f6; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Successfully Authorized Furgonetka</h1>
            <p>Your tokens have been successfully updated in the database and your application can now resume shipping operations.</p>
            
            <div class="hint">
              <p><strong>Optional:</strong> If you want to update your local <code>.env.local</code> file for development, you can copy the tokens below.</p>
            </div>

            <h3>Access Token</h3>
            <textarea readonly>${data.access_token}</textarea>

            <h3>Refresh Token</h3>
            <textarea readonly>${data.refresh_token}</textarea>
            
            <p style="margin-top: 2rem;"><a href="/" style="color: #3b82f6; text-decoration: none;">&larr; Return to Home</a></p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(htmlResponse, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error('Error handling Furgonetka Callback:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
