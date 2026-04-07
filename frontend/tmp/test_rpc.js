const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('--- ATTEMPTING TO CREATE SQL FUNCTION ---');
  
  const sql = `
    CREATE OR REPLACE FUNCTION increment_user_balance(u_id UUID, amount NUMERIC)
    RETURNS VOID AS $$
    BEGIN
      UPDATE profiles
      SET balance = COALESCE(balance, 0) + amount
      WHERE id = u_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // We can't run raw SQL via supabase-js unless we have a specialized RPC
  // BUT we might have an 'exec_sql' RPC if someone created it.
  // We'll check.
  
  const { error } = await supabase.rpc('increment_user_balance', {
    u_id: '6e9a7b4e-63a8-429e-ba4d-b9ae8589d494', // Testing id from logs
    amount: 0.01
  });

  if (error) {
    if (error.code === 'PGRST202') {
       console.log('⚠️ Function increment_user_balance does not exist yet.');
    } else {
       console.error('❌ RPC Error:', error);
    }
  } else {
    console.log('✅ RPC increment_user_balance WORKED!');
  }
}

check();
