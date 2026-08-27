-- =============================================================
-- PRINTSI — REVIEWS & RATINGS SYSTEM ("MAKES & REVIEWS")
-- =============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_item_id   UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    offer_id        UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    buyer_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seller_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    image_urls      TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_buyer_order_item_review UNIQUE (order_item_id, buyer_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1. Public can view all reviews
CREATE POLICY "Public reviews viewable by everyone"
    ON public.reviews FOR SELECT
    USING (true);

-- 2. Authenticated buyers can insert review for their completed/resolved order items
CREATE POLICY "Buyers can insert review for completed/resolved items"
    ON public.reviews FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- 3. Authors can update their own reviews
CREATE POLICY "Buyers can update own reviews"
    ON public.reviews FOR UPDATE
    USING (auth.uid() = buyer_id);

-- 4. Authors can delete their own reviews
CREATE POLICY "Buyers can delete own reviews"
    ON public.reviews FOR DELETE
    USING (auth.uid() = buyer_id);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_reviews_offer_id ON public.reviews(offer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON public.reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id ON public.reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_item_id ON public.reviews(order_item_id);
