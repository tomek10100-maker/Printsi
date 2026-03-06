-- =============================================================
-- PRINTSI — PEŁNY RESET + REBUILD SCHEMATU
-- Wklej do: Supabase Dashboard → SQL Editor → Run All
-- UWAGA: To usuwa WSZYSTKIE dane!
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 0. RESET — usuń wszystkie tabele i triggery
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.decrement_stock(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.decrement_filament_stock(UUID, NUMERIC) CASCADE;

DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.custom_offers CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.order_shipping_details CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.filaments CASCADE;
DROP TABLE IF EXISTS public.offers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;


-- =============================================================
-- 1. PROFILES
-- =============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  city          TEXT,
  country       TEXT,
  country_code  VARCHAR(10),
  roles         TEXT[]   DEFAULT '{}',
  currency      VARCHAR(10) DEFAULT 'EUR',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);


-- =============================================================
-- 2. AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =============================================================
-- 3. FILAMENTS
-- Magazyn filamentów dla użytkowników z rolą "printer"
-- =============================================================
CREATE TABLE public.filaments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plastic_type    TEXT NOT NULL,
  color_name      TEXT NOT NULL,
  color_hex       TEXT NOT NULL,
  brand           TEXT,
  price_per_gram  NUMERIC(10, 6) NOT NULL,
  price_unit      TEXT NOT NULL DEFAULT 'kg',
  price_input_native NUMERIC(15, 2),
  currency_native TEXT DEFAULT 'EUR',
  stock_grams     NUMERIC(10, 2),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own filaments"
  ON public.filaments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own filaments"
  ON public.filaments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filaments"
  ON public.filaments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own filaments"
  ON public.filaments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS filaments_user_id_idx ON public.filaments(user_id);


-- =============================================================
-- 4. OFFERS
-- color_variants: JSONB przechowuje warianty kolorystyczne
-- Każdy wariant zawiera: filament_id, grams, priceEUR, stock, warstwy
-- =============================================================
CREATE TABLE public.offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  title           VARCHAR(150) NOT NULL,
  description     TEXT,
  price           DECIMAL(10, 2) NOT NULL,
  location        VARCHAR(100),
  image_urls      TEXT[],
  image_url       TEXT,
  source_file_url VARCHAR(255),
  file_url        VARCHAR(255),
  material        VARCHAR(50),
  color           VARCHAR(30),
  color_name      VARCHAR(100),
  weight          TEXT,
  dimensions      TEXT,
  stock           INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  is_custom       BOOLEAN DEFAULT FALSE,
  parent_offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,

  -- Warianty kolorystyczne (JSONB) — tylko dla fizycznych
  -- Struktura: [{variantId, label, color_name, plastic_type, priceEUR,
  --              markupType, markupValue, stock, primaryColor, isMultiColor,
  --              layers: [{filament_id, color_hex, color_name, plastic_type, grams}]}]
  color_variants  JSONB,

  -- ID filamentu (główny, dla prostych ofert bez wielu wariantów)
  filament_id     UUID REFERENCES public.filaments(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers"
  ON public.offers FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Sellers can manage their own offers"
  ON public.offers FOR ALL USING (auth.uid() = user_id);


-- =============================================================
-- 5. ORDERS
-- =============================================================
CREATE TABLE public.orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_amount            DECIMAL(10, 2) NOT NULL,
  status                  TEXT DEFAULT 'pending',
  shipping_address        JSONB,
  stripe_payment_intent_id TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can see their own orders"
  ON public.orders FOR SELECT USING (auth.uid() = buyer_id);


-- =============================================================
-- 6. ORDER ITEMS
-- variant_name, variant_filament_layers — do obliczenia zużycia filamentu
-- =============================================================
CREATE TABLE public.order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  offer_id            UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  seller_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantity            INTEGER DEFAULT 1,
  price_at_purchase   DECIMAL(10, 2) NOT NULL,
  -- Informacje o wybranym wariancie kolorystycznym (do obliczeń filamentu)
  variant_name        TEXT,
  variant_color_hex   TEXT,
  variant_layers      JSONB, -- [{filament_id, grams}]
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and sellers can see their order items"
  ON public.order_items FOR SELECT
  USING (
    auth.uid() = seller_id
    OR auth.uid() IN (
      SELECT buyer_id FROM public.orders WHERE id = order_id
    )
  );


-- =============================================================
-- 7. NOTIFICATIONS
-- =============================================================
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own notifications"
  ON public.notifications FOR ALL USING (auth.uid() = user_id);


-- =============================================================
-- 8. ORDER SHIPPING DETAILS
-- =============================================================
CREATE TABLE public.order_shipping_details (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  full_name  TEXT,
  email      TEXT,
  address    TEXT,
  city       TEXT,
  zip_code   TEXT,
  country    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_shipping_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view their own shipping details"
  ON public.order_shipping_details FOR SELECT
  USING (
    auth.uid() IN (
      SELECT buyer_id FROM public.orders WHERE id = order_id
    )
  );


-- =============================================================
-- 9. CHATS + MESSAGES
-- =============================================================
CREATE TABLE public.chats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_id     UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view their chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can insert chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);


CREATE TABLE public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages"
  ON public.messages FOR SELECT
  USING (
    auth.uid() IN (
      SELECT buyer_id FROM public.chats WHERE id = chat_id
      UNION
      SELECT seller_id FROM public.chats WHERE id = chat_id
    )
  );

CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = sender_id);


-- =============================================================
-- 10. FAVORITES
-- =============================================================
CREATE TABLE public.favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_id   UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, offer_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorites"
  ON public.favorites FOR ALL USING (auth.uid() = user_id);


-- =============================================================
-- 11. CUSTOM OFFERS
-- =============================================================
CREATE TABLE public.custom_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  buyer_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  custom_price    DECIMAL(10, 2) NOT NULL,
  notes           TEXT,
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can manage custom offers"
  ON public.custom_offers FOR ALL
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);


-- =============================================================
-- 12. HELPER FUNCTIONS
-- =============================================================

-- Zmniejsza stock oferty po sprzedaży
CREATE OR REPLACE FUNCTION public.decrement_stock(row_id UUID, quantity_amt INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.offers
  SET stock = GREATEST(stock - quantity_amt, 0)
  WHERE id = row_id;
END;
$$;

-- Zmniejsza stock_grams filamentu po sprzedaży
-- Wywoływana przez /api/order/confirm dla każdej warstwy filamentu w wariancie
CREATE OR REPLACE FUNCTION public.decrement_filament_stock(filament_id UUID, grams_used NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.filaments
  SET 
    stock_grams = GREATEST(COALESCE(stock_grams, 0) - grams_used, 0),
    updated_at = NOW()
  WHERE id = filament_id AND stock_grams IS NOT NULL;
END;
$$;


-- =============================================================
-- 13. INDEXES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_offers_category   ON public.offers(category);
CREATE INDEX IF NOT EXISTS idx_offers_user_id    ON public.offers(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id   ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_is_read    ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_filaments_user    ON public.filaments(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_offer ON public.order_items(offer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_chats_buyer       ON public.chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller      ON public.chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat     ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user    ON public.favorites(user_id);


-- =============================================================
-- DONE ✅
-- Schemat gotowy. Możesz się teraz zarejestrować/zalogować.
-- Profil zostanie automatycznie utworzony po pierwszym logowaniu.
-- =============================================================
