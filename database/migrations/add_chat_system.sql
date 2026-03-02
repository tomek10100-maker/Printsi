-- Migration: Create Chat System Tables
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create CHATS table
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL, -- Link to the product discussed
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- Link to purchase if applicable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(buyer_id, seller_id, offer_id) -- Prevent duplicate chats for the same product between same users
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chats"
    ON public.chats FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create chats if they are the buyer or seller"
    ON public.chats FOR INSERT
    WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can update their own chats"
    ON public.chats FOR UPDATE
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- 2. Create MESSAGES table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their chats"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages to their chats"
    ON public.messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );

CREATE POLICY "Users can mark messages as read"
    ON public.messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.chats 
            WHERE chats.id = messages.chat_id 
            AND (chats.buyer_id = auth.uid() OR chats.seller_id = auth.uid())
        )
    );

-- 3. Trigger to update chat's updated_at timestamp when a new message is sent
CREATE OR REPLACE FUNCTION public.update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chats
    SET updated_at = NOW()
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE PROCEDURE public.update_chat_timestamp();

-- 4. Indexes for fast loading
CREATE INDEX IF NOT EXISTS idx_chats_buyer ON public.chats(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_seller ON public.chats(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(chat_id, is_read);
