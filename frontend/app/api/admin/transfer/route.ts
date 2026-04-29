import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. ZABEZPIECZENIE (KRYTYCZNE!)
    // Weryfikacja po tokenie administratora, skonfiguruj zmienną w .env.local
    const authHeader = req.headers.get('Authorization');
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    
    // Jeśli używasz innej weryfikacji (np. sprawdzasz rolę 'admin' przez getUser z Supabase), zmodyfikuj poniższy if.
    if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Brak dostępu. Niewłaściwy token administratora.' }, { status: 401 });
    }

    const body = await req.json();
    const { connectedAccountId, amountInGrosze, orderId } = body;

    if (!connectedAccountId || !amountInGrosze || !orderId) {
        return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 });
    }

    // 2. Wykonanie fizycznego przelewu (Transfer) z głównego konta na sub-konto
    const transfer = await stripe.transfers.create({
      amount: amountInGrosze,
      currency: 'pln',
      destination: connectedAccountId,
      transfer_group: `ORDER_${orderId}`,
    });

    // 3. Aktualizacja bazy danych po udanym transferze
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'transfer_completed', 
        stripe_transfer_id: transfer.id 
      })
      .eq('id', orderId);

    if (updateError) {
      console.error("Update DB error:", updateError);
      return NextResponse.json({ 
        success: true, 
        transferId: transfer.id, 
        warning: "Transfer wykonany, ale baza danych nie została zaktualizowana." 
      });
    }

    return NextResponse.json({ success: true, transferId: transfer.id });
    
  } catch (error: any) {
    console.error("Błąd transferu:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
