const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1).single();
  if (error) {
    console.error('❌ Profiles check failed:', error);
  } else {
    console.log('Profiles columns:', Object.keys(data));
  }
}

checkProfiles();
