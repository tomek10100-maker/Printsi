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

async function findTheMoney() {
  let log = '--- SEARCHING FOR THE 367.23 PLN (~86.40 EUR) ---\n';
  
  // Search payouts for anything close to -86.40
  const { data: payouts } = await supabase.from('payouts').select('*');
  log += `Total records in payouts: ${payouts?.length || 0}\n`;

  payouts?.forEach(p => {
    // 367.23 / 4.25 = 86.40
    if (Math.abs(Number(p.amount)) > 10) {
      log += `MATCH FOUND! ID: ${p.user_id}, Amt: ${p.amount} EUR, Status: ${p.status}, Label: ${p.label}\n`;
    }
  });

  fs.writeFileSync('tmp/wallet_result.txt', log);
}

findTheMoney();
