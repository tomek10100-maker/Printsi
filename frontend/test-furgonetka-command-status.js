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
const CMD_UUID = '3631c7c1-73df-4744-ab42-cbe7736db969';

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
    return { status: response.status, raw: text };
  }
}

async function run() {
  const res = await request(`/create-package-command/${CMD_UUID}`);
  console.log('GET command response:', res.status, JSON.stringify(res.data || res.raw, null, 2));
}

run().catch(console.error);
