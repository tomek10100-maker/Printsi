-- Run this in Supabase Dashboard → SQL Editor
-- Adds the columns that the onboarding survey saves

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roles         TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country_code  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS currency      VARCHAR(10) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
