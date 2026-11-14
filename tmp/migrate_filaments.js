
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ucclcvfiwyxejeuufhbp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
