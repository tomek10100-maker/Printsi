const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ucclcvfiwyxejeuufhbp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjY2xjdmZpd3l4ZWpldXVmaGJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDkwMzU4NywiZXhwIjoyMDg2NDc5NTg3fQ.cCAsh72y1Nlsg0Rm9LxlTxbeGKLtE3JuY0bAb_iGne8');
supabase.from('filaments').select('user_id, is_active').then(r => console.log(JSON.stringify(r, null, 2)));
