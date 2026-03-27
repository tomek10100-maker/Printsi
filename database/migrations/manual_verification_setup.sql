-- =============================================================
-- MIGRATION: Manual Email Verification & Role Cleanup
-- =============================================================

-- Add verification fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid();

-- Create a search index for tokens
CREATE INDEX IF NOT EXISTS idx_verification_token ON public.profiles(verification_token);

-- Update RLS for profiles to allow public viewing of verified status if needed
-- (Already handled by existing profile policies usually)
