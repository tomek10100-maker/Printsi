-- =============================================================
-- PRINTSI — Full Supabase Schema Setup
-- Run this ENTIRE file in: Supabase Dashboard → SQL Editor
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
--    Mirrors auth.users and stores all app-level user data
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
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

-- Allow users to read/write only their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow public read for marketplace (other users can see basic profile info)
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- 2. AUTO-CREATE PROFILE ON SIGNUP — THE KEY TRIGGER
--    This fires every time a new user signs up (email or Google)
--    and creates their profile row automatically.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges to write to profiles
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  )
  ON CONFLICT (id) DO NOTHING;  -- Safe: won't fail if profile already exists
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- 3. OFFERS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  title           VARCHAR(150) NOT NULL,
  description     TEXT,
  price           DECIMAL(10, 2) NOT NULL,
  location        VARCHAR(100),
  image_urls      TEXT[],
  source_file_url VARCHAR(255),
  material        VARCHAR(50),
  color           VARCHAR(30),
  weight_grams    INTEGER,
  stock           INTEGER DEFAULT 1,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active offers"
  ON public.offers FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Sellers can manage their own offers"
  ON public.offers FOR ALL
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 4. ORDERS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
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
  ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id);


-- ─────────────────────────────────────────────────────────────
-- 5. ORDER ITEMS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  offer_id            UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  seller_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantity            INTEGER DEFAULT 1,
  price_at_purchase   DECIMAL(10, 2) NOT NULL,
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


-- ─────────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
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
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- 7. DECREMENT STOCK HELPER FUNCTION
--    Used by the Stripe webhook to reduce stock after purchase
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- 8. INDEXES for performance
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_offers_category   ON public.offers(category);
CREATE INDEX IF NOT EXISTS idx_offers_user_id    ON public.offers(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id   ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifs_is_read    ON public.notifications(user_id, is_read);


-- ─────────────────────────────────────────────────────────────
-- DONE ✅
-- After running this, try logging in or signing up.
-- A profile row will be auto-created in the profiles table.
-- ─────────────────────────────────────────────────────────────
