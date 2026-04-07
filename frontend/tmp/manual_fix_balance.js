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
  console.log('--- FIXING RECENT TOPUP ---');
  
  // Find the last topup (negative amount) for the user
  const { data: latest, error } = await supabase
    .from('payouts')
    .select('*')
    .lt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !latest) {
    console.error('Could not find latest topup:', error);
    return;
  }

  console.log('Found Topup:', latest.id, 'Amount:', latest.amount);

  if (Math.abs(latest.amount) === 100) {
    console.log('Adjusting 100.00 EUR to ~116.50 EUR to match 100 GBP...');
    const { error: updErr } = await supabase
      .from('payouts')
      .update({ amount: -116.50 })
      .eq('id', latest.id);
      
    if (updErr) console.error('Failed to update:', updErr);
    else console.log('✅ Balance fixed manually!');
  } else {
    console.log('Amount is not 100, might not be the target record.');
  }
}

fix();
