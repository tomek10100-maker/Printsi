import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client using the service role key — can delete users
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
    try {
        // Get the Authorization header (Bearer token from the logged-in user)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify the token is valid and get the user
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const userId = user.id;

        // 1. Delete all user's offers (images stay in storage for now, can clean up separately)
        await supabaseAdmin.from('offers').delete().eq('user_id', userId);

        // 2. Delete all user's notifications
        await supabaseAdmin.from('notifications').delete().eq('user_id', userId);

        // 3. Delete the profile row
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        // 4. Delete the auth user — this is the definitive step
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('Failed to delete auth user:', deleteError);
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err: any) {
        console.error('Delete account error:', err);
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}
