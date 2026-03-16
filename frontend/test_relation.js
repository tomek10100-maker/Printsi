const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
let vars = {};
env.split('\n').forEach(line => {
    if (line.trim().length > 0 && !line.startsWith('#')) {
        const [k, ...rest] = line.split('=');
        vars[k.trim()] = rest.join('=').trim();
    }
});

const SUPABASE_URL = vars['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const sellerId = '64a1da17-6803-416c-ba3e-7c9fd4dab77e';
  
  const { data: chats } = await supabase.from('chats').select('*').eq('seller_id', sellerId);
  const { data: items } = await supabase.from('order_items').select('*').eq('seller_id', sellerId);
  
  console.log("CHATS:");
  console.log(JSON.stringify(chats, null, 2));
  
  console.log("ORDER ITEMS:");
  console.log(JSON.stringify(items, null, 2));
}

run();
