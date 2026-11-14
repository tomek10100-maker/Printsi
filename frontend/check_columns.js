const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  console.log('--- Checking Columns ---');
  
  // order_items
  const { data: itemData, error: itemErr } = await supabase.from('order_items').select('*').limit(1).single();
  if (itemErr) {
    console.error('❌ order_items check failed');
  } else {
    console.log('order_items columns:', Object.keys(itemData));
  }

  // messages
  const { data: msgData, error: msgErr } = await supabase.from('messages').select('*').limit(1).single();
  if (msgErr) {
    console.error('❌ messages check failed');
  } else {
    console.log('messages columns:', Object.keys(msgData));
  }
}

checkColumns();
