const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanDatabase() {
  console.log('🧹 Cleaning test data from database (preserving profiles & auth users)...');

  // 1. Delete messages
  const { error: msgErr } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('1. Messages deleted:', msgErr ? msgErr.message : 'OK');

  // 2. Delete chats
  const { error: chatErr } = await supabase.from('chats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('2. Chats deleted:', chatErr ? chatErr.message : 'OK');

  // 3. Delete order items
  const { error: itemErr } = await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('3. Order items deleted:', itemErr ? itemErr.message : 'OK');

  // 4. Delete shipping details
  const { error: shipErr } = await supabase.from('order_shipping_details').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('4. Order shipping details deleted:', shipErr ? shipErr.message : 'OK');

  // 5. Delete orders
  const { error: orderErr } = await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('5. Orders deleted:', orderErr ? orderErr.message : 'OK');

  // 6. Delete notifications
  const { error: notifErr } = await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('6. Notifications deleted:', notifErr ? notifErr.message : 'OK');

  // 7. Delete custom offers created during chat negotiation
  const { error: customOfferErr } = await supabase.from('offers').delete().eq('is_custom', true);
  console.log('7. Custom test offers deleted:', customOfferErr ? customOfferErr.message : 'OK');

  // 8. Reset buyer pending balance to 0 in profiles
  const { error: balanceErr } = await supabase.from('profiles').update({ pending_balance: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('8. Profiles pending balance reset to 0:', balanceErr ? balanceErr.message : 'OK');

  console.log('🎉 Database cleanup complete! Users and main catalog listings were kept intact.');
}

cleanDatabase();
