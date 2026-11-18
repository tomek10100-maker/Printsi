import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const isExplicitSandbox = process.env.FURGONETKA_ENV === 'sandbox' || process.env.FURGONETKA_FORCE_SANDBOX === 'true';
const BASE_URL = isExplicitSandbox
  ? 'https://api.sandbox.furgonetka.pl'
  : 'https://api.furgonetka.pl';

// Supabase admin client for token persistence
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_service_key_for_build')
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

async function clearStoredTokens(): Promise<void> {
  try {
    await supabase.from('furgonetka_tokens').delete().eq('id', 1);
    console.log('[FurgonetkaClient] Invalid tokens cleared from Supabase.');
  } catch (err) {
    console.error('[FurgonetkaClient] Failed to clear invalid tokens:', err);
  }
}

let refreshPromise: Promise<string> | null = null;
let cachedAccountServices: { items: any[]; fetchedAt: number } | null = null;

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

async function requestClientCredentialsToken(): Promise<string> {
  const clientId = process.env.FURGONETKA_CLIENT_ID;
  const clientSecret = process.env.FURGONETKA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Furgonetka client credentials are missing in env.');
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenUrl = `${BASE_URL}/oauth/token`;

  console.log('[FurgonetkaClient] Attempting client_credentials OAuth grant fallback...');
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`client_credentials grant failed: ${response.status}. Response: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Invalid response structure from client_credentials endpoint.');
  }

  await saveTokens(data.access_token, data.refresh_token || '');
  return data.access_token;
}

export async function getValidAccessToken(forceRefresh = false): Promise<string> {
  // 1. Try Supabase-stored token first (persists across serverless invocations)
  const stored = await getStoredTokens();
  if (!forceRefresh && stored?.access_token && !isTokenExpired(stored.access_token)) {
    return stored.access_token;
  }

  // Check if valid token is provided directly in environment
  const envAccessToken = process.env.FURGONETKA_ACCESS_TOKEN;
  if (!forceRefresh && !stored?.access_token && envAccessToken && !isTokenExpired(envAccessToken)) {
    return envAccessToken;
  }

  // 2. Token missing or expired – refresh it
  if (refreshPromise) {
    return refreshPromise;
  }

  const dbToken = stored?.refresh_token;
  const envToken = process.env.FURGONETKA_REFRESH_TOKEN;
  const primaryToken = dbToken || envToken;

  refreshPromise = (async () => {
    // A. Try refresh token grant first (DB token first, then ENV token)
    if (primaryToken) {
      try {
        return await refreshAccessToken(primaryToken);
      } catch (err: any) {
        console.warn('[FurgonetkaClient] Primary refresh token failed:', err?.message || err);
        if (dbToken && envToken && dbToken !== envToken) {
          try {
            return await refreshAccessToken(envToken);
          } catch (envErr) {
            console.error('[FurgonetkaClient] Fallback env refresh token failed:', envErr);
          }
        }
      }
    }

    // B. Try client_credentials grant fallback
    try {
      return await requestClientCredentialsToken();
    } catch (ccErr: any) {
      console.warn('[FurgonetkaClient] client_credentials grant failed:', ccErr?.message || ccErr);
    }

    // C. Fallback to existing stored access token if available
    if (stored?.access_token) {
      console.warn('[FurgonetkaClient] Refresh failed. Returning existing stored access_token as fallback.');
      return stored.access_token;
    }

    const secretVal = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';
    throw new Error(`Carrier service authorization expired. Admin re-authorization required at /api/furgonetka/auth?secret=${secretVal}`);
  })().finally(() => {
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
  async calculateShipping(payload: any) {
    const p = payload.package ? payload.package : payload;
    const formattedParcels = (p.parcels || []).map((parcel: any) => ({
      ...parcel,
      quantity: parcel.quantity ?? 1,
      type: parcel.type || 'package',
    }));

    const cleanPayload: any = {
      package: {
        pickup: p.pickup,
        receiver: p.receiver,
        parcels: formattedParcels,
      }
    };
    if (p.service_id) {
      cleanPayload.services = { service_id: [String(p.service_id)] };
    }
    return apiRequest('/packages/calculate-price', 'POST', cleanPayload);
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
   * Automatically fetch and accept all pending carrier regulations on Furgonetka.
   * Handles both array and object (with items/data/regulations field) response shapes.
   */
  async acceptRegulations() {
    try {
      console.log('[FurgonetkaClient] Fetching pending carrier regulations...');
      const res = await apiRequest('/regulations', 'GET');
      console.log('[FurgonetkaClient] Regulations API response received.');

      // Handle different shapes: array directly, or {regulations: [...]} / {items: [...]} / {data: [...]}
      const items: any[] = Array.isArray(res) ? res
        : Array.isArray(res?.regulations) ? res.regulations
        : Array.isArray(res?.items) ? res.items
        : Array.isArray(res?.data) ? res.data
        : [];

      if (items.length === 0) {
        console.log('[FurgonetkaClient] No pending regulations found (or unrecognized format).');
        return;
      }

      for (const reg of items) {
        const isAccepted = reg.accepted === true || reg.status === 'accepted';
        const isMarketing = reg.marketing === true;
        if (!isAccepted && !isMarketing && reg.service) {
          console.log(`[FurgonetkaClient] Accepting regulation for service=${reg.service}...`);
          try {
            await apiRequest('/regulations', 'POST', {
              regulations: [
                {
                  service: reg.service,
                  name: reg.name || reg.service,
                  version: reg.version,
                  datetime: reg.datetime,
                  accepted: true
                }
              ]
            });
            console.log(`[FurgonetkaClient] Accepted regulation for service=${reg.service}.`);
          } catch (postErr) {
            console.error(`[FurgonetkaClient] Failed to accept regulation for service=${reg.service}:`, postErr);
          }
        }
      }
    } catch (err) {
      console.error('[FurgonetkaClient] Failed to fetch/accept regulations:', err);
    }
  },

  /**
   * Fetch details of a package (for tracking or checking status)
   */
  async getPackageDetails(packageId: number | string) {
    return apiRequest(`/packages/${packageId}`, 'GET');
  },

  /**
   * Dynamically resolves the account-specific service_id for a given carrier
   * (e.g. 'dpd', 'inpost', 'orlen', 'dhl', 'ups', 'gls', 'fedex', 'poczta')
   * so switching Furgonetka accounts (e.g. to a private account) works automatically.
   */
  async resolveServiceId(carrier: string): Promise<number> {
    const clean = (carrier || 'dpd').trim().toLowerCase();
    let target = 'dpd';
    if (clean.includes('inpost') || clean.includes('paczkomat')) target = 'inpost';
    else if (clean.includes('orlen')) target = 'orlen';
    else if (clean.includes('dhl')) target = 'dhl';
    else if (clean.includes('ups')) target = 'ups';
    else if (clean.includes('gls')) target = 'gls';
    else if (clean.includes('fedex')) target = 'fedex';
    else if (clean.includes('poczta')) target = 'poczta';

    try {
      const now = Date.now();
      if (!cachedAccountServices || now - cachedAccountServices.fetchedAt > 10 * 60 * 1000) {
        let items: any[] = [];
        try {
          const res = await apiRequest('/account/services', 'GET');
          items = Array.isArray(res) ? res
            : Array.isArray(res?.services) ? res.services
            : Array.isArray(res?.data) ? res.data
            : [];
        } catch {
          // Fallback: fetch service_ids from calculate-price
          const calcRes = await apiRequest('/packages/calculate-price', 'POST', {
            pickup: { name: 'Jan Kowalski', street: 'Marszalkowska 1', postcode: '00-001', city: 'Warszawa', country_code: 'PL', phone: '+48500600700', email: 'sender@printis.store' },
            receiver: { name: 'Anna Nowak', street: 'Mila 5', postcode: '00-111', city: 'Warszawa', country_code: 'PL', phone: '+48600700800', email: 'buyer@printis.store' },
            parcels: [{ width: 20, height: 15, depth: 10, weight: 1, type: 'package' }]
          });
          items = Array.isArray(calcRes?.services_prices) ? calcRes.services_prices
            : Array.isArray(calcRes?.services) ? calcRes.services
            : Array.isArray(calcRes) ? calcRes
            : [];
        }
        if (items.length > 0) {
          cachedAccountServices = { items, fetchedAt: now };
        }
      }

      const servicesList = cachedAccountServices?.items || [];
      if (servicesList.length > 0) {
        const match = servicesList.find((s: any) => {
          const sKey = String(s.service || s.courier || s.type || s.name || '').toLowerCase();
          return sKey === target || sKey.includes(target);
        });
        const matchedId = match?.service_id || match?.id;
        if (matchedId) {
          console.log(`[FurgonetkaClient] Resolved service_id=${matchedId} for carrier=${target}`);
          return Number(matchedId);
        }
      }
    } catch (err) {
      console.warn('[FurgonetkaClient] Dynamic service_id resolution failed, using fallback:', err);
    }

    const fallbackMap: Record<string, number> = {
      dpd: 46718378,
      fedex: 46718379,
      ups: 46718380,
      gls: 46718381,
      poczta: 46718382,
      inpost: 46718383,
      orlen: 46718384,
      dhl: 46718385,
    };
    return fallbackMap[target] || 46718378;
  }
};
