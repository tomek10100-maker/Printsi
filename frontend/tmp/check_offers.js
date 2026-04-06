const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('offers')
    .select('id, title, user_id, is_active, is_custom')
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Offers:', JSON.stringify(data, null, 2));
  }
}

check();
