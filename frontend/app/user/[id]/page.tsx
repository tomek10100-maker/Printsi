'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import {
  MapPin, Calendar, Loader2, ArrowLeft, Star,
  Package, ShoppingBag, ArrowRight, User as UserIcon, Flag, X, CheckCircle, Handshake
} from 'lucide-react';
import { useCurrency } from '../../../context/CurrencyContext';
import { getCountryDisplay } from '../../lib/countryHelpers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [profile, setProfile] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [sellerStats, setSellerStats] = useState<{ avgRating: number; count: number }>({ avgRating: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Report user modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!params.id) return;

      // Get current logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // 1. Pobierz dane profilu
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single();

      if (profileErr) {
        console.error(profileErr);
        router.push('/gallery');
        return;
      }

      // 2. Pobierz oferty tego użytkownika (ukrywamy customowe zlecenia)
      const { data: offersData } = await supabase
        .from('offers')
        .select('*')
        .eq('user_id', params.id)
        .or('is_custom.eq.false,is_custom.is.null')
        .order('created_at', { ascending: false });

      // 3. Pobierz opinie i oblicz średnią gwiazdek sprzedającego
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('seller_id', params.id);

      if (reviewsData && reviewsData.length > 0) {
        const sum = reviewsData.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        const avg = Math.round((sum / reviewsData.length) * 10) / 10;
        setSellerStats({ avgRating: avg, count: reviewsData.length });
      } else {
        setSellerStats({ avgRating: 0, count: 0 });
      }

      setProfile(profileData);
      setOffers(offersData || []);
      setLoading(false);
    };

    fetchPublicData();
  }, [params.id, router]);

  const handleReportUser = async () => {
    if (!reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'report',
          subject: `User Report: ${profile?.full_name || params.id}`,
          message: `Reason: ${reportReason}\n\nDetails: ${reportDesc}\n\nReported User ID: ${params.id}\nProfile URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
          contact: currentUser?.email || 'anonymous',
        }),
      });
      setReportDone(true);
    } catch (e) {
      console.error('Report user error:', e);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  const isOwnProfile = currentUser && String(currentUser.id) === String(params.id);

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">

      {/* HEADER / NAVIGATION */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link href="/gallery" className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft size={16} /> Back to Marketplace
        </Link>
        <img src="/logo.jpg" alt="Printis" className="h-6 w-auto rounded-xl object-cover" />
      </nav>

      {/* COVER SECTION */}
      <div className="h-48 bg-gray-900 relative">
        <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="relative -mt-16 mb-12 flex flex-col md:flex-row items-end gap-6">
          {/* AVATAR */}
          <div className="w-32 h-32 bg-white p-1 rounded-3xl shadow-xl flex-shrink-0">
            <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
              ) : (
                <UserIcon size={48} className="text-gray-300" />
              )}
            </div>
          </div>

          <div className="flex-1 mb-2">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{profile?.full_name || 'Anonymous Maker'}</h1>
            <div className="flex flex-wrap gap-3 mt-2 items-center">
              {sellerStats.count > 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span>{sellerStats.avgRating.toFixed(1)}</span>
                  <span className="text-gray-500 font-bold text-[11px]">({sellerStats.count} {sellerStats.count === 1 ? 'review' : 'reviews'})</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                  <Star size={14} className="text-gray-300" /> No reviews yet
                </span>
              )}
              {(() => {
                const c = getCountryDisplay(profile?.country);
                return (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200 uppercase tracking-wider">
                    <span>{c.flag}</span> {c.code}
                  </span>
                );
              })()}
              <span className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider"><Calendar size={14} /> Joined 2026</span>
            </div>
          </div>

          {/* Contact / Negotiate button — only for logged-in non-owners */}
          {currentUser && !isOwnProfile && (
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => {
                  const firstOffer = offers[0];
                  if (firstOffer) {
                    router.push(`/profile/messages?seller_id=${params.id}&offer_id=${firstOffer.id}`);
                  } else {
                    router.push(`/profile/messages?seller_id=${params.id}`);
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition text-xs font-black uppercase tracking-widest shadow-md active:scale-95"
              >
                <Handshake size={16} /> Contact / Negotiate
              </button>

              <button
                onClick={() => { setReportDone(false); setReportReason(''); setReportDesc(''); setShowReportModal(true); }}
                title="Report this user"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-400 hover:text-red-500 transition text-xs font-black uppercase tracking-widest"
              >
                <Flag size={14} /> Report
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* SIDEBAR: INFO */}
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black uppercase text-xs tracking-widest text-gray-400 mb-4">About Designer</h3>
              <p className="text-gray-600 text-sm leading-relaxed font-medium">
                {profile?.bio || "This creator hasn't shared a bio yet."}
              </p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-black uppercase text-xs tracking-widest text-gray-400 mb-4">Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.roles?.map((role: string) => (
                  <span key={role} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-wide border border-gray-200">{role}</span>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN CONTENT: OFFERS */}
          <div className="lg:col-span-3 space-y-6">
            <h2 className="text-xl font-black uppercase text-gray-900 flex items-center gap-3">
              <ShoppingBag className="text-blue-600" /> Listings by {profile?.full_name?.split(' ')[0]}
            </h2>

            {offers.length === 0 ? (
              <div className="bg-white p-20 rounded-3xl border-2 border-dashed border-gray-200 text-center">
                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-400 font-bold uppercase text-xs">No active listings at the moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {offers.map((offer) => (
                  <Link key={offer.id} href={`/offer/${offer.id}`} className="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      <img
                        src={offer.image_urls?.[0] || '/placeholder.jpg'}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[8px] font-black uppercase tracking-wider">
                        {offer.category}
                      </div>
                    </div>
                    <div className="p-4 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{offer.title}</h4>
                        <p className="text-blue-600 font-black text-sm">{formatPrice(offer.price)}</p>
                      </div>
                      <div className="mt-2 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all self-end">
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── REPORT USER MODAL ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 flex items-center gap-3">
              <Flag size={18} className="text-white" />
              <span className="text-sm font-black uppercase tracking-widest text-white">Report this User</span>
              <button onClick={() => setShowReportModal(false)} className="ml-auto text-white/70 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {reportDone ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} className="text-emerald-500" />
                  </div>
                  <p className="text-base font-black text-gray-900">Report submitted</p>
                  <p className="text-sm text-gray-500 font-medium">Our team will review this report and take appropriate action.</p>
                  <button onClick={() => setShowReportModal(false)} className="mt-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition">Close</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Reason *</label>
                    <select
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Fraud or scam behavior">Fraud or scam behavior</option>
                      <option value="Harassment or abuse">Harassment or abuse</option>
                      <option value="Fake or impersonating account">Fake or impersonating account</option>
                      <option value="Selling prohibited items">Selling prohibited items</option>
                      <option value="Suspicious activity">Suspicious activity</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Additional details (optional)</label>
                    <textarea
                      value={reportDesc}
                      onChange={e => setReportDesc(e.target.value)}
                      placeholder="Describe the issue..."
                      rows={4}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={handleReportUser}
                    disabled={!reportReason || reportSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {reportSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                    Submit Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}