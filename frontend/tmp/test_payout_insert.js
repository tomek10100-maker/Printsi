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
  console.log('--- FINDING VALID PROFILE ---');
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
  
  if (!profile) {
    console.error('No profile found at all!');
    return;
  }
  
  console.log('Valid ID found:', profile.id);

  console.log('--- TEST INSERT 2.0 ---');
  const { data, error } = await supabase.from('payouts').insert({
    user_id: profile.id,
    amount: -0.01,
    status: 'completed'
  }).select();

  if (error) {
    console.error('❌ Insert failed again:', error);
  } else {
    console.log('✅ Minimal insert WORKED with valid ID!');
    console.log('Columns in payouts are:', Object.keys(data[0]));
  }
}

check();
