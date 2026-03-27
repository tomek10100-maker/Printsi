-- =============================================================
-- MIGRATION: Ensure disputes table exactly matches the 3D file requirements
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================================

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid not null default gen_random_uuid (),
  order_item_id uuid null,
  chat_id uuid null,
  buyer_id uuid null,
  seller_id uuid null,
  problem_type text not null,
  description text not null,
  contact_email text not null,
  status text null default 'open'::text,
  admin_notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  package_id text null,
  constraint disputes_pkey primary key (id),
  constraint disputes_buyer_id_fkey foreign KEY (buyer_id) references profiles (id) on delete CASCADE,
  constraint disputes_chat_id_fkey foreign KEY (chat_id) references chats (id) on delete set null,
  constraint disputes_order_item_id_fkey foreign KEY (order_item_id) references order_items (id) on delete CASCADE,
  constraint disputes_seller_id_fkey foreign KEY (seller_id) references profiles (id) on delete CASCADE
);

-- Enable RLS just in case it wasn't
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_v2 ON public.disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_v2 ON public.disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status_v2 ON public.disputes(status);

-- Policies (Buyer & Seller can read)
DROP POLICY IF EXISTS "Disputes: both parties can view" ON public.disputes;
CREATE POLICY "Disputes: both parties can view"
  ON public.disputes FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Buyer can create
DROP POLICY IF EXISTS "Disputes: buyers can create" ON public.disputes;
CREATE POLICY "Disputes: buyers can create"
  ON public.disputes FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
