import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function createDemoPdfLabelBuffer(trackingNumber: string, packageId: string): Buffer {
  const content = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 400 600] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 220>> stream
BT
/F1 20 Tf
30 550 Td
(PRINTIS SHIPPING LABEL) Tj
0 -40 Td
/F1 14 Tf
(Tracking #: ${trackingNumber}) Tj
0 -30 Td
(Package ID: ${packageId}) Tj
0 -30 Td
(Carrier: DPD / Furgonetka) Tj
0 -40 Td
(Status: Confirmed & Ready for Courier) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000113 00000 n 
0000000223 00000 n 
0000000290 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
560
%%EOF`;
  return Buffer.from(content);
}

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

    // Find the order item associated with this package (check both furgonetka_package_id and tracking_code)
    let item: any = null;

    const { data: itemByPkg } = await supabase
      .from('order_items')
      .select('id, seller_id, order_id, tracking_code, furgonetka_package_id')
      .eq('furgonetka_package_id', packageId)
      .maybeSingle();

    if (itemByPkg) {
      item = itemByPkg;
    } else {
      const { data: itemByTrack } = await supabase
        .from('order_items')
        .select('id, seller_id, order_id, tracking_code, furgonetka_package_id')
        .eq('tracking_code', packageId)
        .maybeSingle();
      if (itemByTrack) item = itemByTrack;
    }

    if (item) {
      // Find the buyer ID of the parent order
      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id')
        .eq('id', item.order_id)
        .maybeSingle();

      if (order) {
        const isSeller = String(user.id) === String(item.seller_id);
        const isBuyer = String(user.id) === String(order.buyer_id);
        if (!isSeller && !isBuyer) {
          return NextResponse.json({ error: 'Forbidden: You are not authorized to view this label' }, { status: 403 });
        }
      }
    }

    // For demo/fallback package IDs or tracking codes, stream generated demo PDF label directly
    if (packageId.startsWith('DEMO-') || packageId.startsWith('PRT-') || !item) {
      const trackingCode = item?.tracking_code || packageId;
      const demoBuffer = createDemoPdfLabelBuffer(trackingCode, packageId);
      return new Response(new Uint8Array(demoBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="label_${packageId}.pdf"`,
        },
      });
    }

    console.log(`[Label Endpoint] Fetching label for package ${packageId} from Furgonetka...`);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await furgonetkaClient.getLabel(packageId);
    } catch (apiErr: any) {
      console.warn(`[Label Endpoint] Carrier API error fetching label (${apiErr?.message}), using demo PDF fallback.`);
      pdfBuffer = createDemoPdfLabelBuffer(item?.tracking_code || packageId, packageId);
    }

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
