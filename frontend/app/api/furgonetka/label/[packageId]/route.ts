import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { furgonetkaClient } from '@/app/lib/furgonetkaClient';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_service_key_for_build')
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

    // Find the order item associated with this package (by furgonetka_package_id, tracking_code, or item id)
    let item: any = null;

    const { data: itemByFurgId } = await supabase
      .from('order_items')
      .select('id, seller_id, order_id, furgonetka_package_id, tracking_code')
      .eq('furgonetka_package_id', packageId)
      .maybeSingle();

    if (itemByFurgId) {
      item = itemByFurgId;
    } else {
      const { data: itemByTrack } = await supabase
        .from('order_items')
        .select('id, seller_id, order_id, furgonetka_package_id, tracking_code')
        .eq('tracking_code', packageId)
        .maybeSingle();

      if (itemByTrack) {
        item = itemByTrack;
      } else {
        const { data: itemById } = await supabase
          .from('order_items')
          .select('id, seller_id, order_id, furgonetka_package_id, tracking_code')
          .eq('id', packageId)
          .maybeSingle();

        if (itemById) {
          item = itemById;
        }
      }
    }

    if (!item) {
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

    const targetPackageId = item.furgonetka_package_id || item.tracking_code || packageId;
    console.log(`[Label Endpoint] Fetching label for package ${targetPackageId} from Furgonetka...`);

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await furgonetkaClient.getLabel(targetPackageId);
    } catch (labelErr: any) {
      const errMsg = labelErr.message || '';
      console.warn(`[Label Endpoint] Initial getLabel failed for ${targetPackageId}:`, errMsg);

      // If the package is in draft / waiting status, attempt to finalize and order it
      if (errMsg.includes('status uniemożliwiający') || errMsg.includes('400')) {
        console.log(`[Label Endpoint] Package ${targetPackageId} appears to be in draft/waiting state. Attempting to finalize order via orderPackage...`);
        try {
          await furgonetkaClient.acceptRegulations();
          await furgonetkaClient.orderPackage(targetPackageId);

          // Update tracking code with real carrier waybill
          const pkgDetails = await furgonetkaClient.getPackageDetails(targetPackageId);
          const realTracking = pkgDetails?.parcels?.[0]?.package_no || pkgDetails?.pickup_number;
          if (realTracking && item.id) {
            await supabase.from('order_items').update({
              tracking_code: realTracking,
              status: 'shipped'
            }).eq('id', item.id);
          }

          pdfBuffer = await furgonetkaClient.getLabel(targetPackageId);
        } catch (orderErr: any) {
          const orderMsg = orderErr.message || '';
          console.error(`[Label Endpoint] Finalizing order for package ${targetPackageId} failed:`, orderMsg);

          const isSandbox = process.env.FURGONETKA_FORCE_PRODUCTION !== 'true';
          const portalUrl = isSandbox ? 'https://sandbox.furgonetka.pl' : 'https://furgonetka.pl';

          if (orderMsg.includes('saldo') || orderMsg.includes('Cena przesyłek jest większa') || orderMsg.includes('balance') || orderMsg.includes('status uniemożliwiający')) {
            return NextResponse.json({
              error: `Przesyłka oczekuje na opłacenie z salda konta. Zaloguj się na ${portalUrl}, opłać przesyłkę w zakładce "Koszyk" / "Robocze", aby pobrać oficjalną etykietę kurierską.`,
              code: 'INSUFFICIENT_FUNDS'
            }, { status: 400 });
          }

          return NextResponse.json({
            error: `Przesyłka w Furgonetce oczekuje na opłacenie/zamówienie. Zaloguj się na ${portalUrl} i opłać przesyłkę w zakładce "Koszyk" / "Robocze". Szczegóły: ${orderMsg}`,
            code: 'ORDER_PENDING'
          }, { status: 400 });
        }
      } else {
        throw labelErr;
      }
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
