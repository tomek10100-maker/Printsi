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
    'Accept': 'application/vnd.furgonetka.v2+json', // standard version header
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
  console.log('--- Testing Furgonetka Connection ---');
  console.log(`ENV: ${ENV}`);
  console.log(`BASE_URL: ${BASE_URL}`);

  // Test 1: Get user info
  const userRes = await request('/user');
  console.log('User info status:', userRes.status);
  console.log('User info data:', JSON.stringify(userRes.data || userRes.raw, null, 2));

  // Test 2: Get services list (let's try /services or /v2/services or /carriers)
  const servicesRes = await request('/services');
  console.log('Services list response:', JSON.stringify(servicesRes.data || servicesRes.raw, null, 2));

  // Try /v2/services if it differs, or other options if /services fails
  if (servicesRes.status !== 200) {
    const servicesV2Res = await request('/v2/services');
    console.log('V2 Services response:', JSON.stringify(servicesV2Res.data || servicesV2Res.raw, null, 2));
  }
}

run().catch(console.error);
