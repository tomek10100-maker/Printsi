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

async function testVariation(label, parcelsPayload) {
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
    parcels: parcelsPayload
  };

  const response = await fetch(`${BASE_URL}/packages/calculate-price`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Accept': 'application/vnd.furgonetka.v2+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const json = await response.json();
  console.log(`=== VARIATION: ${label} ===`);
  if (json.offers) {
    const dpd = json.offers.find(o => o.service === 'dpd');
    if (dpd) {
      console.log(`DPD available: ${dpd.available}`);
      if (dpd.errors && dpd.errors.length > 0) {
        console.log('DPD Errors:', JSON.stringify(dpd.errors, null, 2));
      } else {
        console.log('DPD Pricing:', JSON.stringify(dpd.pricing, null, 2));
      }
    } else {
      console.log('DPD offer not found in list!');
    }
  } else {
    console.log('Error response:', JSON.stringify(json, null, 2));
  }
}

async function run() {
  await testVariation('Integer Numbers', [
    {
      width: 10,
      height: 10,
      depth: 10,
      weight: 1,
      type: 'package'
    }
  ]);

  await testVariation('Strings', [
    {
      width: "10",
      height: "10",
      depth: "10",
      weight: "1.0",
      type: 'package'
    }
  ]);

  await testVariation('No Type', [
    {
      width: 10,
      height: 10,
      depth: 10,
      weight: 1
    }
  ]);

  await testVariation('Empty Parcel Object', [
    {}
  ]);
}

run().catch(console.error);
