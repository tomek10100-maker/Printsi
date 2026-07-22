const fs = require('fs');
const path = require('path');

// Load environment variables manually from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !match[1].startsWith('#')) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const ACCESS_TOKEN = process.env.FURGONETKA_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.FURGONETKA_REFRESH_TOKEN;
const CLIENT_ID = process.env.FURGONETKA_CLIENT_ID;
const CLIENT_SECRET = process.env.FURGONETKA_CLIENT_SECRET;
const ENV = process.env.FURGONETKA_ENV || 'sandbox';

const BASE_URL = ENV === 'sandbox' 
  ? 'https://api.sandbox.furgonetka.pl' 
  : 'https://api.furgonetka.pl';

async function request(endpoint, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[HTTP] Calling ${method} ${url}...`);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  console.log(`[HTTP] Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: response.status, raw: text };
  }
}

async function run() {
  // Test /packages
  const getPackages = await request('/packages', 'GET');
  console.log('GET /packages:', getPackages.status, getPackages.data || getPackages.raw);

  const postPackages = await request('/packages', 'POST', {});
  console.log('POST /packages:', postPackages.status, postPackages.data || postPackages.raw);

  // Test refreshing the token
  const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  console.log('Refreshing token using client credentials basic auth:', authHeader);
  const tokenUrl = `${BASE_URL}/oauth/token`;
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN
    })
  });
  console.log('Token response status:', tokenResponse.status);
  const tokenText = await tokenResponse.text();
  console.log('Token response body:', tokenText);
}

run().catch(console.error);
