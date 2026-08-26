import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { packageId, itemId, status = 'delivered', carrier = 'DPD' } = body;

    let targetPackageId = packageId;
    let targetItemId = itemId;

    if (!targetPackageId && targetItemId) {
      const { data: item } = await supabase
        .from('order_items')
        .select('furgonetka_package_id')
        .eq('id', targetItemId)
        .maybeSingle();
      targetPackageId = item?.furgonetka_package_id;
    }

    if (!targetPackageId && !targetItemId) {
      // Find the latest order item with a furgonetka_package_id or active order
      const { data: latestItem } = await supabase
        .from('order_items')
        .select('id, furgonetka_package_id')
        .not('furgonetka_package_id', 'is', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestItem) {
        targetPackageId = latestItem.furgonetka_package_id;
        targetItemId = latestItem.id;
      }
    }

    if (!targetPackageId) {
      return NextResponse.json({
        success: false,
        error: 'No active package ID found. Please provide packageId or itemId.'
      }, { status: 400 });
    }

    const secret = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

    // Invoke internal webhook directly
    const webhookPayload = {
      event: 'package_status',
      package_id: String(targetPackageId),
      state: status, // 'in_transit' | 'out_for_delivery' | 'delivered'
      carrier: carrier,
      tracking_number: `PL-${targetPackageId}`,
      estimated_delivery_date: new Date(Date.now() + 86400000).toISOString(),
      datetime: new Date().toISOString()
    };

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

    const webhookRes = await fetch(`${baseUrl}/api/furgonetka`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`
      },
      body: JSON.stringify(webhookPayload)
    });

    const resData = await webhookRes.json();

    return NextResponse.json({
      success: webhookRes.ok,
      simulatedStatus: status,
      packageId: targetPackageId,
      webhookResponse: resData
    });
  } catch (err: any) {
    console.error('[SimulateTracking Route Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
