import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client for secure backend operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Token autoryzacyjny zdefiniowany w zmiennych środowiskowych
const FURGONETKA_SECRET = process.env.FURGONETKA_WEBHOOK_SECRET || 'ZMIEN_MNIE_NA_BEZPIECZNY_TOKEN_123';

export async function POST(req: Request) {
  try {
    // 1. Sprawdzenie autoryzacji (Zabezpieczenie przed nieautoryzowanym dostępem)
    const authHeader = req.headers.get('authorization') || req.headers.get('x-furgonetka-token') || '';
    
    // Sprawdzamy czy przesłany token pasuje do naszego (często w formacie "Bearer <token>" lub sam token)
    const providedToken = authHeader.replace('Bearer ', '').trim();
    
    if (providedToken !== FURGONETKA_SECRET) {
      console.warn('Furgonetka Webhook: Błędny token autoryzacyjny', { providedToken });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pobranie danych przesłanych przez Furgonetkę
    const payload = await req.json();
    console.log('📦 Furgonetka Webhook Otrzymany:', JSON.stringify(payload, null, 2));

    // Tutaj w przyszłości zmapujemy statusy z Furgonetki (np. "delivered") na nasze statusy w bazie
    // Przykład struktury (zależne od faktycznego payloadu Furgonetki):
    /*
    const trackingCode = payload.tracking_number;
    const newState = payload.state; // np. 'delivered'
    
    if (newState === 'delivered' && trackingCode) {
       await supabase.from('order_items').update({ status: 'delivered' }).eq('tracking_code', trackingCode);
    }
    */

    // 3. Zawsze zwracamy 200 OK, aby Furgonetka wiedziała, że odebraliśmy wiadomość
    return NextResponse.json({ success: true, message: 'Webhook odebrany poprawnie' }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Błąd Furgonetka Webhook:', error);
    // W przypadku błędu serwera zwracamy 500, Furgonetka spróbuje wysłać ponownie później
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
