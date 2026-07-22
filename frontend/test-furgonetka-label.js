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
const TEST_PKG_ID = '20240225';

async function request(endpoint, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[HTTP] Calling ${method} ${url}...`);

  const response = await fetch(url, { method, headers });
  console.log(`[HTTP] Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: response.status, raw: text.substring(0, 500) };
  }
}

async function run() {
  const labelRes = await request(`/packages/${TEST_PKG_ID}/label`);
  console.log('GET /packages/:id/label:', labelRes.status, JSON.stringify(labelRes.data || labelRes.raw, null, 2));

  const docsRes = await request(`/packages/${TEST_PKG_ID}/documents`);
  console.log('GET /packages/:id/documents:', docsRes.status, JSON.stringify(docsRes.data || docsRes.raw, null, 2));
}

run().catch(console.error);
