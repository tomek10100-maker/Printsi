const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
  const itemId = 'ae1cf35a-f6bd-4529-be8c-7e0cab27a5d8';
  console.log("Querying itemId:", itemId);
  
  const { data, error } = await supabase
    .from('order_items')
    .select('id, order_id, seller_id, price_at_purchase, quantity, status, furgonetka_package_id')
    .eq('id', itemId)
    .single();
    
  console.log("Data:", data);
  console.log("Error:", error);
}

main();
