'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, Loader2, Camera, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BUCKET_NAME = 'printsi-files1';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderItemId: string;
  productTitle?: string;
  sellerName?: string;
  existingReview?: any;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  orderItemId,
  productTitle = 'Item',
  sellerName = 'Seller',
  existingReview = null,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(existingReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>(existingReview?.comment || '');
  const [images, setImages] = useState<string[]>(existingReview?.image_urls || []);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating || 5);
      setComment(existingReview.comment || '');
      setImages(existingReview.image_urls || []);
    } else {
      setRating(5);
      setComment('');
      setImages([]);
    }
    setError(null);
    setSuccessMsg(false);
  }, [existingReview, isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [...images];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          setError('Each photo must be smaller than 10MB.');
          continue;
        }

        const ext = file.name.split('.').pop();
        const fileName = `reviews/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, file, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      setImages(uploadedUrls);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('You must be logged in to leave a review.');
        setSubmitting(false);
        return;
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderItemId,
          rating,
          comment,
          imageUrls: images,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review.');
      }

      setSuccessMsg(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-black text-lg text-gray-900 dark:text-white tracking-tight">
              {existingReview ? 'Edit Your Review' : 'Rate & Review Your Purchase'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-semibold truncate max-w-xs mt-0.5">
              {productTitle} · {sellerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {successMsg ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-lg font-black text-gray-900 dark:text-white">Thank You for Your Feedback!</h4>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">Your review and make photo have been published.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Star Rating Selection */}
              <div className="text-center space-y-2 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  How would you rate this item & print quality?
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        className="p-1 transition transform hover:scale-125 active:scale-95 focus:outline-none"
                      >
                        <Star
                          size={32}
                          className={`transition-colors ${
                            active
                              ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                              : 'text-gray-300 dark:text-slate-700'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {rating === 5 && '🌟 Excellent — Perfect quality!'}
                  {rating === 4 && '👍 Very Good — High quality'}
                  {rating === 3 && '😐 Average — Met expectations'}
                  {rating === 2 && '👎 Below Average — Issues noticed'}
                  {rating === 1 && '😞 Poor — Disappointed'}
                </p>
              </div>

              {/* Comment Text Area */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">
                  Your Written Review (Optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about the print quality, material finish, shipping speed or communication..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              {/* Photo Upload ("Make Photo") */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">
                  Add "Make" Photos of the Printed Item
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 group">
                      <img src={url} alt="Make preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 transition"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {images.length < 4 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-500 cursor-pointer transition bg-gray-50 dark:bg-slate-800/60">
                      {uploadingImage ? (
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                      ) : (
                        <>
                          <Camera size={18} />
                          <span className="text-[9px] font-black uppercase mt-1">Photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingImage}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Star size={14} className="fill-white" />
                      Submit Review
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
