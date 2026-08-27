'use client';

import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, CheckCircle, Image as ImageIcon, MessageSquare, Loader2 } from 'lucide-react';

interface ReviewsSectionProps {
  offerId: string;
  sellerId?: string;
}

export default function ReviewsSection({ offerId, sellerId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    averageRating: number;
    totalCount: number;
    distribution: Record<number, number>;
  }>({
    averageRating: 0,
    totalCount: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reviews?offerId=${offerId}`);
        const data = await res.json();
        if (data.reviews) setReviews(data.reviews);
        if (data.stats) setStats(data.stats);
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        setLoading(false);
      }
    };
    if (offerId) fetchReviews();
  }, [offerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  // Extract all "Make" photos from reviews
  const allMakePhotos: { url: string; rating: number; buyerName: string }[] = [];
  reviews.forEach(r => {
    if (r.image_urls && Array.isArray(r.image_urls)) {
      r.image_urls.forEach((url: string) => {
        allMakePhotos.push({
          url,
          rating: r.rating,
          buyerName: r.profiles?.full_name || 'Buyer',
        });
      });
    }
  });

  return (
    <div className="space-y-8">
      {/* Header & Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
        {/* Average Rating Big Display */}
        <div className="flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-6 md:pb-0 md:pr-6">
          <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '5.0'}
          </div>
          <div className="flex items-center gap-1 my-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                size={18}
                className={
                  star <= Math.round(stats.averageRating || 5)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-300 dark:text-slate-700'
                }
              />
            ))}
          </div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Based on {stats.totalCount} {stats.totalCount === 1 ? 'verified review' : 'verified reviews'}
          </p>
        </div>

        {/* Rating Breakdown Progress Bars */}
        <div className="md:col-span-2 space-y-2 justify-center flex flex-col">
          {[5, 4, 3, 2, 1].map(star => {
            const count = stats.distribution[star] || 0;
            const pct = stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0;

            return (
              <div key={star} className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
                <span className="w-12 text-right flex items-center justify-end gap-1">
                  {star} <Star size={12} className="text-amber-400 fill-amber-400" />
                </span>
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-slate-400 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* "Makes" Gallery Section (Buyer Uploaded Photos) */}
      {allMakePhotos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <ImageIcon size={16} className="text-amber-500" />
            Customer "Makes" ({allMakePhotos.length} photos)
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {allMakePhotos.map((photo, idx) => (
              <button
                key={idx}
                onClick={() => setActivePhoto(photo.url)}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 group focus:outline-none"
              >
                <img
                  src={photo.url}
                  alt={`Make by ${photo.buyerName}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute bottom-1 left-1 bg-slate-900/80 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Star size={9} className="fill-amber-400" /> {photo.rating}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photo Modal Preview */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl bg-slate-900">
            <img src={activePhoto} alt="Enlarged make" className="max-w-full max-h-[85vh] object-contain" />
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-700" />
          <h5 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No reviews yet for this listing</h5>
          <p className="text-xs text-slate-400">Be the first verified buyer to rate and upload a photo after receiving your item!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-xs">
                    {rev.profiles?.avatar_url ? (
                      <img src={rev.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      rev.profiles?.full_name?.[0] || 'U'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900 dark:text-white">
                        {rev.profiles?.full_name || 'Verified Buyer'}
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle size={10} /> Verified Purchase
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(rev.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Rating stars */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-700/60">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      size={13}
                      className={
                        star <= rev.rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200 dark:text-slate-700'
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Written comment */}
              {rev.comment && (
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed pl-1">
                  "{rev.comment}"
                </p>
              )}

              {/* Review photos */}
              {rev.image_urls && rev.image_urls.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {rev.image_urls.map((img: string, i: number) => (
                    <img
                      key={i}
                      src={img}
                      onClick={() => setActivePhoto(img)}
                      alt="Review make"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
