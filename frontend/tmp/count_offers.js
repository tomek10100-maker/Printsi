const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('offers')
    .select('user_id, count()')
    .group('user_id');

  if (error) {
    // try different count method if group not supported directly in this version
    const { data: all } = await supabase.from('offers').select('user_id');
    const counts = {};
    all?.forEach(o => counts[o.user_id] = (counts[o.user_id]||0)+1);
    console.log('Counts by user_id:', counts);
  } else {
    console.log('Counts:', data);
  }
}

check();
