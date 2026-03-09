-- =============================================================
-- MIGRACJA: Dodanie brakujących kolumn do tabeli offers
-- Uruchom w: Supabase Dashboard → SQL Editor → New Query → Run
-- BEZPIECZNE: Nie usuwa danych, tylko dodaje brakujące kolumny
-- =============================================================

-- Dodaj color_variants (JSONB) jeśli nie istnieje
ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS color_variants JSONB;

-- Dodaj source_file_url jeśli nie istnieje
ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS source_file_url VARCHAR(255);

-- Dodaj filament_id jeśli nie istnieje
ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS filament_id UUID REFERENCES public.filaments(id) ON DELETE SET NULL;

-- Sprawdź czy kolumna została dodana poprawnie
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'offers'
ORDER BY ordinal_position;
