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
  const headers = {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  const response = await fetch(`${BASE_URL}/packages`, { headers });
  const data = await response.json();
  if (data.packages && data.packages.length > 0) {
    const pkg = data.packages[0];
    console.log('Package root keys:', Object.keys(pkg));
    console.log('Package package_id / id:', pkg.package_id, pkg.id);
    console.log('Package package_no:', pkg.package_no);
    console.log('Package service:', pkg.service);
    console.log('Package service_id:', pkg.service_id);
    console.log('Package state:', pkg.state);
  } else {
    console.log('No packages found');
  }
}

run().catch(console.error);
