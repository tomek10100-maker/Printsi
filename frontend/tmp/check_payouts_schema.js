const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- PAYOUTS SCHEMA CHECK ---');
  const { data, error } = await supabase.from('payouts').select('*').limit(1);
  if (error) {
    console.error('❌ Error fetching payouts:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Available Columns in PAYOUTS:', Object.keys(data[0]));
  } else {
    // If no data, we try to insert a fake record and see what it allows
    console.log('⚠️ No data in payouts, cannot check columns via select *.');
  }
}

check();
