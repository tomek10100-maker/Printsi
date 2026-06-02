import { NextResponse } from 'next/server';

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';
const ENV = process.env.FURGONETKA_ENV || 'production';
const BASE_URL = ENV === 'sandbox'
  ? 'https://api.sandbox.furgonetka.pl'
  : 'https://api.furgonetka.pl';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    
    // Verify that the caller knows the webhook secret
    if (secret !== FURGONETKA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized: Invalid secret' }, { status: 401 });
    }

    const clientId = process.env.FURGONETKA_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Missing FURGONETKA_CLIENT_ID in environment' }, { status: 500 });
    }

    // Determine redirect URI
    const providedRedirectUri = url.searchParams.get('redirect_uri');
    const redirectUri = providedRedirectUri || `${url.origin}/api/furgonetka/callback`;

    // Pass the redirect URI and the secret in the state to verify in the callback
    const statePayload = { redirectUri, secret };
    const stateStr = Buffer.from(JSON.stringify(statePayload)).toString('base64');

    const authUrl = new URL(`${BASE_URL}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', stateStr);

    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('Error generating Furgonetka Auth URL:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
