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

async function run() {
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
    ]
  };

  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
    'Content-Type': 'application/json'
  };

  const url = `${BASE_URL}/packages/calculate-price`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  if (json.offers) {
    json.offers.forEach(offer => {
      console.log(`Carrier: ${offer.service} (service_id: ${offer.service_id}), Available: ${offer.available}`);
      if (offer.errors && offer.errors.length > 0) {
        console.log('Errors:', JSON.stringify(offer.errors, null, 2));
      }
      if (offer.pricing) {
        console.log('Pricing:', JSON.stringify(offer.pricing, null, 2));
      }
      console.log('---');
    });
  } else {
    console.log('Response:', JSON.stringify(json, null, 2));
  }
}

run().catch(console.error);
