const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ucclcvfiwyxejeuufhbp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8'
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
