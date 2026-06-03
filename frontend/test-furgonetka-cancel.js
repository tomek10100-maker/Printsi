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
const TEST_PACKAGE_ID = '20240330';

async function run() {
  const url = `${BASE_URL}/packages/${TEST_PACKAGE_ID}`;
  console.log(`[HTTP] Calling DELETE ${url}...`);

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Accept': 'application/vnd.furgonetka.v2+json'
    }
  });

  console.log(`[HTTP] Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  try {
    console.log('Response JSON:', JSON.stringify(JSON.parse(text), null, 2));
  } catch (e) {
    console.log('Response Raw:', text);
  }
}

run().catch(console.error);
