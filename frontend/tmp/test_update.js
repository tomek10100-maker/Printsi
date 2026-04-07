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
  console.log('--- TABLE VS VIEW CHECK ---');
  
  // Try to check table info from pg_catalog if we have permissions
  const { data, error } = await supabase.rpc('get_table_info', { tname: 'profiles' });
  if (error) {
    console.log('⚠️ RPC get_table_info failed (probably doesnt exist), trying raw check.');
  } else {
    console.log('RPC Result:', data);
  }

  // List all tables to see if there is something else related to balance
  const { data: tables, error: tableErr } = await supabase.from('payouts').select('*').limit(1);
  console.log('Payouts exists and works.');
}

check();
