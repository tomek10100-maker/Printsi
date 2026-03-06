
const supabaseUrl = 'https://ucclcvfiwyxejeuufhbp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8';

async function runSql(sql) {
    // Most Supabase projects don't have a public SQL API. 
    // The service role key is for REST/Auth.
    // However, we can try to use the 'rpc' if they have an 'exec_sql' or similar.
    // Since we don't know, we'll try to just use the REST API to update if the columns exist.

    console.log('Testing if columns exist...');
    const res = await fetch(`${supabaseUrl}/rest/v1/filaments?select=price_input_native,currency_native&limit=1`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    if (res.status === 400) {
        console.log('Columns do not exist. User needs to run the migration.');
        console.log('Please run the following SQL in your Supabase SQL Editor:');
        console.log(`
      ALTER TABLE public.filaments ADD COLUMN IF NOT EXISTS price_input_native NUMERIC(15, 2);
      ALTER TABLE public.filaments ADD COLUMN IF NOT EXISTS currency_native TEXT DEFAULT 'EUR';
    `);
    } else {
        console.log('Columns already exist or something else happened:', res.status);
    }
}

runSql();
