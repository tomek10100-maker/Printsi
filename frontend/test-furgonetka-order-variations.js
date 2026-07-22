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
const TEST_PACKAGE_ID = 20240330;

async function testOrderCommand(payload, variationName) {
  const uuid = crypto.randomUUID();
  console.log(`=== Testing ${variationName} (UUID: ${uuid}) ===`);

  const url = `${BASE_URL}/order-commands/${uuid}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Accept': 'application/vnd.furgonetka.v2+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`[HTTP] PUT response: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.log('PUT body response:', text);

  if (response.status === 200) {
    // Wait 3 seconds and check command status
    console.log('Waiting 3 seconds to check command status...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusRes = await fetch(`${BASE_URL}/order-commands/${uuid}`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/vnd.furgonetka.v2+json',
      }
    });

    console.log(`Command status response: ${statusRes.status}`);
    const statusText = await statusRes.text();
    try {
      console.log('Command Status:', JSON.stringify(JSON.parse(statusText), null, 2));
    } catch (e) {
      console.log('Status Raw:', statusText);
    }
  }
  console.log('============================================\n');
}

async function run() {
  // Variation 1: package ID as string
  await testOrderCommand({ packages: [TEST_PACKAGE_ID.toString()] }, 'Package IDs as strings');

  // Variation 2: Array of objects with package_id
  await testOrderCommand({ packages: [{ package_id: TEST_PACKAGE_ID }] }, 'Array of objects with package_id');

  // Variation 3: Array of objects with package_id as string
  await testOrderCommand({ packages: [{ package_id: TEST_PACKAGE_ID.toString() }] }, 'Array of objects with package_id as string');

  // Variation 4: Array of objects with id
  await testOrderCommand({ packages: [{ id: TEST_PACKAGE_ID }] }, 'Array of objects with id');

  // Variation 5: Adding agreement flags
  await testOrderCommand({ packages: [TEST_PACKAGE_ID], client_agreement_order: true }, 'With client_agreement_order: true');
  await testOrderCommand({ packages: [TEST_PACKAGE_ID], regulations_accepted: true }, 'With regulations_accepted: true');
}

run().catch(console.error);
