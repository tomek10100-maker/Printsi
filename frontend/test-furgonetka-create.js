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

async function run() {
  const uuid = crypto.randomUUID();
  console.log(`Generated command UUID: ${uuid}`);

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
        length: 10,
        weight: 1.0,
        type: 'package'
      }
    ],
    service: 'dpd'
  };

  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
    'Content-Type': 'application/json'
  };

  const url = `${BASE_URL}/create-package-command/${uuid}`;
  console.log(`[HTTP] Calling PUT ${url}...`);

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
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
