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
  console.log('--- CURRENCY SETTINGS CHECK ---');
  // Finding a user to check their preferred currency
  const { data: profile } = await supabase.from('profiles').select('id, full_name, currency').limit(1).single();
  
  if (profile) {
    console.log(`User: ${profile.full_name} (${profile.id})`);
    console.log(`Current Currency in Database: ${profile.currency || 'NULL (defaults to EUR)'}`);
    
    if (!profile.currency || profile.currency === 'EUR') {
      console.log('Force updating profile to PLN for testing...');
      await supabase.from('profiles').update({ currency: 'PLN' }).eq('id', profile.id);
      console.log('✅ Updated to PLN.');
    }
  }
}

check();
