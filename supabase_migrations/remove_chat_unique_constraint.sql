-- Migration: Remove unique constraint on chats table to allow multiple purchases of the same item
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_buyer_id_seller_id_offer_id_key;
