import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ENV = process.env.FURGONETKA_ENV || 'sandbox';
const BASE_URL = ENV === 'sandbox'
  ? 'https://api.sandbox.furgonetka.pl'
  : 'https://api.furgonetka.pl';

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

function updateEnvTokens(accessToken: string, refreshToken: string) {
  process.env.FURGONETKA_ACCESS_TOKEN = accessToken;
  process.env.FURGONETKA_REFRESH_TOKEN = refreshToken;

  try {
    // Determine .env.local path relative to application root
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');

      // Replace or insert ACCESS_TOKEN
      if (content.includes('FURGONETKA_ACCESS_TOKEN=')) {
        content = content.replace(/FURGONETKA_ACCESS_TOKEN=.*/, `FURGONETKA_ACCESS_TOKEN=${accessToken}`);
      } else {
        content += `\nFURGONETKA_ACCESS_TOKEN=${accessToken}`;
      }

      // Replace or insert REFRESH_TOKEN
      if (content.includes('FURGONETKA_REFRESH_TOKEN=')) {
        content = content.replace(/FURGONETKA_REFRESH_TOKEN=.*/, `FURGONETKA_REFRESH_TOKEN=${refreshToken}`);
      } else {
        content += `\nFURGONETKA_REFRESH_TOKEN=${refreshToken}`;
      }

      fs.writeFileSync(envPath, content, 'utf8');
      console.log('[FurgonetkaClient] Successfully saved new tokens to .env.local');
    } else {
      console.warn('[FurgonetkaClient] .env.local file not found at:', envPath);
    }
  } catch (error) {
    console.error('[FurgonetkaClient] Failed to save refreshed tokens to .env.local:', error);
  }
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const clientId = process.env.FURGONETKA_CLIENT_ID;
  const clientSecret = process.env.FURGONETKA_CLIENT_SECRET;
  const refreshToken = process.env.FURGONETKA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Furgonetka client credentials or refresh token are missing in env.');
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
      refresh_token: refreshToken
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

  updateEnvTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const currentToken = process.env.FURGONETKA_ACCESS_TOKEN;
  if (currentToken && !isTokenExpired(currentToken)) {
    return currentToken;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function apiRequest(endpoint: string, method: string = 'GET', body: any = null, isBinary: boolean = false) {
  const token = await getValidAccessToken();
  const url = `${BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  if (body && !isBinary) {
    headers['Content-Type'] = 'application/json';
  }

  console.log(`[FurgonetkaClient API] Calling ${method} ${url}...`);
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

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
   * Finalize and order a package (creates a shipment and pays for it)
   */
  async orderPackage(packageId: number | string) {
    const uuid = crypto.randomUUID();
    const payload = {
      packages: [{ id: Number(packageId) }]
    };
    
    // Call order-commands endpoint
    const response = await apiRequest(`/order-commands/${uuid}`, 'PUT', payload);
    
    // Poll the status command for completion
    console.log(`[FurgonetkaClient] Polling status of order command ${uuid}...`);
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusRes = await apiRequest(`/order-commands/${uuid}`, 'GET');
      
      console.log(`[FurgonetkaClient] Command status response (attempt ${attempts + 1}):`, statusRes.status);
      
      if (statusRes.status === 'success' || statusRes.status === 'successful') {
        return statusRes;
      }
      
      if (statusRes.status === 'error' || statusRes.status === 'failed') {
        throw new Error(`Order command failed: ${JSON.stringify(statusRes.errors || statusRes.error)}`);
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
