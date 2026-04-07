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

async function fix() {
  console.log('--- CORRECTIVE NUDGE 2.0 ---');
  const { data: latest } = await supabase
    .from('payouts')
    .select('*')
    .lt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latest) {
    console.log('Current:', latest.amount);
    // Force set to -2.36 (Safe 10.03 PLN)
    await supabase.from('payouts').update({ amount: -2.36 }).eq('id', latest.id);
    console.log('✅ Final adjustment to -2.36 EUR successful!');
  }
}

fix();
