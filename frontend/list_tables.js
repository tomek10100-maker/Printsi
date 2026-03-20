const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8'
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
