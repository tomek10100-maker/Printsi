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
    const { data, error } = await supabase.from('order_items').select('*').limit(1);
    console.log("ORDER_ITEMS", data, error);
    
    const { data: cols, error: err2 } = await supabase.rpc('get_columns', { table_name: 'order_items' });
    console.log("COLUMNS (if RPC exists)", cols, err2);
}

run();
