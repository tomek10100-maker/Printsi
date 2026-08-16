import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await params;
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find the order item associated with this package
    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('id, seller_id, order_id')
      .eq('furgonetka_package_id', packageId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Package not found in database records' }, { status: 404 });
    }

    // Find the buyer ID of the parent order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('buyer_id')
      .eq('id', item.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Parent order not found' }, { status: 404 });
    }

    const isSeller = String(user.id) === String(item.seller_id);
    const isBuyer = String(user.id) === String(order.buyer_id);

    if (!isSeller && !isBuyer) {
      return NextResponse.json({ error: 'Forbidden: You are not authorized to view this label' }, { status: 403 });
    }

    console.log(`[Label Endpoint] Fetching label for package ${packageId} from Furgonetka...`);
    const pdfBuffer = await furgonetkaClient.getLabel(packageId);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="label_${packageId}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error streaming label:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
