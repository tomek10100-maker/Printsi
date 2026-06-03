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
  const { data, error } = await supabase
    .from('profiles')
    .select('id, country, free_shipping_enabled, free_shipping_threshold, disabled_couriers')
    .in('id', ['64a1da17-6803-416c-ba3e-7c9fd4dab77e']);
    
  console.log("Data:", data);
  console.log("Error:", error);
}

main();
