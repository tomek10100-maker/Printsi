import { NextResponse } from 'next/server';
import { processOrder } from '../../../lib/processOrder';

export { processOrder };

/**
 * POST /api/order/confirm
 * HTTP wrapper for processOrder – used by Stripe webhook and as fallback.
 */
export async function POST(req: Request) {
  try {
    const { orderId, userId } = await req.json();
    if (!orderId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing orderId or userId' }, { status: 400 });
    }
    const result = await processOrder(orderId, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Order confirm error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
