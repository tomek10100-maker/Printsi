const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

async function testCreate(serviceCode) {
  const uuid = crypto.randomUUID();
  console.log(`=== Testing Creation for service: ${serviceCode} (UUID: ${uuid}) ===`);

  const payload = {
    pickup: {
      name: 'Jan Kowalski',
      company: 'Printsi Test',
      street: 'Kolejowa 12',
      postcode: '01-234',
      city: 'Warszawa',
      country_code: 'PL',
      phone: '500600700',
      email: 'nta876077@gmail.com'
    },
    receiver: {
      name: 'Anna Nowak',
      street: 'Mila 5',
      postcode: '00-111',
      city: 'Warszawa',
      country_code: 'PL',
      phone: '600700800',
      email: 'buyer@example.com'
    },
    parcels: [
      {
        width: 10,
        height: 10,
        depth: 10,
        weight: 1.0,
        type: 'package'
      }
    ],
    service: serviceCode
  };

  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${BASE_URL}/create-package-command/${uuid}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  console.log(`[HTTP] PUT response: ${response.status} ${response.statusText}`);
  await response.text();

  // Wait 3 seconds and check command status
  console.log('Waiting 3 seconds to check command status...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const statusRes = await fetch(`${BASE_URL}/create-package-command/${uuid}`, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Accept': 'application/vnd.furgonetka.v2+json',
    }
  });

  const statusText = await statusRes.text();
  try {
    const json = JSON.parse(statusText);
    console.log('Command Status:', json.status);
    if (json.errors && json.errors.length > 0) {
      console.log('Errors:', JSON.stringify(json.errors, null, 2));
    }
    if (json.redirect_url) {
      console.log('Redirect URL:', json.redirect_url);
    }
    if (json.package_id) {
      console.log('Package ID created:', json.package_id);
    }
    // Print the whole status object if it's successful or has other info
    if (json.status === 'success' || json.status === 'successful') {
      console.log('Full success response:', JSON.stringify(json, null, 2));
    }
  } catch (e) {
    console.log('Status Raw:', statusText);
  }
  console.log('============================================\n');
}

async function run() {
  await testCreate('ups');
  await testCreate('dpd');
}

run().catch(console.error);
