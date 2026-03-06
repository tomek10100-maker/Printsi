-- ============================================================
-- FILAMENTS TABLE
-- Stores filament inventory for users with the "printer" role
-- ============================================================

CREATE TABLE IF NOT EXISTS public.filaments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Filament identity
  plastic_type  TEXT NOT NULL,            -- e.g. PLA, PETG, ABS, TPU, ASA, NYLON
  color_name    TEXT NOT NULL,            -- e.g. "Fiery Red", "Ocean Blue"
  color_hex     TEXT NOT NULL,            -- e.g. "#FF4500"
  brand         TEXT,                     -- optional brand name e.g. "eSUN PLA+ Silk"

  -- Pricing (always stored per gram internally)
  price_per_gram  NUMERIC(10, 6) NOT NULL, -- price in EUR per gram
  price_unit      TEXT NOT NULL DEFAULT 'kg', -- 'kg' or 'g' (user's input preference)
  
  -- Tracking original user input to avoid exchange rate drift
  price_input_native NUMERIC(15, 2),        -- original price entered by user
  currency_native    TEXT DEFAULT 'EUR',    -- currency used during input (e.g. 'PLN')

  -- Optional stock tracking
  stock_grams   NUMERIC(10, 2),           -- optional: how many grams left

  -- Soft delete / archiving
  is_active     BOOLEAN NOT NULL DEFAULT true,

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own filaments
CREATE POLICY "Users can view own filaments"
  ON public.filaments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own filaments
CREATE POLICY "Users can insert own filaments"
  ON public.filaments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own filaments
CREATE POLICY "Users can update own filaments"
  ON public.filaments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own filaments
CREATE POLICY "Users can delete own filaments"
  ON public.filaments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS filaments_user_id_idx ON public.filaments(user_id);
