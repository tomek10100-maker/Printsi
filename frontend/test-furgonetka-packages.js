const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

// Load environment variables manually from .env.local
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !match[1].startsWith('#')) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const ACCESS_TOKEN = envVars.FURGONETKA_ACCESS_TOKEN;
const BASE_URL = 'https://api.sandbox.furgonetka.pl';

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
  console.log('Testing endpoints with valid token:', ACCESS_TOKEN.substring(0, 20) + '...');

  // Try GET /packages
  const getPackages = await request('/packages', 'GET');
  console.log('GET /packages status:', getPackages.status);
  console.log('GET /packages data:', JSON.stringify(getPackages.data || getPackages.raw, null, 2));

  // Try GET /v2/packages
  const getV2Packages = await request('/v2/packages', 'GET');
  console.log('GET /v2/packages status:', getV2Packages.status);
  console.log('GET /v2/packages data:', JSON.stringify(getV2Packages.data || getV2Packages.raw, null, 2));
}

run().catch(console.error);
