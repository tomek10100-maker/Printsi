const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8');
let vars = {};
env.split('\n').forEach(line => {
    if (line.trim().length > 0 && !line.startsWith('#')) {
        const [k, ...rest] = line.split('=');
        vars[k.trim()] = rest.join('=').trim();
    }
});

const SUPABASE_URL = vars['NEXT_PUBLIC_SUPABASE_URL'];
const SUPABASE_KEY = vars['SUPABASE_SERVICE_ROLE_KEY']; // MUSI być Service Role

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function nukeDatabase() {
    console.log('☢️ INITIATING FULL DATABASE NUKE...');

    // 1. Get all users from auth.users via admin API
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
        console.error('Error fetching users:', authError.message);
        return;
    }

    console.log(`Found ${users.length} users to destroy.`);

    // 2. Delete each user (This automatically cascades to profiles, chats, messages, etc. if ON DELETE CASCADE is set. We also truncate manual tables)
    for (const user of users) {
        console.log(`Deleting user: ${user.id} (${user.email})`);
        await supabase.auth.admin.deleteUser(user.id);
    }

    // 3. Just to be absolutely sure, truncate all public schema tables
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/nuke_everything`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    console.log('✅ NUKE COMPLETE! The database is completely empty.');
}

nukeDatabase();
