import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
        return NextResponse.json({ error: 'Missing sellerId' }, { status: 400 });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('filaments')
            .select('id, plastic_type, color_name, color_hex, brand, stock_grams, is_active')
            .eq('user_id', sellerId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching filaments API:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ filaments: data || [] });
    } catch (err: any) {
        console.error('Server error fetching filaments:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
