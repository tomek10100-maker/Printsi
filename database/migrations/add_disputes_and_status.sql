-- =============================================================
-- MIGRATION: Add disputes table, order_items.status column, messages.message_type column
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Add status column to order_items (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- 2. Add message_type column to messages (for system vs user messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN message_type TEXT DEFAULT 'user';
    -- Types: 'user', 'system', 'status_shipped', 'status_delivered', 'status_completed', 'status_disputed', 'dispute_opened'
  END IF;
END $$;

-- 3. Create disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id   UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  chat_id         UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  buyer_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Dispute details
  problem_type    TEXT NOT NULL,  -- 'damaged', 'wrong_item', 'not_received', 'quality_issue', 'missing_parts', 'other'
  description     TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  
  -- Resolution
  status          TEXT DEFAULT 'open',  -- 'open', 'in_review', 'resolved', 'rejected'
  admin_notes     TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Buyers and sellers can view their disputes
CREATE POLICY "Users can view their disputes"
  ON public.disputes FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Buyers can create disputes
CREATE POLICY "Buyers can create disputes"
  ON public.disputes FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_disputes_buyer ON public.disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller ON public.disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);

-- 4. Allow system messages (sender_id can be null for pure system messages)
-- The current RLS policy requires sender_id = auth.uid() for inserts. 
-- For server-side (service role) this is bypassed, so no change needed.

-- 5. Fix decrement_stock function (add SECURITY DEFINER to ensure it runs correctly)
CREATE OR REPLACE FUNCTION public.decrement_stock(row_id UUID, quantity_amt INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offers
  SET stock = GREATEST(stock - quantity_amt, 0)
  WHERE id = row_id;
END;
$$;

-- 6. Also allow updating order_items status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_items' AND policyname = 'Sellers can update their order items'
  ) THEN
    CREATE POLICY "Sellers can update their order items"
      ON public.order_items FOR UPDATE
      USING (auth.uid() = seller_id);
  END IF;
END $$;

-- 7. Allow inserting order items (for service role, but just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_items' AND policyname = 'Users can insert order items'
  ) THEN
    CREATE POLICY "Users can insert order items"
      ON public.order_items FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- =============================================================
-- DONE ✅
-- =============================================================
