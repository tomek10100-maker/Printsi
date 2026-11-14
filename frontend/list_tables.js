const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
  console.log('--- Listing Tables ---');
  const { data, error } = await supabase.rpc('get_tables'); // This might not work if rpc isn't defined
  if (error) {
    // Try querying information_schema if possible, but PostgREST doesn't allow that directly usually.
    // Let's just try to select from common tables.
    const tables = ['profiles', 'offers', 'order_items', 'messages', 'chats', 'disputes', 'filaments'];
    for (const table of tables) {
      const { error: err } = await supabase.from(table).select('*').limit(0);
      if (err) {
         console.log(`❌ ${table}: ${err.message}`);
      } else {
         console.log(`✅ ${table}`);
      }
    }
  } else {
    console.log(data);
  }
}

listTables();
