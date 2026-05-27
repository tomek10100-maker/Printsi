-- Migration: Add archiving and completion tracking to chats table
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE chats ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS archived_by TEXT; -- 'auto' | 'manual'
ALTER TABLE chats ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
