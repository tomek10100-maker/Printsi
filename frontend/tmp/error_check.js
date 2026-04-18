require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('chats')
    .select('id, created_at, updated_at, order_id, buyer_id, seller_id, offer_id, offers ( id, title, image_urls, category, price, material, color_name, color_hex, dimensions, weight, custom_instructions, color_variants )')
    .limit(1);

  if (error) {
    console.log('Error Details:', JSON.stringify(error, null, 2));
  } else {
    console.log('Success!', data);
  }
}
test();
