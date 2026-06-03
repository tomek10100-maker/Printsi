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
  console.log("--- LATEST ORDERS ---");
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (oErr) {
    console.error("Orders Error:", oErr);
    return;
  }
  
  for (const order of orders) {
    console.log(`\nOrder ID: ${order.id} | Created: ${order.created_at} | Status: ${order.status}`);
    console.log(`Shipping Address JSON:`, JSON.stringify(order.shipping_address, null, 2));
    
    const { data: details, error: dErr } = await supabase
      .from('order_shipping_details')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle();
      
    console.log(`order_shipping_details:`, details);
    if (dErr) console.error(`  Details Error:`, dErr);
    
    const { data: items, error: iErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);
      
    console.log(`order_items count:`, items ? items.length : 0);
    if (items) {
      items.forEach(it => {
        console.log(`  - Item ID: ${it.id} | Status: ${it.status} | Seller ID: ${it.seller_id}`);
      });
    }
  }
}

main();
