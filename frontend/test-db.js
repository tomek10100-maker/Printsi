const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ucclcvfiwyxejeuufhbp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('filaments').select('user_id, is_active').then(r => console.log(JSON.stringify(r, null, 2)));
