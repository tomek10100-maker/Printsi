import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleTrackingUpdate(req, resolvedParams.id);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return handleTrackingUpdate(req, resolvedParams.id);
}

async function handleTrackingUpdate(req: Request, orderId: string) {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    const providedToken = tokenParam || authHeader.replace('Bearer ', '').trim();

    if (providedToken !== FURGONETKA_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    console.log(`📦 Furgonetka Tracking Update for order ${orderId}:`, payload);

    // Extract tracking number (Furgonetka usually sends it as tracking_number, number, or waybill)
    const trackingCode = payload.tracking_number || payload.number || payload.waybill || '';
    const courier = payload.courier || payload.service || '';

    if (trackingCode) {
      // Find order items and update their status/tracking
      // We assume the whole order is shipped together for now
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ status: 'shipped' }) // Możesz dodać kolumnę tracking_code w DB, jeśli jej nie ma
        .eq('order_id', orderId);

      if (updateError) {
        console.error('Error updating order status:', updateError);
      } else {
        console.log(`✅ Order ${orderId} marked as shipped with tracking ${trackingCode}`);
      }

      // Tutaj w przyszłości można dodać zapis do nowej kolumny "tracking_code" 
      // oraz wysłanie e-maila do klienta przez emailService.trackingAddedBuyer(...)
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Furgonetka tracking update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
