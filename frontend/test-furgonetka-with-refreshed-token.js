const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

// 1. Load env variables
let envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !match[1].startsWith('#')) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// We obtained this new access token and refresh token in the previous run:
const NEW_ACCESS_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJwcmludGlzLTY5MjVhYjI3N2ViODFjZjNhM2UzNDBjYjI4NThlNmFlIiwianRpIjoiOGJhNjk2ZTNhMDIxMTJiNjUwOWE1OTVkMGY2MTc5YTljYmYwYzkxMTA4NDU0YzZkMjYyMjcxYTQxZTU4NTI2YjQ0YzBkNjYxZWViMDk2MTAiLCJpYXQiOjE3ODAzMjA2ODYuNTUyOTQ4LCJuYmYiOjE3ODAzMjA2ODYuNTUyOTUsImV4cCI6MTc4MjkxMjY4Ni41NDcyMzUsInN1YiI6IjY1MjEzMiIsInNjb3BlcyI6WyJhcGkiXX0.5WXT2MuimXQNiFpPEbdIVgZ7T7B-OzwaT-MztdncnwSV7Il1Hn4rRtjXf5_7GkpeldRtVUlvSU2wDNIrkpJQRQ";
const NEW_REFRESH_TOKEN = "def5020028fbe4a270607020604b9a19d99f19a36f225ece4d65521a6e596ace8999f2fcfcce560f88a3c8fc80f1d10d395bd159242a67dbd7816961b4479d78543d73c43b29c4c57370141f4b3b028e95ed6b0de11fe1a910d4c66d4029db65abd9daa2f44c857cee7bb370eb5e1f5f0285f9051ace1e4a56b5ddee9775ade156e2e65a3176ef00fc7f823648c19efb13567bdfc617b3b6ddaf02aab9dd1caf1d93991d08cf7e4ff945bf4eac72ab93131f1caee877608854b5e533dac2a492ec3f5c43db51e2d26073100e2b617990f00e4b92b82d14a88c9c1c45e605a6b3acba6b101fb1f1e3438ae27b8a9dac366aa5c6bb1a443ca11a783d981ac45529dfb13ff7ccd9e6d976c575af2c45977cc54e36641b776c7dfc7e6836bb8d03eccd5eb6d6531f4c3e98e3235c91b7d028501f3313741a07eef2fc71333dcbd0bc4825dc18cd9c63efe36a862e2a0bc0300c5c91ff27cea68ac6ccea213105742b0075a145d94c430fa10b29de2989cbcfb490a0dbaf938701cd04551765e9afc36f9e59e3d8e0960f5787971e487ecebf7361a4b4";

// Update in file
envContent = envContent.replace(
  `FURGONETKA_ACCESS_TOKEN=${envVars.FURGONETKA_ACCESS_TOKEN}`,
  `FURGONETKA_ACCESS_TOKEN=${NEW_ACCESS_TOKEN}`
);
envContent = envContent.replace(
  `FURGONETKA_REFRESH_TOKEN=${envVars.FURGONETKA_REFRESH_TOKEN}`,
  `FURGONETKA_REFRESH_TOKEN=${NEW_REFRESH_TOKEN}`
);

fs.writeFileSync(envPath, envContent, 'utf8');
console.log('Saved new tokens to .env.local!');

// Let's do tests with NEW token
const BASE_URL = 'https://api.sandbox.furgonetka.pl';

async function request(endpoint, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${NEW_ACCESS_TOKEN}`,
    'Accept': 'application/vnd.furgonetka.v2+json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${BASE_URL}${endpoint}`;
  console.log(`[HTTP] Calling ${method} ${url}...`);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  console.log(`[HTTP] Status: ${response.status} ${response.statusText}`);
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: response.status, raw: text };
  }
}

async function run() {
  const userRes = await request('/user');
  console.log('GET /user status:', userRes.status);
  console.log('GET /user data:', JSON.stringify(userRes.data || userRes.raw, null, 2));

  const servicesRes = await request('/services');
  console.log('GET /services status:', servicesRes.status);
  console.log('GET /services data:', JSON.stringify(servicesRes.data || servicesRes.raw, null, 2));
}

run().catch(console.error);
