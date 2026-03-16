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

const supabase = createClient(vars['NEXT_PUBLIC_SUPABASE_URL'], vars['SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
    const { data: o, error: oErr } = await supabase.from('orders').select('*').limit(1);
    console.log("ORDERS", o, oErr);
}
run();
