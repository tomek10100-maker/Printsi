const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
let vars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) vars[match[1]] = match[2].replace('\r', '').trim();
});

const supabase = createClient(
  vars['NEXT_PUBLIC_SUPABASE_URL'],
  vars['SUPABASE_SERVICE_ROLE_KEY']
);

async function run() {
  const { data, error } = await supabase.from('messages').select('content, created_at, chat_id').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2), error);
  process.exit(0);
}

run();
