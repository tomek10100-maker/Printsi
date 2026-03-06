
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ucclcvfiwyxejeuufhbp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Starting migration...');

    // Adding columns to filaments table
    // We use multiple try-catches because some columns might already exist
    try {
        const { error } = await supabase.rpc('exec_sql', {
            sql_query: `
        ALTER TABLE public.filaments ADD COLUMN IF NOT EXISTS price_input_native NUMERIC(15, 2);
        ALTER TABLE public.filaments ADD COLUMN IF NOT EXISTS currency_native TEXT DEFAULT 'EUR';
      `
        });
        if (error) {
            // If RPC fails (likely because exec_sql doesn't exist), we can't do much here 
            // without a proper migration tool or manual intervention.
            // But let's check if we can at least detect the columns.
            console.error('Migration via RPC failed:', error);
        } else {
            console.log('Migration successful!');
        }
    } catch (err) {
        console.error('Error during migration:', err);
    }
}

migrate();
