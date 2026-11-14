const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('--- Checking Database Schema ---');

  // Check if disputes table exists
  const { data: disputes, error: disputesErr } = await supabase
    .from('disputes')
    .select('*')
    .limit(1);

  if (disputesErr) {
    console.error('❌ disputes table check failed:', disputesErr.message);
  } else {
    console.log('✅ disputes table exists.');
  }

  // Check if order_items has status column
  const { data: orderItems, error: itemsErr } = await supabase
    .from('order_items')
    .select('status')
    .limit(1);

  if (itemsErr) {
    console.error('❌ order_items.status column check failed:', itemsErr.message);
  } else {
    console.log('✅ order_items.status column exists.');
  }

  // Check if messages has message_type column
  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('message_type')
    .limit(1);

  if (msgErr) {
    console.error('❌ messages.message_type column check failed:', msgErr.message);
  } else {
    console.log('✅ messages.message_type column exists.');
  }
}

checkSchema();
