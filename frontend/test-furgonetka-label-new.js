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

async function request(endpoint) {
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[HTTP] Calling GET ${url}...`);

  const response = await fetch(url, { headers });
  console.log(`[HTTP] Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: response.status, raw: text.substring(0, 1000) };
  }
}

async function run() {
  const labelRes1 = await request('/packages/20240328/label');
  console.log('Package 20240328 Label:', labelRes1.status, JSON.stringify(labelRes1.data || labelRes1.raw, null, 2));

  const labelRes2 = await request('/packages/20240329/label');
  console.log('Package 20240329 Label:', labelRes2.status, JSON.stringify(labelRes2.data || labelRes2.raw, null, 2));

  // Let's also check package details to see if label is in there!
  const pkgRes = await request('/packages/20240328');
  if (pkgRes.data && pkgRes.data.package) {
    console.log('Package details root keys:', Object.keys(pkgRes.data.package));
    console.log('Package details label field:', JSON.stringify(pkgRes.data.package.label, null, 2));
  } else {
    console.log('Package details:', JSON.stringify(pkgRes.data, null, 2));
  }
}

run().catch(console.error);
