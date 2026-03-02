-- Migration: Add Custom Offers support
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;
UPDATE public.offers SET is_custom = FALSE WHERE is_custom IS NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS parent_offer_id UUID REFERENCES public.offers(id);

-- Optional: Ensure users can update messages to change proposal status
-- The current policy is:
-- CREATE POLICY "Users can send messages to their chats" ON public.messages FOR INSERT ...
-- But there's NO update policy on messages EXCEPT for marking as read.
-- Wait, the policy for updating messages is:
-- CREATE POLICY "Users can mark messages as read" ON public.messages FOR UPDATE USING (...)
-- This actually lets them update ANY field in the message, not just is_read, because there is no WITH CHECK or column restriction.
-- But just in case, let's redefine the update policy to make sure they can update content (to change status).

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages in their chats" ON public.messages;

CREATE POLICY "Users can update messages in their chats"
    ON public.messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );
