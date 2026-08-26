-- ============================================================
-- Printis Shipping Tracking Migration
-- Run this in Supabase SQL editor
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS ship_by_deadline         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_number          TEXT,
  ADD COLUMN IF NOT EXISTS carrier                  TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_confirm_deadline   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extension_requested_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extension_approved        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS extension_denied          BOOLEAN DEFAULT FALSE;
