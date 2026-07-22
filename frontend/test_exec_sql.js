const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const sql = `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS furgonetka_package_id TEXT, ADD COLUMN IF NOT EXISTS label_url TEXT;`;
  
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'sql'];
  for (const rpc of rpcs) {
    console.log(`Trying RPC: ${rpc}`);
    const { data, error } = await supabase.rpc(rpc, { sql });
    if (error) {
      console.log(`  Error: ${error.code} - ${error.message}`);
    } else {
      console.log(`  Success! Data:`, data);
      break;
    }
  }
}

main();
