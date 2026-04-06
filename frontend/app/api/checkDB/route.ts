import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data: d1 } = await supabase.from('order_items').select('*').limit(1);
  return NextResponse.json({ 
    order_items_keys: d1 && d1.length > 0 ? Object.keys(d1[0]) : "empty table"
  });
}
