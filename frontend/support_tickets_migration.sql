-- Utwórz tabelę support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category    text NOT NULL CHECK (category IN ('general', 'order', 'technical', 'copyright')),
  subject     text NOT NULL,
  message     text NOT NULL,
  contact     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Polityki RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Każdy może wstawiać zgłoszenia (nawet niezalogowany)
CREATE POLICY "Anyone can insert support tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (true);

-- Tylko zalogowani admini mogą czytać (można dopasować do roli)
-- Na razie odblokuj dla wszystkich zalogowanych:
CREATE POLICY "Authenticated users can read their tickets"
  ON public.support_tickets
  FOR SELECT
  USING (auth.role() = 'authenticated');
