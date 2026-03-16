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
  const { data: sales, error: salesError } = await supabase.from('order_items').select('price_at_purchase, quantity, status, seller_id');
  
  if (salesError) {
    console.error(salesError);
    return;
  }
  
  const sellerStats = {};
  for(let s of sales) {
      if(!sellerStats[s.seller_id]) sellerStats[s.seller_id] = { earned: 0, pending: 0 };
      const amt = s.price_at_purchase * (s.quantity || 1);
      if (s.status === 'completed') sellerStats[s.seller_id].earned += amt;
      else sellerStats[s.seller_id].pending += amt;
  }

  const { data: orders } = await supabase.from('orders').select('buyer_id, total_amount');
  const buyerStats = {};
  for(let o of orders) {
      if(!buyerStats[o.buyer_id]) buyerStats[o.buyer_id] = { spent: 0 };
      buyerStats[o.buyer_id].spent += Number(o.total_amount);
  }

  console.log("SELLER EARNINGS:");
  console.log(JSON.stringify(sellerStats, null, 2));
  console.log("BUYER SPENDING:");
  console.log(JSON.stringify(buyerStats, null, 2));
  
  // Calculate specific net balance for sellers
  for (const seller in sellerStats) {
      const earned = sellerStats[seller].earned;
      const pending = sellerStats[seller].pending;
      const spent = buyerStats[seller] ? buyerStats[seller].spent : 0;
      console.log(`Seller ${seller}: earned(completed)=${earned}, pending=${pending}, spent=${spent}, netBalance=${Math.max(0, earned - spent)}`);
  }
}

run();
