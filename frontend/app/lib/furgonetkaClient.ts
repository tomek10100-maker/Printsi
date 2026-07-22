import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ENV = process.env.FURGONETKA_ENV || 'production';
const BASE_URL = ENV === 'sandbox'
  ? 'https://api.sandbox.furgonetka.pl'
  : 'https://api.furgonetka.pl';

// Supabase admin client for token persistence
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    // Expire 5 minutes early to prevent race conditions
    return Date.now() / 1000 >= (payload.exp - 300);
  } catch {
    return true;
  }
}

async function getStoredTokens(): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const { data, error } = await supabase
      .from('furgonetka_tokens')
      .select('access_token, refresh_token')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await supabase
      .from('furgonetka_tokens')
      .upsert({
        id: 1,
        access_token: accessToken,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    console.log('[FurgonetkaClient] Tokens saved to Supabase.');
  } catch (err) {
    console.error('[FurgonetkaClient] Failed to save tokens to Supabase:', err);
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(currentRefreshToken: string): Promise<string> {
  const clientId = process.env.FURGONETKA_CLIENT_ID;
  const clientSecret = process.env.FURGONETKA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Furgonetka client credentials are missing in env.');
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenUrl = `${BASE_URL}/oauth/token`;

  console.log('[FurgonetkaClient] Refreshing Furgonetka OAuth2 token...');
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh token: status ${response.status} ${response.statusText}. Response: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Invalid response structure from token endpoint: ${JSON.stringify(data)}`);
  }

  await saveTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function getValidAccessToken(forceRefresh = false): Promise<string> {
  // 1. Try Supabase-stored token first (persists across serverless invocations)
  const stored = await getStoredTokens();
  if (!forceRefresh && stored?.access_token && !isTokenExpired(stored.access_token)) {
    return stored.access_token;
  }

  // 2. Token missing or expired – refresh it
  if (refreshPromise) {
    return refreshPromise;
  }

  // Get the best available refresh token: stored in DB or from env var
  const refreshToken = stored?.refresh_token || process.env.FURGONETKA_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('Furgonetka refresh token is missing. Add FURGONETKA_REFRESH_TOKEN to env vars.');
  }

  refreshPromise = refreshAccessToken(refreshToken).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function apiRequest(endpoint: string, method: string = 'GET', body: any = null, isBinary: boolean = false, retry = true) {
  let token = await getValidAccessToken();
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  if (body && !isBinary) {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`[FurgonetkaClient API] Calling ${method} ${url}...`);
  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && retry) {
    console.warn('[FurgonetkaClient API] Unauthorized (401). Forcing token refresh and retrying...');
    try {
      token = await getValidAccessToken(true);
      headers['Authorization'] = `Bearer ${token}`;
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (refreshErr) {
      console.error('[FurgonetkaClient API] Token refresh failed during retry:', refreshErr);
      const secretVal = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';
      throw new Error(`Furgonetka Token Refresh Failed. The refresh token may have been revoked or expired. Please re-authorize by visiting /api/furgonetka/auth?secret=${secretVal}. Details: ${refreshErr}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FurgonetkaClient API] Error ${response.status} ${response.statusText}:`, errorText);
    throw new Error(`Furgonetka API error: ${response.status} ${response.statusText}. Details: ${errorText}`);
  }

  if (isBinary) {
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const furgonetkaClient = {
  /**
   * Get real-time shipping prices from Furgonetka API.
   * Calls POST /packages/calculate-price and returns available services with live prices.
   */
  async calculateShipping(payload: {
    pickup: { name: string; street: string; postcode: string; city: string; country_code: string; phone: string; email: string };
    receiver: { name: string; street: string; postcode: string; city: string; country_code: string; phone: string; email: string };
    parcels: Array<{ width: number; height: number; depth: number; weight: number; type: string }>;
  }) {
    return apiRequest('/packages/calculate-price', 'POST', payload);
  },

  /**
   * Create a draft package (state = waiting)
   */
  async createPackage(payload: {
    pickup: {
      name: string;
      company?: string;
      street: string;
      postcode: string;
      city: string;
      country_code: string;
      phone: string;
      email: string;
      point?: string;
    };
    receiver: {
      name: string;
      company?: string;
      street: string;
      postcode: string;
      city: string;
      country_code: string;
      phone: string;
      email: string;
      point?: string;
    };
    parcels: Array<{
      width: number;
      height: number;
      depth: number;
      weight: number;
      type: 'package' | 'envelope' | 'pallet';
    }>;
    service_id: number;
  }) {
    return apiRequest('/packages', 'POST', payload);
  },

  /**
   * Finalize and order a package (creates a shipment and pays for it).
   * Automatically retries up to 3 times on transient carrier connection errors (e.g. DHL timeout).
   */
  async orderPackage(packageId: number | string, retryCount = 0): Promise<any> {
    const MAX_RETRIES = 3;
    const uuid = crypto.randomUUID();
    const payload = {
      packages: [{ id: Number(packageId) }]
    };

    // Call order-commands endpoint
    await apiRequest(`/order-commands/${uuid}`, 'PUT', payload);

    // Poll the status command for completion
    console.log(`[FurgonetkaClient] Polling status of order command ${uuid} (retry ${retryCount})...`);
    let attempts = 0;
    const maxAttempts = 8;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const statusRes = await apiRequest(`/order-commands/${uuid}`, 'GET');

      console.log(`[FurgonetkaClient] Command status response (attempt ${attempts + 1}):`, statusRes.status);

      if (statusRes.status === 'success' || statusRes.status === 'successful') {
        return statusRes;
      }

      if (statusRes.status === 'error' || statusRes.status === 'failed') {
        const errors = statusRes.errors || statusRes.error || [];
        const isCarrierTimeout = Array.isArray(errors) && errors.some(
          (e: any) => e.code === 'carrierConnectionError'
        );

        if (isCarrierTimeout && retryCount < MAX_RETRIES) {
          const delayMs = (retryCount + 1) * 5000; // 5s, 10s, 15s
          console.warn(`[FurgonetkaClient] Carrier connection error (DHL timeout). Retrying in ${delayMs / 1000}s... (retry ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return this.orderPackage(packageId, retryCount + 1);
        }

        throw new Error(`Order command failed: ${JSON.stringify(errors)}`);
      }

      attempts++;
    }

    throw new Error(`Order command timeout: package ${packageId} order was not processed in time.`);
  },

  /**
   * Fetch PDF label of ordered package
   */
  async getLabel(packageId: number | string): Promise<Buffer> {
    return apiRequest(`/packages/${packageId}/label`, 'GET', null, true);
  },

  /**
   * Cancel an ordered or waiting package
   */
  async cancelPackage(packageId: number | string) {
    return apiRequest(`/packages/${packageId}`, 'DELETE');
  },

  /**
   * Fetch details of a package (for tracking or checking status)
   */
  async getPackageDetails(packageId: number | string) {
    return apiRequest(`/packages/${packageId}`, 'GET');
  }
};
