'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, MessageSquare, Loader2, Send, Package, User, Handshake, Check, X,
    Truck, PackageCheck, CheckCircle2, AlertTriangle, Shield, ShieldAlert, Info, Mail, ExternalLink, Ruler, Palette, CreditCard, RefreshCcw, Download, Printer, XCircle, Archive, ArchiveRestore, Ban, ChevronDown, ChevronUp, Clock, MoreVertical, Flag, Camera, ImageIcon, Upload, Eye, Zap, ShoppingBag
} from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { POPULAR_MATERIALS, getMaterialInfo } from '@/app/lib/materialHelpers';
import ColorPickerInput from '../../components/ColorPickerInput';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type DeliveryType = 'COURIER' | 'PICKUP_POINT' | 'PARCEL_LOCKER';

export interface TrackingStatusView {
  badgeText: string;
  title: string;
  description: string;
}

export function getTrackingStatusInfo(
  status: string,
  deliveryType: DeliveryType,
  pointName?: string,
  carrierName?: string
): TrackingStatusView {
  const isLocker = deliveryType === 'PICKUP_POINT' || deliveryType === 'PARCEL_LOCKER';
  const displayCarrier = (carrierName || 'Courier').toUpperCase();

  switch ((status || '').toUpperCase()) {
    case 'IN_TRANSIT':
    case 'SHIPPED':
      return {
        badgeText: isLocker ? 'PARCEL LOCKER' : 'COURIER',
        title: `Package In Transit (${isLocker ? 'LOCKER' : 'COURIER'})`,
        description: isLocker
          ? `The seller has shipped your order. Your package is on its way to the selected parcel locker${pointName ? ` (${pointName})` : ''}.`
          : `The seller has shipped your order. Your package is currently on its way with ${displayCarrier}.`,
      };
    case 'OUT_FOR_DELIVERY':
    case 'READY_FOR_PICKUP':
      return {
        badgeText: isLocker ? 'READY FOR PICKUP' : 'OUT FOR DELIVERY',
        title: isLocker ? 'Ready for Pickup' : 'Out for Delivery',
        description: isLocker
          ? `Your parcel is waiting for pickup at ${pointName || 'the locker'}.`
          : `The courier is delivering your parcel today.`,
      };
    case 'DELIVERED':
    case 'COMPLETED':
      return {
        badgeText: 'DELIVERED',
        title: 'Package Delivered',
        description: 'Your package has been successfully collected.',
      };
    default:
      return {
        badgeText: 'PROCESSING',
        title: 'Order Processing',
        description: 'Your package is being prepared.',
      };
  }
}

const PROBLEM_TYPES = [
    { value: 'damaged', label: 'Damaged Item', icon: '📦💥', digital: false },
    { value: 'wrong_item', label: 'Wrong Item Received', icon: '🔄', digital: false },
    { value: 'not_received', label: 'Item Not Received', icon: '❌📦', digital: true },
    { value: 'quality_issue', label: 'Quality Issue', icon: '⚠️', digital: true },
    { value: 'missing_parts', label: 'Missing Parts', icon: '🧩', digital: true },
    { value: 'format_issue', label: 'Format Issue', icon: '📄', digital: true },
    { value: 'corrupted_file', label: 'Corrupted File', icon: '🚫', digital: true },
    { value: 'copyright_issue', label: 'Copyright Issue', icon: '⚖️', digital: true },
    { value: 'other', label: 'Other Issue', icon: '❓', digital: true },
];

function MessagesInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialChatId = searchParams?.get('chat');
    const paramSellerId = searchParams?.get('seller_id');
    const paramBuyerId = searchParams?.get('buyer_id');
    const paramOfferId = searchParams?.get('offer_id');
    const paramJobFulfill = searchParams?.get('job_fulfill');

    const { addItem, items: cartItems } = useCart();
    const { formatPrice, currency, rates } = useCurrency();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [chats, setChats] = useState<any[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(initialChatId);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChats, setLoadingChats] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [chatTab, setChatTab] = useState<'active' | 'archived'>('active');
    const [archivingChatId, setArchivingChatId] = useState<string | null>(null);
    const [acceptingProposalId, setAcceptingProposalId] = useState<string | null>(null);

    // Proposal Modal State
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [proposalPrice, setProposalPrice] = useState('');
    const [proposalQty, setProposalQty] = useState('1');
    const [proposalMaterial, setProposalMaterial] = useState('');
    const [proposalColor, setProposalColor] = useState('');
    const [proposalColorHex, setProposalColorHex] = useState('#cccccc');
    const [selectedFilamentId, setSelectedFilamentId] = useState<string | null>(null);
    const [sellerFilaments, setSellerFilaments] = useState<any[]>([]);
    const [showCustomFilamentInput, setShowCustomFilamentInput] = useState(false);
    const [customFilamentText, setCustomFilamentText] = useState('');
    const [loadingFilaments, setLoadingFilaments] = useState(false);

    type ParsedDim = { name: string; originalValue: number; currentValueStr: string; unit: string; isBase: boolean; };
    const [proposalDims, setProposalDims] = useState<ParsedDim[]>([]);
    const [proposalScale, setProposalScale] = useState<number>(100);
    const [editingProposalData, setEditingProposalData] = useState<any>(null);

    // Dispute Modal State
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeProblemType, setDisputeProblemType] = useState('');
    const [disputeDescription, setDisputeDescription] = useState('');
    const [disputeEmail, setDisputeEmail] = useState('');
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);

    // Cancel Modal State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelInitiator, setCancelInitiator] = useState<'seller' | 'buyer'>('seller');
    const [cancelReason, setCancelReason] = useState('');
    const [cancelSubmitting, setCancelSubmitting] = useState(false);
    const [cancelRespondSubmitting, setCancelRespondSubmitting] = useState(false);
    const [cancelError, setCancelError] = useState('');
    // For buyer cancel: store shipping info fetched from order
    const [cancelShippingEur, setCancelShippingEur] = useState(0);
    const [cancelItemTotalEur, setCancelItemTotalEur] = useState(0);

    // Report Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportSubject, setReportSubject] = useState('');
    const [reportDescription, setReportDescription] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [reportError, setReportError] = useState('');

    // 3-dot menu state
    const [showChatMenu, setShowChatMenu] = useState(false);

    // Image upload in chat
    const [chatImageUploading, setChatImageUploading] = useState(false);
    const [pendingImages, setPendingImages] = useState<File[]>([]);
    const [pendingCaption, setPendingCaption] = useState('');
    const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

    // Anti-spam / rate limit state
    const [spamCooldownSec, setSpamCooldownSec] = useState<number>(0);
    const recentSendsRef = useRef<number[]>([]);
    const lastSentTextRef = useRef<string>('');

    useEffect(() => {
        if (spamCooldownSec <= 0) return;
        const timer = setInterval(() => {
            setSpamCooldownSec(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [spamCooldownSec]);

    const checkSpamRateLimit = (textToSend: string): boolean => {
        const now = Date.now();
        recentSendsRef.current = recentSendsRef.current.filter(t => now - t < 6000);

        if (recentSendsRef.current.length >= 3) {
            setSpamCooldownSec(5);
            return true;
        }

        if (textToSend && textToSend.trim() === lastSentTextRef.current && recentSendsRef.current.length > 0) {
            const lastSendTime = recentSendsRef.current[recentSendsRef.current.length - 1];
            if (now - lastSendTime < 4000) {
                setSpamCooldownSec(4);
                return true;
            }
        }

        recentSendsRef.current.push(now);
        if (textToSend) lastSentTextRef.current = textToSend.trim();
        return false;
    };

    // Shipment confirmation state (buyer pressing OK/Problem)
    const [confirmingShipment, setConfirmingShipment] = useState(false);

    // Verification photo attachment & preview lightbox state
    const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
    const [verificationUploading, setVerificationUploading] = useState(false);
    const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

    // Handle Ctrl+V image paste for verification photos
    const processPastedVerificationItems = (items: DataTransferItemList) => {
        const MAX_PHOTOS = 5;
        const currentTotal = verificationFiles.length;
        const remainingSlots = MAX_PHOTOS - currentTotal;
        if (remainingSlots <= 0) return;

        const pastedImageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const ext = file.type.split('/')[1] || 'png';
                    const renamedFile = new File([file], `verification_photo_${Date.now()}_${i}.${ext}`, { type: file.type });
                    pastedImageFiles.push(renamedFile);
                }
            }
        }

        if (pastedImageFiles.length > 0) {
            const allowedFiles = pastedImageFiles.slice(0, remainingSlots);
            setVerificationFiles(prev => [...prev, ...allowedFiles]);
        }
    };

    // processPastedVerificationItems is called directly by the verification input onPaste event with e.stopPropagation()

    // Tracking code state
    const [trackingCodeInput, setTrackingCodeInput] = useState('');
    const [swappedLayers, setSwappedLayers] = useState<any[]>([]);

    // Job fulfillment banner state
    const [showJobProposalBanner, setShowJobProposalBanner] = useState(false);
    const [jobProposalPrice, setJobProposalPrice] = useState('');
    const [sendingJobProposal, setSendingJobProposal] = useState(false);
    const [isJobDetailsExpanded, setIsJobDetailsExpanded] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatImageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setShowProposalModal(false);
        // Auto-show job proposal banner when printer enters a job chat from the offer page
        if (paramJobFulfill === 'true') {
            setShowJobProposalBanner(true);
        } else {
            setShowJobProposalBanner(false);
        }
    }, [activeChatId]);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return router.push('/login');
            setCurrentUser(user);
            await loadChats(user.id);
        };
        init();
    }, [router]);

    const loadChats = async (userId: string) => {
        const { data: fetchedChats, error } = await supabase
            .from('chats')
            .select(`
        id, created_at, updated_at, order_id,
        buyer_id, seller_id,
        offer_id,
        offers ( id, user_id, title, image_urls, category, price, material, color_name, color, dimensions, weight, custom_instructions, color_variants, is_negotiable, file_url, parent_offer_id )
      `)
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error(error);
            setLoadingChats(false);
            return;
        }

        const enrichChats = await Promise.all((fetchedChats || []).map(async (chat) => {
            const offerObj = Array.isArray(chat.offers) ? chat.offers[0] : chat.offers;
            if (offerObj && !offerObj.file_url && offerObj.parent_offer_id) {
                const { data: pOffer } = await supabase
                    .from('offers')
                    .select('file_url')
                    .eq('id', offerObj.parent_offer_id)
                    .single();
                if (pOffer?.file_url) {
                    offerObj.file_url = pOffer.file_url;
                }
            }

            const otherUserId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;

            // Check if there are messages. Filter out empty chats to clean up database/clutter.
            const { data: mData, error: mError } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_id', chat.id)
                .limit(1);

            const isEmpty = !mError && (!mData || mData.length === 0);
            const isSupport = !chat.offer_id && !chat.order_id;

            if (isEmpty && !isSupport) {
                // User requirement: delete empty chats ONLY if they are draft product chats
                if (!chat.order_id && chat.offer_id) {
                    await supabase.from('chats').delete().eq('id', chat.id);
                    return null;
                }
            }

            let otherUser = null;
            if (isSupport) {
                otherUser = { full_name: 'Printis Support', isSupport: true, avatar_url: null };
            } else {
                const { data: otherProfile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', otherUserId)
                    .single();
                otherUser = otherProfile || { full_name: 'Unknown User' };
            }

            const { count: unreadCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('chat_id', chat.id)
                .eq('is_read', false)
                .neq('sender_id', userId);

            let orderItemInfo = null;
            if (chat.order_id && chat.offer_id) {
                const { data: rawItems } = await supabase
                    .from('order_items')
                    .select('id, status, quantity, price_at_purchase, tracking_code, furgonetka_package_id, label_url, offer_id, seller_id, ship_by_deadline, tracking_number, carrier, estimated_delivery_date, delivered_at, buyer_confirm_deadline, buyer_confirmed_at, extension_requested_at, extension_approved, extension_denied, offers(parent_offer_id)')
                    .eq('order_id', chat.order_id)
                    .eq('seller_id', chat.seller_id);

                if (rawItems && rawItems.length > 0) {
                    const match = rawItems.find((item: any) => {
                        const parentId = Array.isArray(item.offers) ? item.offers[0]?.parent_offer_id : item.offers?.parent_offer_id;
                        return item.offer_id === chat.offer_id || parentId === chat.offer_id;
                    });
                    if (match) {
                        orderItemInfo = {
                            ...match,
                            status: match.status || 'pending',
                        };
                    }
                }
            }

            let shippingInfo = null;
            if (chat.order_id) {
                const { data: sd } = await supabase
                    .from('order_shipping_details')
                    .select('*')
                    .eq('order_id', chat.order_id)
                    .maybeSingle();
                shippingInfo = sd;
            }

            return { ...chat, isSupport, otherUser, unreadCount: unreadCount || 0, orderItem: orderItemInfo, shipping: shippingInfo };
        }));

        const filteredChats = enrichChats.filter(c => c !== null) as any[];

        // Try to fetch archive columns separately (they may not exist yet if migration hasn't been run)
        try {
            const { data: archiveData, error: archiveErr } = await supabase
                .from('chats')
                .select('id, archived_at, archived_by, completed_at')
                .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

            if (!archiveErr && archiveData) {
                // Merge archive data into filteredChats
                archiveData.forEach((a: any) => {
                    const chat = filteredChats.find(c => c.id === a.id);
                    if (chat) {
                        chat.archived_at = a.archived_at || null;
                        chat.archived_by = a.archived_by || null;
                        chat.completed_at = a.completed_at || null;
                    }
                });

                // AUTO-ARCHIVE: chats completed > 24h ago that aren't archived yet
                const oneDayMs = 24 * 60 * 60 * 1000;
                const now = Date.now();
                for (const chat of filteredChats) {
                    if (
                        chat.completed_at &&
                        !chat.archived_at &&
                        (now - new Date(chat.completed_at).getTime()) > oneDayMs
                    ) {
                        await supabase
                            .from('chats')
                            .update({ archived_at: new Date().toISOString(), archived_by: 'auto' })
                            .eq('id', chat.id);
                        chat.archived_at = new Date().toISOString();
                        chat.archived_by = 'auto';
                    }
                }
            }
        } catch {
            // Columns don't exist yet — archiving will be enabled after migration
        }

        // HANDLE DRAFT CHAT (INITIATED BY EITHER BUYER OR SELLER)
        if ((paramSellerId || paramBuyerId) && paramOfferId && userId) {
            const otherUserId = paramSellerId || paramBuyerId;
            const existing = filteredChats.find(c =>
                ((String(c.seller_id) === String(otherUserId) && String(c.buyer_id) === String(userId)) || 
                 (String(c.buyer_id) === String(otherUserId) && String(c.seller_id) === String(userId))) &&
                String(c.offer_id) === String(paramOfferId) &&
                !c.order_id
            );

            if (existing) {
                setActiveChatId(existing.id);
            } else {
                const { data: otherProf } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', otherUserId).single();
                const { data: offerData } = await supabase.from('offers').select('id, user_id, title, image_urls, category, price, material, color, color_name, dimensions, weight, custom_instructions, color_variants, is_negotiable').eq('id', paramOfferId).single();

                if (otherProf && offerData) {
                    const draftChat = {
                        id: 'draft',
                        buyer_id: paramBuyerId || userId,
                        seller_id: paramSellerId || userId,
                        offer_id: paramOfferId,
                        offers: offerData,
                        otherUser: otherProf,
                        unreadCount: 0,
                        created_at: new Date().toISOString(),
                    };
                    filteredChats.unshift(draftChat);
                    setActiveChatId('draft');
                }
            }
        }

        setChats(filteredChats);
        setLoadingChats(false);

        if (initialChatId && filteredChats.some(c => c.id === initialChatId)) {
            setActiveChatId(initialChatId);
        } else if (paramOfferId) {
            const existing = filteredChats.find(c => String(c.offer_id) === String(paramOfferId) && !c.order_id);
            if (existing) {
                setActiveChatId(existing.id);
            } else {
                setActiveChatId('draft');
            }
        } else if (!initialChatId && !paramSellerId && !paramBuyerId && filteredChats.length > 0) {
            setActiveChatId(filteredChats[0].id);
        }
    };

    useEffect(() => {
        if (activeChatId && currentUser && activeChatId !== 'draft') {
            const currentChatId = activeChatId;
            loadMessages(currentChatId);

            const markAsRead = async () => {
                await supabase.from('messages')
                    .update({ is_read: true })
                    .eq('chat_id', currentChatId)
                    .neq('sender_id', currentUser.id);
            };
            markAsRead();

            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, unreadCount: 0 } : c));
        } else if (activeChatId === 'draft') {
            setMessages([]);
            setLoadingMessages(false);
        }
    }, [activeChatId, currentUser]);

    const loadMessages = async (chatId: string) => {
        setLoadingMessages(true);
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (!error) setMessages(data || []);
        setLoadingMessages(false);
        scrollToBottom();
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const ensureActiveChatExists = async (): Promise<string | null> => {
        if (!currentUser || !activeChatData) return null;

        if (activeChatId && activeChatId !== 'draft') {
            return activeChatId;
        }

        const draft = chats.find(c => c.id === 'draft') || activeChatData;
        const otherUserId = searchParams?.get('seller_id') || searchParams?.get('buyer_id') || draft.otherUser?.id;
        const offerId = searchParams?.get('offer_id') || draft.offer_id;

        if (!offerId || !otherUserId) {
            console.error("Cannot create chat: missing offer_id or otherUserId", { offerId, otherUserId });
            return null;
        }

        const buyerId = draft.buyer_id || currentUser.id;
        const sellerId = draft.seller_id || otherUserId;

        // Check if chat already exists for this exact offer_id in DB
        const { data: existing } = await supabase
            .from('chats')
            .select('id')
            .or(`and(buyer_id.eq.${buyerId},seller_id.eq.${sellerId}),and(buyer_id.eq.${sellerId},seller_id.eq.${buyerId})`)
            .eq('offer_id', offerId)
            .is('order_id', null)
            .limit(1);

        if (existing && existing.length > 0) {
            const realId = existing[0].id;
            setActiveChatId(realId);
            router.replace(`/profile/messages?chat=${realId}`);
            return realId;
        }

        // Create new chat in Supabase
        const { data: newChat, error: chatErr } = await supabase
            .from('chats')
            .insert({
                buyer_id: buyerId,
                seller_id: sellerId,
                offer_id: offerId
            })
            .select('id')
            .single();

        if (chatErr || !newChat) {
            console.error("Error creating chat:", chatErr);
            // Retry lookup in case of constraint / race condition
            const { data: retry } = await supabase
                .from('chats')
                .select('id')
                .or(`and(buyer_id.eq.${buyerId},seller_id.eq.${sellerId}),and(buyer_id.eq.${sellerId},seller_id.eq.${buyerId})`)
                .eq('offer_id', offerId)
                .is('order_id', null)
                .limit(1);

            if (retry && retry.length > 0) {
                const realId = retry[0].id;
                setActiveChatId(realId);
                router.replace(`/profile/messages?chat=${realId}`);
                return realId;
            }
            alert("Failed to start chat session.");
            return null;
        }

        setActiveChatId(newChat.id);
        router.replace(`/profile/messages?chat=${newChat.id}`);
        return newChat.id;
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (spamCooldownSec > 0) return;
        if (pendingImages.length > 0) {
            await handleSendImage(pendingImages, pendingCaption);
            return;
        }
        if (!newMessage.trim() || !activeChatId || !currentUser) return;
        if (checkSpamRateLimit(newMessage)) return;

        const content = newMessage.trim();
        setNewMessage('');

        const currentActiveId = await ensureActiveChatExists();
        if (!currentActiveId) return;

        const tempMsg = {
            id: 'temp-' + Date.now(),
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
            message_type: 'user',
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        const { error } = await supabase.from('messages').insert({
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
        });

        if (error) {
            console.error(error);
            alert("Failed to send message");
        } else {
            loadMessages(currentActiveId);
            loadChats(currentUser.id);

            fetch('/api/order/new-message-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: currentActiveId,
                    senderId: currentUser.id,
                    content: content,
                }),
            }).catch(() => { });
        }
    };

    const activeChatData = chats.find(c => c.id === activeChatId);

    const [statusUpdating, setStatusUpdating] = useState(false);
    const statusUpdatingRef = useRef(false);
    const furgonetkaShippingRef = useRef(false);

    const handleStatusUpdate = async (newStatus: string) => {
        if (!activeChatData || !activeChatData.orderItem || !currentUser) return;
        if (statusUpdatingRef.current) return; // Prevent multi-click race conditions

        if (newStatus === 'disputed') {
            setDisputeEmail(currentUser.email || '');
            setShowDisputeModal(true);
            return;
        }

        statusUpdatingRef.current = true;
        setStatusUpdating(true);
        try {
            const res = await fetch('/api/order/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: activeChatData.orderItem.id,
                    newStatus,
                    chatId: activeChatId,
                    userId: currentUser.id,
                    trackingCode: newStatus === 'shipped' ? trackingCodeInput.trim() || null : undefined,
                })
            });

            if (res.ok) {
                setChats(prev => prev.map(c =>
                    c.id === activeChatId
                        ? { ...c, orderItem: { ...c.orderItem, status: newStatus, tracking_code: newStatus === 'shipped' ? trackingCodeInput.trim() || c.orderItem?.tracking_code : c.orderItem?.tracking_code } }
                        : c
                ));
                setTrackingCodeInput('');
                loadMessages(activeChatId as string);
            } else {
                setFormError('Failed to update order status.');
            }
        } catch (err) {
            console.error('Status update error:', err);
            setFormError('Network error updating status.');
        } finally {
            statusUpdatingRef.current = false;
            setStatusUpdating(false);
        }
    };

    const [furgonetkaLoading, setFurgonetkaLoading] = useState(false);

    const handleFurgonetkaShip = async (itemId: string) => {
        if (furgonetkaShippingRef.current || verificationUploading) return;
        furgonetkaShippingRef.current = true;
        setFurgonetkaLoading(true);
        setVerificationUploading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('Session expired. Please log in again.');
                return;
            }
            if (!activeChatId || !currentUser) return;

            // Upload verification photos if attached
            const photoUrls: string[] = [];
            if (verificationFiles.length > 0) {
                for (let i = 0; i < verificationFiles.length; i++) {
                    const file = verificationFiles[i];
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `verification/${activeChatId}/${Date.now()}-${i}.${ext}`;
                    const { error: uploadErr } = await supabase.storage
                        .from('printsi-files1')
                        .upload(path, file, { upsert: true });

                    if (!uploadErr) {
                        const { data: urlData } = supabase.storage
                            .from('printsi-files1')
                            .getPublicUrl(path);
                        photoUrls.push(urlData.publicUrl);
                    } else {
                        console.error('Failed to upload verification photo:', uploadErr);
                    }
                }
            }

            // Instead of creating package directly, send a confirmation request with photos to buyer
            const shippingAddr = activeChatData?.shipping || activeChatData?.orderItem?.shipping_address || {};
            const addrParts = [
                shippingAddr.address || shippingAddr.line1 || shippingAddr.street || '',
                shippingAddr.city || '',
                shippingAddr.zip_code || shippingAddr.zip || '',
                shippingAddr.country || ''
            ].filter(Boolean);
            const addrDisplay = addrParts.join(', ') || 'Address on file';

            await supabase.from('messages').insert({
                chat_id: activeChatId,
                sender_id: currentUser.id,
                content: JSON.stringify({
                    itemId,
                    addrDisplay,
                    photos: photoUrls,
                    requestedAt: new Date().toISOString(),
                }),
                message_type: 'shipment_confirmation_request',
            });

            // Trigger Email Notification to Buyer (in English, professional design)
            try {
                const buyerId = activeChatData?.buyer_id;
                const productTitle = activeChatData?.orderItem?.offers?.title || activeChatData?.offer?.title || '3D Printed Item';
                const sellerName = currentUser?.user_metadata?.full_name || currentUser?.email || 'Seller';
                if (buyerId) {
                    await fetch('/api/order/verification-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            buyerId,
                            productTitle,
                            sellerName,
                            photoCount: photoUrls.length
                        })
                    });
                }
            } catch (emailErr) {
                console.error('Failed to trigger verification ready email:', emailErr);
            }

            setVerificationFiles([]);
            loadMessages(activeChatId);
        } catch (err) {
            console.error('Shipment confirmation send error:', err);
            alert('Failed to send confirmation request.');
        } finally {
            furgonetkaShippingRef.current = false;
            setFurgonetkaLoading(false);
            setVerificationUploading(false);
        }
    };

    // Called by buyer when they confirm shipping address is OK
    const handleConfirmShipment = async (itemId: string) => {
        setConfirmingShipment(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { alert('Session expired. Please log in again.'); return; }

            const res = await fetch('/api/furgonetka/create-package', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ itemId, chatId: activeChatId })
            });
            const data = await res.json();
            if (data.success) {
                setChats(prev => prev.map(c =>
                    c.id === activeChatId ? {
                        ...c,
                        orderItem: {
                            ...c.orderItem,
                            status: 'shipped',
                            tracking_code: data.trackingNumber,
                            furgonetka_package_id: data.packageId,
                            label_url: data.labelUrl
                        }
                    } : c
                ));
                loadMessages(activeChatId as string);
            } else {
                const errMsg = data.debug_raw
                    ? `${data.error}\n\n[DEBUG] ${data.debug_raw}`
                    : (data.error || 'Failed to generate shipping label.');
                alert(errMsg);
            }
        } catch (err) {
            console.error('Confirm shipment error:', err);
            alert('Network error occurred.');
        } finally {
            setConfirmingShipment(false);
        }
    };

    const handleConfirmReceipt = async (itemId: string) => {
        if (!itemId) return;
        setConfirmingShipment(true);
        try {
            const res = await fetch('/api/order/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm_receipt', itemId, chatId: activeChatId, userId: currentUser?.id }),
            });
            const data = await res.json();
            if (data.success) {
                setChats(prev => prev.map(c =>
                    c.id === activeChatId ? { ...c, orderItem: { ...c.orderItem, status: 'completed', buyer_confirmed_at: new Date().toISOString() } } : c
                ));
                loadMessages(activeChatId as string);
            } else {
                alert(data.error || 'Could not confirm receipt.');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setConfirmingShipment(false);
        }
    };

    const handleExtensionAction = async (action: 'approve_extension' | 'deny_extension', itemId: string) => {
        if (!itemId) return;
        setConfirmingShipment(true);
        try {
            const res = await fetch('/api/order/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, itemId, chatId: activeChatId, userId: currentUser?.id }),
            });
            const data = await res.json();
            if (data.success) {
                setChats(prev => prev.map(c =>
                    c.id === activeChatId ? { ...c, orderItem: { ...c.orderItem, extension_approved: action === 'approve_extension', extension_denied: action === 'deny_extension' } } : c
                ));
                loadMessages(activeChatId as string);
            } else {
                alert(data.error || 'Action failed.');
            }
        } catch {
            alert('Network error. Please try again.');
        } finally {
            setConfirmingShipment(false);
        }
    };

    // Called when user picks files — show preview instead of uploading immediately
    const handleImagePicked = (files: FileList) => {
        const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (!valid.length) return;

        const currentCount = pendingImages.length;
        if (currentCount >= 3) {
            alert("You can attach a maximum of 3 photos per message.");
            if (chatImageInputRef.current) chatImageInputRef.current.value = '';
            return;
        }

        const remainingSpace = 3 - currentCount;
        const newBatch = valid.slice(0, remainingSpace);
        const combined = [...pendingImages, ...newBatch];

        setPendingImages(combined);

        pendingPreviews.forEach(url => URL.revokeObjectURL(url));
        const urls = combined.map(f => URL.createObjectURL(f));
        setPendingPreviews(urls);

        if (chatImageInputRef.current) chatImageInputRef.current.value = '';
    };

    // Handle pasting images directly from clipboard (Ctrl+V / Cmd+V)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const ext = item.type.split('/')[1] || 'png';
                    const renamedFile = new File([file], `pasted_image_${Date.now()}_${i}.${ext}`, { type: item.type });
                    imageFiles.push(renamedFile);
                }
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault();
            const dt = new DataTransfer();
            imageFiles.forEach(f => dt.items.add(f));
            handleImagePicked(dt.files);
        }
    };

    const cancelPendingImages = () => {
        pendingPreviews.forEach(url => URL.revokeObjectURL(url));
        setPendingImages([]);
        setPendingPreviews([]);
        setPendingCaption('');
        if (chatImageInputRef.current) chatImageInputRef.current.value = '';
    };

    // Upload image(s) and send in chat
    const handleSendImage = async (files: File[], caption: string) => {
        if (!files.length || !activeChatId || !currentUser || spamCooldownSec > 0) return;
        if (checkSpamRateLimit(caption)) return;
        setChatImageUploading(true);
        try {
            const currentActiveId = await ensureActiveChatExists();
            if (!currentActiveId) return;

            const fullCaption = [caption.trim(), newMessage.trim()].filter(Boolean).join('\n');
            setNewMessage('');

            const urls: string[] = [];
            for (let i = 0; i < Math.min(files.length, 5); i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;
                const ext = file.name.split('.').pop() || 'jpg';
                const path = `chat/${currentActiveId}/${Date.now()}-${i}.${ext}`;
                const { error } = await supabase.storage.from('printsi-files1').upload(path, file, { upsert: true });
                if (!error) {
                    const { data: urlData } = supabase.storage.from('printsi-files1').getPublicUrl(path);
                    urls.push(urlData.publicUrl);
                }
            }

            if (urls.length > 0) {
                const content = '[IMAGE]' + JSON.stringify(urls) + (fullCaption ? '[CAPTION]' + fullCaption : '');
                await supabase.from('messages').insert({
                    chat_id: currentActiveId,
                    sender_id: currentUser.id,
                    content,
                    message_type: 'user',
                });
                loadMessages(currentActiveId);
                loadChats(currentUser.id);
            }

            // Clean up
            cancelPendingImages();
        } catch (err) {
            console.error('Image upload error:', err);
            alert('Failed to upload image. Please try again.');
        } finally {
            setChatImageUploading(false);
        }
    };


    const handleDownloadLabel = async (packageId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert('Session expired. Please log in again.');
                return;
            }
            
            const res = await fetch(`/api/furgonetka/label/${packageId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || 'Failed to download label');
                return;
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `label_${packageId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Label download error:', err);
            alert('Network error downloading label');
        }
    };

    const [formError, setFormError] = useState('');
    useEffect(() => {
        if (formError) {
            const t = setTimeout(() => setFormError(''), 4000);
            return () => clearTimeout(t);
        }
    }, [formError]);

    const handleDisputeSubmit = async () => {
        if (!activeChatData?.orderItem || !currentUser || !disputeProblemType || !disputeDescription.trim() || !disputeEmail.trim()) {
            setFormError('Please fill in all fields (Reason, Description and Email)');
            return;
        }

        setDisputeSubmitting(true);

        const res = await fetch('/api/order/dispute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                itemId: activeChatData.orderItem.id,
                chatId: activeChatId,
                buyerId: currentUser.id,
                sellerId: activeChatData.seller_id,
                problemType: disputeProblemType,
                description: disputeDescription.trim(),
                contactEmail: disputeEmail.trim(),
            })
        });

        setDisputeSubmitting(true); // Wait, this should be false? Oh, false is below.
        setDisputeSubmitting(false);

        if (res.ok) {
            setShowDisputeModal(false);
            setDisputeProblemType('');
            setDisputeDescription('');
            setDisputeEmail('');
            setChats(prev => prev.map(c =>
                c.id === activeChatId
                    ? { ...c, orderItem: { ...c.orderItem, status: 'disputed' } }
                    : c
            ));
            loadMessages(activeChatId as string);
        } else {
            const errorData = await res.json();
            alert(`Failed back-end: ${errorData.error || 'Unknown error'}`);
        }
    };

    // ── REPORT ISSUE ──────────────────────────────────────────────
    const handleReport = async () => {
        if (reportSubject.trim().length < 3) {
            setReportError('Please provide a subject (minimum 3 characters).');
            return;
        }
        if (reportDescription.trim().length < 10) {
            setReportError('Please describe the issue (minimum 10 characters).');
            return;
        }
        setReportSubmitting(true);
        setReportError('');
        try {
            const chatLink = activeChatId ? `${window.location.origin}/profile/messages?chat=${activeChatId}` : '';
            const orderId = activeChatData?.orderItem?.order_id || '';
            const fullMsg = `${reportDescription.trim()}\n\n---\nChat ID: ${activeChatId || 'N/A'}\nOrder ID: ${orderId || 'N/A'}\nLink: ${chatLink}`;
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    category: 'report',
                    subject: reportSubject.trim(),
                    message: fullMsg,
                    contact: currentUser?.email || currentUser?.id || 'unknown'
                })
            });
            const data = await res.json();
            if (data.success) {
                setReportSuccess(true);
                setReportSubject('');
                setReportDescription('');
                setTimeout(() => { setShowReportModal(false); setReportSuccess(false); }, 2500);
            } else {
                setReportError(data.error || 'Failed to submit report. Please try again.');
            }
        } catch {
            setReportError('Network error. Please try again.');
        }
        setReportSubmitting(false);
    };

    // ── CANCEL ORDER ─────────────────────────────────────────────
    const openCancelModal = async (initiator: 'seller' | 'buyer') => {
        if (!activeChatData?.orderItem) return;
        setCancelInitiator(initiator);
        setCancelReason('');
        setCancelError('');
        // Fetch shipping cost from order for buyer warning
        if (initiator === 'buyer') {
            try {
                const orderId = activeChatData.order_id;
                const { data: ord } = await supabase.from('orders').select('shipping_cost_eur').eq('id', orderId).maybeSingle();
                setCancelShippingEur(Number(ord?.shipping_cost_eur) || 0);
                setCancelItemTotalEur(activeChatData.orderItem.price_at_purchase * (activeChatData.orderItem.quantity || 1));
            } catch { setCancelShippingEur(0); }
        }
        setShowCancelModal(true);
    };

    const handleCancelOrder = async () => {
        if (!activeChatData?.orderItem || !currentUser) return;
        if (cancelReason.trim().length < 5) {
            setCancelError('Please provide a reason for cancellation (minimum 5 characters).');
            return;
        }
        setCancelSubmitting(true);
        setCancelError('');
        try {
            const res = await fetch('/api/order/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    itemId: activeChatData.orderItem.id,
                    chatId: activeChatId,
                    userId: currentUser.id,
                    initiator: cancelInitiator,
                    reason: cancelReason.trim(),
                }),
            });
            if (res.ok) {
                const newStatus = cancelInitiator === 'seller' ? 'cancelled' : 'cancellation_requested';
                setChats(prev => prev.map(c =>
                    c.id === activeChatId ? { ...c, orderItem: { ...c.orderItem, status: newStatus } } : c
                ));
                setShowCancelModal(false);
                setCancelReason('');
                loadMessages(activeChatId as string);
            } else {
                const d = await res.json();
                setCancelError(d.error || 'Failed to cancel order');
            }
        } catch { setCancelError('Network error'); }
        setCancelSubmitting(false);
    };

    const handleCancelResponse = async (accept: boolean, itemId: string) => {
        if (!currentUser) return;
        setCancelRespondSubmitting(true);
        try {
            const res = await fetch('/api/order/cancel/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, chatId: activeChatId, userId: currentUser.id, accept }),
            });
            if (res.ok) {
                const newStatus = accept ? 'cancelled' : 'disputed';
                setChats(prev => prev.map(c =>
                    c.id === activeChatId ? { ...c, orderItem: { ...c.orderItem, status: newStatus } } : c
                ));
                loadMessages(activeChatId as string);
            } else {
                const d = await res.json();
                setFormError(d.error || 'Failed to respond');
            }
        } catch { setFormError('Network error'); }
        setCancelRespondSubmitting(false);
    };
    // ─────────────────────────────────────────────────────────────

    const parseDimensionsAdvanced = (dimStr: string): ParsedDim[] => {
        let parsed: ParsedDim[] = [];
        const seenNames = new Set<string>();

        if (dimStr) {
            dimStr.split(',').forEach(part => {
                const match = part.match(/^(.*?):\s*(\d+(?:\.\d+)?)\s*(.*)$/);
                if (match) {
                    const name = match[1].trim();
                    const val = parseFloat(match[2]);
                    const unit = match[3].trim() || 'mm';
                    const lowerName = name.toLowerCase();

                    // Deduplicate dimension names
                    if (!seenNames.has(lowerName) && val > 0) {
                        seenNames.add(lowerName);
                        const isBase = lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('depth') || lowerName.includes('length') ||
                            lowerName.includes('szerokość') || lowerName.includes('wysokość') || lowerName.includes('głębokość') || lowerName.includes('długość') ||
                            lowerName.includes('szerokosc') || lowerName.includes('wysokosc') || lowerName.includes('glebokosc') || lowerName.includes('dlugosc') ||
                            lowerName === 'w' || lowerName === 'h' || lowerName === 'l' || lowerName === 'd';
                        parsed.push({ name, originalValue: val, currentValueStr: val.toString(), unit, isBase });
                    }
                }
            });
        }

        const hasBase = parsed.some(d => d.isBase);
        if (!hasBase && parsed.length === 0) {
            parsed = [
                { name: 'Width', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
                { name: 'Height', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
                { name: 'Depth', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
            ];
        }
        return parsed;
    };

    const [respondingToMsgId, setRespondingToMsgId] = useState<string | null>(null);

    const openProposalModal = async (initialData?: any, msgId: string | null = null) => {
        if (!activeChatData) return;
        setEditingProposalData(initialData || null);
        setRespondingToMsgId(msgId);

        const baseOffer = activeChatData.offers;
        const sourceData = initialData || baseOffer;

        if (sourceData?.price !== undefined) {
            const displayPrice = currency !== 'EUR' && rates && rates[currency]
                ? (sourceData.price * rates[currency]).toFixed(2)
                : sourceData.price.toFixed(2);
            setProposalPrice(displayPrice);
        } else {
            setProposalPrice('');
        }

        setProposalQty(sourceData?.quantity?.toString() || '1');
        setProposalMaterial(sourceData?.material || '');
        setProposalColor(sourceData?.color || '');
        setProposalColorHex(sourceData?.colorHex || sourceData?.color || '#cccccc');
        setShowCustomFilamentInput(false);
        setCustomFilamentText('');

        const dimStr = sourceData?.dimensions || baseOffer?.dimensions || '';
        setProposalDims(parseDimensionsAdvanced(dimStr));
        setProposalScale(sourceData?.dimensionScale || 100);

        setLoadingFilaments(true);
        setShowProposalModal(true);

        // ── Fetch both filaments AND full offer (with color_variants layers) in parallel ──
        const [filRes, fullOfferRes] = await Promise.allSettled([
            fetch(`/api/filaments?sellerId=${activeChatData.seller_id}`),
            supabase
                .from('offers')
                .select('id, color_variants')
                .eq('id', baseOffer?.id)
                .maybeSingle(),
        ]);

        // Set seller filaments
        let fetchedFilaments: any[] = [];
        if (filRes.status === 'fulfilled') {
            try { 
                const d = await filRes.value.json(); 
                fetchedFilaments = d.filaments || [];
            } catch { fetchedFilaments = []; }
        }
        setSellerFilaments(fetchedFilaments);
        if (fetchedFilaments.length === 0 || activeChatData?.offers?.category === 'job') {
            setShowCustomFilamentInput(true);
        }

        // Build swappedLayers from data
        if (sourceData?.swappedLayers) {
            setSwappedLayers(sourceData.swappedLayers.map((l: any) => ({
                original_color_name: l.from,
                original_color_hex:  l.from_hex || l.to_hex || '#cccccc',
                grams: l.grams,
                swapped_filament_id: null,
                custom_color_name: l.to !== l.from ? l.to : '',
                custom_color_hex:  l.to !== l.from ? l.to_hex : l.from_hex || '#cccccc',
                showCustom: l.to !== l.from,
            })));
        } else {
            // Use full offer color_variants (more complete than the join data)
            const fullOffer = fullOfferRes.status === 'fulfilled' ? fullOfferRes.value?.data : null;
            const cvs: any[] = fullOffer?.color_variants ?? baseOffer?.color_variants ?? [];

            const toLayer = (l: any, fallbackHex = '#cccccc') => ({
                original_color_name: l.color_name || l.name || l.label || '',
                original_color_hex:  l.color_hex  || l.hex   || fallbackHex,
                grams: l.grams ?? l.weight ?? null,
                swapped_filament_id: null,
                custom_color_name: '',
                custom_color_hex: l.color_hex || l.hex || fallbackHex,
                showCustom: false,
            });

            const varWithLayers = cvs.find((v: any) => Array.isArray(v.layers) && v.layers.length > 0);
            const varWithColors = !varWithLayers && cvs.find((v: any) => Array.isArray(v.colors) && v.colors.length > 0);
            const varWithLabel  = !varWithLayers && !varWithColors && cvs.find((v: any) => typeof v.label === 'string' && v.label.includes(' + '));

            if (varWithLayers) {
                setSwappedLayers(varWithLayers.layers.map((l: any) => toLayer(l)));
            } else if (varWithColors) {
                setSwappedLayers(varWithColors.colors.map((l: any) => toLayer(l)));
            } else if (varWithLabel) {
                const names: string[] = varWithLabel.label.split(' + ').map((s: string) => s.trim());
                setSwappedLayers(names.map((name: string, i: number) => ({
                    original_color_name: name,
                    original_color_hex:  i === 0 ? (varWithLabel.color_hex || '#cccccc') : '#cccccc',
                    grams: null,
                    swapped_filament_id: null,
                    custom_color_name: '',
                    custom_color_hex: i === 0 ? (varWithLabel.color_hex || '#cccccc') : '#cccccc',
                    showCustom: false,
                })));
            } else {
                setSwappedLayers([]);
            }
        }

        setLoadingFilaments(false);
    };


    const handleDimChange = (idx: number, newValStr: string) => {
        const dim = proposalDims[idx];
        const newDims = [...proposalDims];
        newDims[idx].currentValueStr = newValStr;
        const numVal = parseFloat(newValStr);

        if (dim.isBase && !isNaN(numVal) && numVal > 0 && dim.originalValue > 0) {
            const scale = numVal / dim.originalValue;
            setProposalScale(Math.round(scale * 10000) / 100);

            newDims.forEach(d => {
                if (d !== newDims[idx] && d.originalValue > 0) {
                    d.currentValueStr = (d.originalValue * scale).toFixed(2).replace(/\.00$/, '');
                }
            });
        }
        setProposalDims(newDims);
    };

    const handleScaleChange = (newScaleStr: string) => {
        const val = parseFloat(newScaleStr);
        setProposalScale(isNaN(val) ? 0 : val);

        if (!isNaN(val) && val > 0) {
            const ratio = val / 100;
            const newDims = [...proposalDims];
            newDims.forEach(d => {
                if (d.originalValue > 0) {
                    d.currentValueStr = (d.originalValue * ratio).toFixed(2).replace(/\.00$/, '');
                }
            });
            setProposalDims(newDims);
        }
    };

    const hasProposalChanges = (() => {
        if (!activeChatData?.offers) return false;
        const orig = editingProposalData || activeChatData.offers;
        const isJob = activeChatData.offers?.category === 'job';

        let currentPriceNum = parseFloat(proposalPrice);
        let finalPrice = currentPriceNum;
        if (currency !== 'EUR' && rates && rates[currency]) {
            finalPrice = finalPrice / rates[currency];
        }

        const priceChanged = Math.abs(finalPrice - (orig.price || 0)) > 0.01;
        const qtyChanged = !isJob && parseInt(proposalQty) !== (orig.quantity || 1);
        const matChanged = proposalMaterial !== (orig.material || '');
        const colChanged = proposalColor !== (orig.color || '');
        const scaleChanged = !isJob && Math.abs(proposalScale - (orig.dimensionScale || 100)) > 0.1;
        const swapsChanged = swappedLayers.some(sl => {
            const currentChoiceName = sl.swapped_filament_id
                ? sellerFilaments.find(f => f.id === sl.swapped_filament_id)?.color_name
                : (sl.showCustom ? sl.custom_color_name : sl.original_color_name);
            return currentChoiceName !== sl.original_color_name;
        });

        return priceChanged || qtyChanged || matChanged || colChanged || scaleChanged || swapsChanged;
    })();

    const sendProposal = async () => {
        if (!currentUser || !activeChatData) return;

        const currentActiveId = await ensureActiveChatExists();
        if (!currentActiveId) return;

        let finalPrice = Math.abs(parseFloat(proposalPrice));
        if (isNaN(finalPrice) || finalPrice < 0.01) {
            alert("Please enter a valid price of at least 0.01.");
            return;
        }
        if (currency !== 'EUR' && rates && rates[currency]) {
            finalPrice = finalPrice / rates[currency];
        }
        if (finalPrice > 50000) {
            alert("Price cannot exceed €50,000 EUR.");
            return;
        }

        let resolvedMaterial = proposalMaterial || activeChatData.offers?.material || 'Any';
        let resolvedColor = proposalColor || activeChatData.offers?.color || 'Any';
        let resolvedColorHex = proposalColorHex !== '#cccccc' ? proposalColorHex : undefined;

        if (selectedFilamentId) {
            const fil = sellerFilaments.find(f => f.id === selectedFilamentId);
            if (fil) {
                resolvedMaterial = fil.plastic_type;
                resolvedColor = fil.color_name;
                resolvedColorHex = fil.color_hex;
            }
        } else if (showCustomFilamentInput && proposalColor.trim()) {
            resolvedColor = proposalColor.trim();
        }

        const swaps = swappedLayers.map(sl => {
            const fil = sl.swapped_filament_id ? sellerFilaments.find(f => f.id === sl.swapped_filament_id) : null;
            const toName = fil ? fil.color_name : (sl.custom_color_name || sl.original_color_name);
            const isActuallyModified = toName !== sl.original_color_name;

            return {
                from: sl.original_color_name,
                from_hex: sl.original_color_hex,
                to: toName,
                to_hex: fil ? fil.color_hex : (sl.custom_color_hex || sl.original_color_hex),
                grams: sl.grams,
                isModified: isActuallyModified
            };
        });

        const payload: any = {
            price: finalPrice,
            quantity: parseInt(proposalQty),
            material: resolvedMaterial,
            color: resolvedColor,
            colorHex: resolvedColorHex,
            swappedLayers: swaps.length > 0 ? swaps : undefined,
            dimensions: proposalDims.length > 0 ? proposalDims.map(d => `${d.name}: ${d.currentValueStr} ${d.unit}`).join(', ') : undefined,
            dimensionScale: proposalScale,
        };

        const isSeller = currentUser.id === activeChatData?.seller_id;

        if (editingProposalData) {
            payload.status = 'counter_proposed';
        } else if (isSeller) {
            payload.status = 'seller_proposed';
        } else {
            payload.status = 'pending';
        }

        if (isSeller) {
            try {
                const { data: newOffer, error: offerError } = await supabase.from('offers').insert({
                    user_id: currentUser.id,
                    category: activeChatData.offers?.category || 'physical',
                    title: `Custom Order: ${activeChatData.offers?.title || 'Item'}`.substring(0, 150),
                    description: 'Custom order negotiated via chat.',
                    price: Number(payload.price),
                    material: payload.material,
                    color: payload.color,
                    stock: Number(payload.quantity),
                    is_custom: true,
                    parent_offer_id: activeChatData.offers?.id || null,
                    image_urls: activeChatData.offers?.image_urls || null,
                    dimensions: payload.dimensions || activeChatData.offers?.dimensions || null,
                    color_variants: payload.swappedLayers ? [{
                        manual: true,
                        isMultiColor: true,
                        layers: payload.swappedLayers.map((sl: any) => ({
                            color_name: sl.to,
                            color_hex: sl.to_hex,
                            grams: sl.grams
                        }))
                    }] : undefined
                }).select().single();

                if (offerError) throw offerError;
                payload.custom_offer_id = newOffer.id;
            } catch (e) {
                console.error(e);
                alert("Error creating offer. Please ensure the price is correct.");
                return;
            }
        }

        const content = `[PROPOSAL]${JSON.stringify(payload)}`;
        setShowProposalModal(false);
        setProposalPrice('');

        const tempMsg = {
            id: 'temp-' + Date.now(),
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
            message_type: 'user',
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        const { error: sendErr } = await supabase.from('messages').insert({
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
        });

        if (sendErr) {
            console.error('Failed to send proposal message:', sendErr);
            alert('Failed to send proposal message.');
            return;
        }

        // Trigger Negotiation Email
        const emailType = payload.status === 'counter_proposed' ? 'counter_offer' : (payload.status === 'seller_proposed' ? 'seller_offer' : 'new_offer');
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: currentActiveId,
                senderId: currentUser.id,
                type: emailType,
                price: formatPrice(payload.price),
                productTitle: activeChatData.offers?.title || 'Custom Item'
            }),
        }).catch(err => console.error('Negotiation email error:', err));

        if (respondingToMsgId) {
            try {
                const origMsg = messages.find(m => m.id === respondingToMsgId);
                if (origMsg && origMsg.content.startsWith('[PROPOSAL]')) {
                    const parsed = JSON.parse(origMsg.content.substring(10));
                    parsed.status = 'countered';
                    await supabase.from('messages').update({
                        content: `[PROPOSAL]${JSON.stringify(parsed)}`
                    }).eq('id', respondingToMsgId);
                }
            } catch (e) {
                console.error("Error updating countered message:", e);
            }
            setRespondingToMsgId(null);
        }

        loadMessages(currentActiveId);
        loadChats(currentUser.id);
    };

    // ── JOB FULFILLMENT: Quick Price Proposal ──
    const handleSendJobProposal = async (overridePriceEUR?: number) => {
        if (!currentUser || !activeChatData) return;

        let finalPrice = 0;
        if (overridePriceEUR !== undefined) {
            finalPrice = Math.abs(overridePriceEUR);
        } else {
            if (!jobProposalPrice) return;
            finalPrice = Math.abs(parseFloat(jobProposalPrice));
            if (currency !== 'EUR' && rates && rates[currency]) {
                finalPrice = finalPrice / rates[currency];
            }
        }
        if (isNaN(finalPrice) || finalPrice <= 0) return;

        setSendingJobProposal(true);

        const currentActiveId = await ensureActiveChatExists();
        if (!currentActiveId) {
            setSendingJobProposal(false);
            return;
        }

        const payload: any = {
            price: finalPrice,
            quantity: 1,
            material: activeChatData.offers?.material || 'Per agreement',
            color: activeChatData.offers?.color || 'Per agreement',
            status: 'pending',
        };

        const content = `[PROPOSAL]${JSON.stringify(payload)}`;

        const tempMsg = {
            id: 'temp-' + Date.now(),
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
            message_type: 'user',
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        await supabase.from('messages').insert({
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: content,
        });

        const isFixedPriceJob = !activeChatData.offers?.is_negotiable && (activeChatData.offers?.price > 0);
        const systemText = isFixedPriceJob
            ? `🖨️ The printer has accepted your job for ${formatPrice(finalPrice)}! Click "PAY & CHECKOUT" in the top bar to complete payment.`
            : `🖨️ The printer has reviewed your 3D file and submitted a price proposal of ${formatPrice(finalPrice)}. Accept the proposal above to proceed with payment and printing.`;

        // System message explaining the proposal / acceptance
        await supabase.from('messages').insert({
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: systemText,
            message_type: 'system',
        });

        // Determine recipient (the job poster / customer)
        const recipientId = activeChatData.buyer_id === currentUser.id 
            ? activeChatData.seller_id 
            : (activeChatData.seller_id === currentUser.id ? activeChatData.buyer_id : (activeChatData.otherUser?.id || activeChatData.seller_id));

        if (recipientId && recipientId !== currentUser.id) {
            try {
                await supabase.from('notifications').insert({
                    user_id: recipientId,
                    title: isFixedPriceJob ? '✅ Job Accepted by Printer!' : '💰 New price proposal for your print job!',
                    message: isFixedPriceJob
                        ? `A printer accepted your job "${activeChatData.offers?.title}" for ${formatPrice(finalPrice)}. Open chat to complete payment!`
                        : `A printer proposed ${formatPrice(finalPrice)} to print "${activeChatData.offers?.title}". Open chat to review and accept.`,
                    type: 'job',
                    sender_id: currentUser.id,
                    offer_id: activeChatData.offer_id,
                    is_read: false,
                });
            } catch (e) {
                console.error('Notification failed:', e);
            }
        }

        // Trigger email notification to recipient
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: currentActiveId,
                senderId: currentUser.id,
                type: 'new_offer',
                price: formatPrice(finalPrice),
                productTitle: activeChatData.offers?.title || 'Print Job'
            }),
        }).catch(err => console.error('Negotiation email error:', err));

        setShowJobProposalBanner(false);
        setJobProposalPrice('');
        setSendingJobProposal(false);
        loadMessages(currentActiveId);
        loadChats(currentUser.id);
    };

    const handleDeclineJobChat = async () => {
        if (!currentUser || !activeChatData) return;

        const currentActiveId = await ensureActiveChatExists();
        if (!currentActiveId) return;

        // Send a system message in the chat
        await supabase.from('messages').insert({
            chat_id: currentActiveId,
            sender_id: currentUser.id,
            content: `❌ The printer reviewed the 3D file but cannot fulfill this print job. The job remains open for other printers.`,
            message_type: 'system',
        });

        // Determine recipient (the job poster)
        const recipientId = activeChatData.buyer_id === currentUser.id 
            ? activeChatData.seller_id 
            : (activeChatData.seller_id === currentUser.id ? activeChatData.buyer_id : (activeChatData.otherUser?.id || activeChatData.seller_id));

        if (recipientId && recipientId !== currentUser.id) {
            try {
                await supabase.from('notifications').insert({
                    user_id: recipientId,
                    title: '❌ A printer passed on your job',
                    message: `A printer reviewed "${activeChatData.offers?.title}" but cannot fulfill it. Don't worry — other printers can still pick it up!`,
                    type: 'job',
                    sender_id: currentUser.id,
                    offer_id: activeChatData.offer_id,
                    is_read: false,
                });
            } catch (e) {
                console.error('Decline notification failed:', e);
            }
        }

        setShowJobProposalBanner(false);
        router.push('/gallery');
    };

    const handleAcceptProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData || !activeChatData.offers) return;
        if (acceptingProposalId) return;

        const isAuthorizedToAccept = currentUser?.id === activeChatData.seller_id || currentUser?.id === activeChatData.buyer_id;

        if (!isAuthorizedToAccept) {
            alert("You are not authorized to accept this proposal.");
            return;
        }

        if (!parsedData || !parsedData.price || isNaN(Number(parsedData.price))) {
            alert("Error: Proposal lacks a valid price!");
            return;
        }

        // If already accepted, avoid duplicate offer creation
        if (parsedData.status === 'accepted' && parsedData.custom_offer_id) {
            const isJobOfferCard = activeChatData.offers?.category === 'job';
            const jobPosterIdCard = activeChatData.offers?.user_id || activeChatData.seller_id;
            const isPayerUser = isJobOfferCard
                ? String(currentUser?.id) === String(jobPosterIdCard)
                : currentUser?.id === activeChatData.buyer_id;

            if (isPayerUser) {
                handleBuyCustomOffer(parsedData);
            }
            return;
        }

        setAcceptingProposalId(msgId);

        try {
            const isJobOffer = activeChatData.offers?.category === 'job';
            let offerId = parsedData.custom_offer_id;

            if (!offerId) {
                const basePayload = {
                    user_id: isJobOffer ? activeChatData.buyer_id : currentUser.id,
                    category: isJobOffer ? 'physical' : (activeChatData.offers?.category || 'physical'),
                    title: `Custom Order: ${activeChatData.offers?.title || 'Item'}`.substring(0, 150),
                    description: isJobOffer ? 'Print on Demand job accepted via chat.' : 'Custom order negotiated via chat.',
                    price: Number(parsedData.price),
                    material: parsedData.material || 'N/A',
                    color: parsedData.color || 'N/A',
                    stock: Number(parsedData.quantity) || 1,
                    is_custom: true,
                    parent_offer_id: activeChatData.offers?.id || null,
                    image_urls: activeChatData.offers?.image_urls || null,
                    dimensions: parsedData.dimensions || activeChatData.offers?.dimensions || null,
                    created_at: new Date()
                };

                const colorVariants = parsedData.swappedLayers ? [{
                    manual: true,
                    isMultiColor: true,
                    layers: parsedData.swappedLayers.map((sl: any) => ({
                        color_name: sl.to,
                        color_hex: sl.to_hex,
                        grams: sl.grams
                    }))
                }] : undefined;

                let lastError: any = null;

                const { data: newOffer, error: err1 } = await supabase.from('offers').insert({
                    ...basePayload,
                    ...(colorVariants ? { color_variants: colorVariants } : {})
                }).select().single();

                let offer = newOffer;
                lastError = err1;

                if (lastError && lastError.message?.includes('color_variants')) {
                    const { data: newOffer2, error: err2 } = await supabase.from('offers').insert(basePayload).select().single();
                    offer = newOffer2;
                    lastError = err2;
                }

                if (lastError || !offer) {
                    console.error("Offer Creation Error Details:", lastError);
                    throw lastError || new Error("Failed to create offer.");
                }

                offerId = offer.id;
            }

            // CRITICAL FIX: Set status = 'accepted' AND custom_offer_id on parsedData
            parsedData.status = 'accepted';
            parsedData.custom_offer_id = offerId;

            const { error: msgError } = await supabase.from('messages').update({
                content: `[PROPOSAL]${JSON.stringify(parsedData)}`
            }).eq('id', msgId);

            if (msgError) throw msgError;

            const currentId = (activeChatId && activeChatId !== 'draft') ? activeChatId : (activeChatData?.id || null);
            if (currentId) {
                await loadMessages(currentId);
                await loadChats(currentUser?.id || '');
            }

            // Determine if accepting user is the payer
            const jobPosterIdCard = activeChatData?.offers?.user_id || activeChatData?.seller_id;
            const isPayerUser = isJobOffer
                ? String(currentUser?.id) === String(jobPosterIdCard)
                : currentUser?.id === activeChatData.buyer_id;

            if (isPayerUser) {
                handleBuyCustomOffer(parsedData);
            } else {
                alert("✓ Counter offer accepted! The customer can now proceed to checkout.");
            }
        } catch (e: any) {
            console.error("Comprehensive Accept Failure:", e);
            alert(`Failed to accept: ${e.message || 'Unknown database error'}`);
        } finally {
            setAcceptingProposalId(null);
        }
    };

    const handleBuyerAcceptsSellerProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData) return;
        const isParticipant = currentUser?.id === activeChatData.buyer_id || currentUser?.id === activeChatData.seller_id;
        if (!isParticipant) return;

        await handleAcceptProposal(msgId, parsedData);
    };

    const handleRejectProposal = async (msgId: string, parsedData: any) => {
        parsedData.status = 'rejected';
        await supabase.from('messages').update({
            content: `[PROPOSAL]${JSON.stringify(parsedData)}`
        }).eq('id', msgId);

        // Trigger Rejected Email
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
                senderId: currentUser.id,
                type: 'reject',
                productTitle: activeChatData?.offers?.title || 'Custom Item'
            }),
        }).catch(() => { });

        loadMessages(activeChatId as string);
    };

    const handleWithdrawProposal = async (msgId: string, parsedData: any) => {
        parsedData.status = 'cancelled';
        await supabase.from('messages').update({
            content: `[PROPOSAL]${JSON.stringify(parsedData)}`
        }).eq('id', msgId);

        loadMessages(activeChatId as string);
    };

    const handleBuyCustomOffer = (parsedData: any) => {
        if (!activeChatData) return;

        const isJobOffer = activeChatData.offers?.category === 'job';
        const jobPosterId = activeChatData.offers?.user_id || activeChatData.seller_id;
        const printerUserId = isJobOffer
            ? (activeChatData.buyer_id === jobPosterId ? activeChatData.seller_id : activeChatData.buyer_id)
            : activeChatData.seller_id;

        const targetOfferId = parsedData?.custom_offer_id || activeChatData.offer_id;
        if (!targetOfferId) return;

        addItem({
            id: targetOfferId,
            title: isJobOffer ? `Print Job: ${activeChatData.offers?.title}` : `Custom: ${activeChatData.offers?.title}`,
            price: Number(parsedData?.price || activeChatData.offers?.price),
            image_url: activeChatData.offers?.image_urls?.[0] || null,
            seller_id: printerUserId,
            stock: Number(parsedData?.quantity || 1),
            is_custom: true,
            category: isJobOffer ? 'job' : (activeChatData.offers?.category || 'physical'),
            material: parsedData?.material || activeChatData.offers?.material,
            color: parsedData?.color || activeChatData.offers?.color,
            dimensions: parsedData?.dimensions || activeChatData.offers?.dimensions
        }, Number(parsedData?.quantity || 1));

        // Skip cart page — navigate directly to checkout form!
        router.push('/checkout');
    };

    const handleAddToCartCustomOffer = (parsedData: any) => {
        if (!activeChatData) return;

        const isJobOffer = activeChatData.offers?.category === 'job';
        const jobPosterId = activeChatData.offers?.user_id || activeChatData.seller_id;
        const printerUserId = isJobOffer
            ? (activeChatData.buyer_id === jobPosterId ? activeChatData.seller_id : activeChatData.buyer_id)
            : activeChatData.seller_id;

        const targetOfferId = parsedData?.custom_offer_id || activeChatData.offer_id;
        if (!targetOfferId) return;

        addItem({
            id: targetOfferId,
            title: isJobOffer ? `Print Job: ${activeChatData.offers?.title}` : `Custom: ${activeChatData.offers?.title}`,
            price: Number(parsedData?.price || activeChatData.offers?.price),
            image_url: activeChatData.offers?.image_urls?.[0] || null,
            seller_id: printerUserId,
            stock: Number(parsedData?.quantity || 1),
            is_custom: true,
            category: isJobOffer ? 'job' : (activeChatData.offers?.category || 'physical'),
            material: parsedData?.material || activeChatData.offers?.material,
            color: parsedData?.color || activeChatData.offers?.color,
            dimensions: parsedData?.dimensions || activeChatData.offers?.dimensions
        }, Number(parsedData?.quantity || 1));

        alert('🛒 Custom offer added to cart!');
    };

    const handleArchiveChat = async (chatId: string, currentlyArchived: boolean) => {
        if (!currentUser) return;
        setArchivingChatId(chatId);
        try {
            const res = await fetch('/api/chat/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, userId: currentUser.id, unarchive: currentlyArchived }),
            });
            if (res.ok) {
                setChats(prev => prev.map(c => {
                    if (c.id !== chatId) return c;
                    if (currentlyArchived) {
                        return { ...c, archived_at: null, archived_by: null };
                    } else {
                        return { ...c, archived_at: new Date().toISOString(), archived_by: 'manual' };
                    }
                }));
                // If archiving the active chat, deselect it
                if (!currentlyArchived && activeChatId === chatId) {
                    setActiveChatId(null);
                }
            }
        } catch (e) {
            console.error('Archive error:', e);
        }
        setArchivingChatId(null);
    };

    const renderSystemMessage = (msg: any, idx: number) => {
        const messageType = msg.message_type || 'system';
        const typeStyles: Record<string, { bg: string; border: string; icon: any; iconColor: string; label: string; accent: string }> = {
            system: {
                bg: 'bg-gradient-to-r from-slate-50 to-blue-50/50',
                border: 'border-blue-200/50',
                icon: <Info size={16} />,
                iconColor: 'text-blue-500',
                label: 'System',
                accent: 'from-blue-500 to-blue-600',
            },
            status_order_confirmed: {
                bg: 'bg-gradient-to-r from-slate-50 to-indigo-50/40',
                border: 'border-indigo-200/60',
                icon: <Package size={16} />,
                iconColor: 'text-indigo-500',
                label: 'Order Confirmed',
                accent: 'from-indigo-500 to-blue-600',
            },
            status_shipped: {
                bg: 'bg-gradient-to-r from-blue-50 to-indigo-50/50',
                border: 'border-blue-200',
                icon: <Truck size={16} />,
                iconColor: 'text-blue-600',
                label: 'Shipped',
                accent: 'from-blue-500 to-indigo-500',
            },
            status_tracking: {
                bg: 'bg-gradient-to-r from-teal-50 to-cyan-50/50',
                border: 'border-teal-200',
                icon: <Truck size={16} />,
                iconColor: 'text-teal-600',
                label: 'Tracking Update',
                accent: 'from-teal-500 to-cyan-500',
            },
            status_delivered: {
                bg: 'bg-gradient-to-r from-emerald-50 to-teal-50/50',
                border: 'border-emerald-200',
                icon: <PackageCheck size={16} />,
                iconColor: 'text-emerald-600',
                label: 'Delivered',
                accent: 'from-emerald-500 to-teal-500',
            },
            status_completed: {
                bg: 'bg-gradient-to-r from-green-50 to-emerald-50/50',
                border: 'border-green-200',
                icon: <CheckCircle2 size={16} />,
                iconColor: 'text-green-600',
                label: 'Sale Complete',
                accent: 'from-green-500 to-emerald-500',
            },
            status_disputed: {
                bg: 'bg-gradient-to-r from-red-50 to-orange-50/50',
                border: 'border-red-200',
                icon: <ShieldAlert size={16} />,
                iconColor: 'text-red-500',
                label: 'Dispute',
                accent: 'from-red-500 to-orange-500',
            },
            dispute_opened: {
                bg: 'bg-gradient-to-r from-red-50 to-orange-50/50',
                border: 'border-red-200',
                icon: <AlertTriangle size={16} />,
                iconColor: 'text-red-600',
                label: 'Dispute Opened',
                accent: 'from-red-500 to-orange-500',
            },
            status_cancelled: {
                bg: 'bg-gradient-to-r from-slate-50 to-gray-100/80',
                border: 'border-slate-300',
                icon: <Ban size={16} />,
                iconColor: 'text-slate-500',
                label: 'Order Cancelled',
                accent: 'from-slate-500 to-gray-600',
            },
            cancellation_request: {
                bg: 'bg-gradient-to-r from-orange-50 to-amber-50/50',
                border: 'border-orange-200',
                icon: <AlertTriangle size={16} />,
                iconColor: 'text-orange-500',
                label: 'Cancellation Request',
                accent: 'from-orange-500 to-amber-500',
            },
            extension_request: {
                bg: 'bg-gradient-to-r from-amber-50 to-yellow-50/60',
                border: 'border-amber-200',
                icon: <Clock size={16} />,
                iconColor: 'text-amber-600',
                label: 'Extension Requested',
                accent: 'from-amber-500 to-yellow-500',
            },
            extension_approved: {
                bg: 'bg-gradient-to-r from-emerald-50 to-green-50/50',
                border: 'border-emerald-200',
                icon: <Check size={16} />,
                iconColor: 'text-emerald-600',
                label: 'Extension Approved',
                accent: 'from-emerald-500 to-green-500',
            },
            extension_denied: {
                bg: 'bg-gradient-to-r from-slate-50 to-gray-100/80',
                border: 'border-slate-300',
                icon: <X size={16} />,
                iconColor: 'text-slate-500',
                label: 'Extension Denied',
                accent: 'from-slate-500 to-gray-600',
            },
            system_deadline_warning: {
                bg: 'bg-gradient-to-r from-orange-50 to-amber-50/60',
                border: 'border-orange-300',
                icon: <AlertTriangle size={16} />,
                iconColor: 'text-orange-500',
                label: 'Shipping Deadline',
                accent: 'from-orange-500 to-amber-500',
            },
            system_deadline_urgent: {
                bg: 'bg-gradient-to-r from-red-50 to-orange-50/60',
                border: 'border-red-300',
                icon: <AlertTriangle size={16} />,
                iconColor: 'text-red-600',
                label: '⚠️ Urgent — Ship Now',
                accent: 'from-red-500 to-orange-600',
            },
            shipment_confirmation_request: {
                bg: 'bg-gradient-to-r from-indigo-50 to-blue-50/50',
                border: 'border-indigo-200',
                icon: <Truck size={16} />,
                iconColor: 'text-indigo-600',
                label: 'Shipping Confirmation Required',
                accent: 'from-indigo-500 to-blue-600',
            },
        };

        const style = typeStyles[messageType] || typeStyles.system;
        let disputeData: any = null;
        let cancelData: any = null;
        let cancelRequestData: any = null;
        let adminResData: any = null;

        if (messageType === 'admin_resolution' || (msg.content && msg.content.startsWith('{"action":'))) {
            try { adminResData = JSON.parse(msg.content); } catch { }
        }

        if (adminResData) {
            const isRefund = adminResData.action === 'refund_buyer';
            const amountEUR = Number(adminResData.amountEUR || 0).toFixed(2);
            return (
                <div key={msg.id || idx} className="flex justify-center my-6 px-4">
                    <div className="w-full max-w-md bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-blue-500/40 rounded-3xl p-5 shadow-2xl text-center space-y-3 relative overflow-hidden animate-in zoom-in-95">
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />
                        <div className="flex items-center justify-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest pt-1">
                            <ShieldAlert size={18} className="text-blue-400 animate-pulse" /> OFFICIAL PLATFORM ADMINISTRATION DECISION
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                            <p className="text-sm font-black text-white">
                                {isRefund
                                    ? `Decision: Full Item Refund of €${amountEUR} credited to Buyer (return shipping fees excluded).`
                                    : `Decision: Dispute resolved in favor of Seller. €${amountEUR} payout released to Seller.`
                                }
                            </p>
                            {adminResData.notes && (
                                <p className="text-xs text-slate-300 italic font-medium pt-1">"{adminResData.notes}"</p>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                            {new Date(msg.created_at || adminResData.timestamp || Date.now()).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            );
        }

        if (messageType === 'dispute_opened') {
            try { disputeData = JSON.parse(msg.content); } catch { }
        }
        if (messageType === 'status_cancelled') {
            try { cancelData = JSON.parse(msg.content); } catch { }
        }
        if (messageType === 'cancellation_request') {
            try { cancelRequestData = JSON.parse(msg.content); } catch { }
        }

        // ── SHIPMENT CONFIRMATION REQUEST (special full render) ──
        if (messageType === 'shipment_confirmation_request') {
            let scData: any = {};
            try { scData = JSON.parse(msg.content); } catch { }
            const isBuyer = activeChatData && String(currentUser?.id) === String(activeChatData.buyer_id);
            const isSeller = activeChatData && String(currentUser?.id) === String(activeChatData.seller_id);
            const orderStatus = activeChatData?.orderItem?.status;
            const isConfirmedOrDone = ['shipped', 'delivered', 'completed', 'payout_completed'].includes(orderStatus || '');
            const isDisputed = orderStatus === 'disputed';
            const photos: string[] = Array.isArray(scData.photos) ? scData.photos : [];

            return (
                <div key={msg.id || idx} className="flex justify-center my-5 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-indigo-50 to-blue-50/50 border border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2.5 flex items-center gap-2">
                            <Truck size={16} className="text-white/90" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">Print & Shipment Verification</span>
                            <span className="ml-auto text-[9px] text-white/60 font-bold">
                                {new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className="px-4 py-4 space-y-3">
                            <p className="text-sm font-bold text-slate-800">
                                📦 {isBuyer ? "The seller completed your order and requested verification. Please check the photos below before shipping label generation." : "You sent this verification request to the buyer."}
                            </p>

                            {/* Verification Photos Gallery */}
                            {photos.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-indigo-900/70 tracking-wider">
                                        📸 Attached Print Photos ({photos.length})
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {photos.map((url: string, pIdx: number) => (
                                            <div
                                                key={pIdx}
                                                onClick={() => setSelectedPreviewImage(url)}
                                                className="relative group aspect-square rounded-xl overflow-hidden border border-indigo-200 bg-white cursor-pointer shadow-sm hover:shadow-md transition-all"
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Verification photo ${pIdx + 1}`}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                                                    <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {scData.addrDisplay && (
                                <div className="p-3 bg-white rounded-xl border border-indigo-100 flex items-start gap-2">
                                    <span className="text-indigo-500 mt-0.5">📍</span>
                                    <p className="text-xs font-bold text-slate-700">{scData.addrDisplay}</p>
                                </div>
                            )}

                            {isConfirmedOrDone ? (
                                <div className="space-y-3 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                        <p className="text-xs font-black text-emerald-800">
                                            {orderStatus === 'completed' || orderStatus === 'delivered' || orderStatus === 'payout_completed'
                                                ? 'Transaction Completed — Shipping Label Ready'
                                                : 'Confirmed — Shipping Label Generated'}
                                        </p>
                                    </div>

                                    {/* Direct Download Button for Seller / Maker */}
                                    {isSeller && (
                                        <button
                                            onClick={() => handleDownloadLabel(activeChatData?.orderItem?.furgonetka_package_id || activeChatData?.orderItem?.tracking_code || scData.itemId)}
                                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                                        >
                                            <Printer size={16} /> 📥 Download Courier Shipping Label (PDF)
                                        </button>
                                    )}
                                </div>
                            ) : isDisputed ? (
                                <div className="flex items-center gap-2 p-2.5 bg-red-50 rounded-xl border border-red-200">
                                    <ShieldAlert size={14} className="text-red-600 shrink-0" />
                                    <p className="text-xs font-black text-red-700">Dispute Opened — Platform review in progress.</p>
                                </div>
                            ) : isBuyer ? (
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => handleConfirmShipment(scData.itemId)}
                                        disabled={confirmingShipment}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {confirmingShipment ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                        Looks Good! Confirm
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDisputeEmail(currentUser?.email || '');
                                            setDisputeProblemType('quality_issue');
                                            setDisputeDescription('I am not satisfied with the item photos / shipment verification provided.');
                                            setShowDisputeModal(true);
                                        }}
                                        disabled={confirmingShipment}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <ShieldAlert size={12} /> Not OK (Open Dispute)
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wide text-center">⏳ Awaiting buyer's confirmation...</p>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'status_order_confirmed') {
            let ocData: any = {};
            try { ocData = JSON.parse(msg.content); } catch {}
            const deadlineDate = ocData.ship_by_deadline ? new Date(ocData.ship_by_deadline) : null;
            const deadlineStr = ocData.deadline_label || (deadlineDate ? deadlineDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '');
            const isSeller_ = activeChatData && String(currentUser?.id) === String(activeChatData.seller_id);
            return (
                <div key={msg.id || idx} className="flex justify-center my-4 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-indigo-50 to-blue-50/50 border border-indigo-200/60 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 flex items-center gap-2">
                            <Package size={14} className="text-white/90" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">Order Confirmed</span>
                            <span className="ml-auto text-[9px] text-white/60 font-bold">{new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                            <p className="text-sm font-bold text-slate-800">✅ Payment confirmed. Your order is now in progress.</p>
                            {deadlineStr && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black ${isSeller_ ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                    <Clock size={13} className="shrink-0" />
                                    {isSeller_ ? `⏰ Ship by ${deadlineStr}` : `Seller must ship by ${deadlineStr}`}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'status_tracking') {
            let td: any = {};
            try { td = JSON.parse(msg.content); } catch {}
            const eventLabels: Record<string, string> = {
                in_transit: '🚚 Package In Transit',
                out_for_delivery: '🚴 Out For Delivery Today',
                in_transit_update: '📍 Transit Update',
            };
            const etaDate = td.estimated_delivery ? new Date(td.estimated_delivery) : null;
            const etaStr = etaDate ? etaDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;
            return (
                <div key={msg.id || idx} className="flex justify-center my-4 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-teal-50 to-cyan-50/50 border border-teal-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 flex items-center gap-2">
                            <Truck size={14} className="text-white/90" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">{eventLabels[td.event] || 'Tracking Update'}</span>
                            <span className="ml-auto text-[9px] text-white/60 font-bold">{new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                            {td.carrier && <p className="text-[11px] font-black uppercase text-teal-700 tracking-wider">{td.carrier}</p>}
                            {td.tracking_number && (
                                <div className="flex items-center gap-2 bg-white rounded-xl border border-teal-100 px-3 py-2">
                                    <span className="text-[10px] text-slate-400 font-black uppercase">Tracking:</span>
                                    <span className="font-mono text-xs font-black text-slate-800">{td.tracking_number}</span>
                                </div>
                            )}
                            {td.location && <p className="text-xs text-slate-600 font-medium">📍 {td.location}</p>}
                            {etaStr && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-xl border border-cyan-100">
                                    <Clock size={12} className="text-cyan-600" />
                                    <span className="text-xs font-black text-cyan-800">Estimated delivery: {etaStr}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'status_delivered') {
            let dd: any = {};
            try { dd = JSON.parse(msg.content); } catch {}
            const isBuyer_ = activeChatData && String(currentUser?.id) === String(activeChatData.buyer_id);
            const isAlreadyCompleted = ['completed', 'disputed'].includes(activeChatData?.orderItem?.status || '');
            const confirmDeadlineDate = dd.confirm_deadline ? new Date(dd.confirm_deadline) : null;
            const confirmDeadlineStr = confirmDeadlineDate ? confirmDeadlineDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;
            const deliveredDate = dd.delivered_at ? new Date(dd.delivered_at) : new Date(msg.created_at);
            return (
                <div key={msg.id || idx} className="flex justify-center my-4 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-emerald-50 to-teal-50/50 border-2 border-emerald-300 rounded-2xl overflow-hidden shadow-md">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 flex items-center gap-2">
                            <PackageCheck size={16} className="text-white" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">✅ Delivered</span>
                            <span className="ml-auto text-[9px] text-white/70 font-bold">{deliveredDate.toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-4 py-4 space-y-3">
                            <p className="text-sm font-black text-slate-800">Your package has been delivered by the courier.</p>
                            {dd.carrier && <p className="text-[11px] font-black uppercase text-teal-700 tracking-wider">{dd.carrier} · {dd.tracking_number}</p>}
                            {!isAlreadyCompleted && isBuyer_ && (
                                <>
                                    <p className="text-xs text-slate-500 font-medium">Please confirm you received the item. If there's an issue, you can open a dispute instead.</p>
                                    {confirmDeadlineStr && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200">
                                            <Clock size={12} className="text-amber-600 shrink-0" />
                                            <span className="text-xs font-black text-amber-800">Auto-confirmed by {confirmDeadlineStr} if no action is taken.</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleConfirmReceipt(activeChatData?.orderItem?.id)}
                                        disabled={confirmingShipment}
                                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
                                    >
                                        {confirmingShipment ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                                        I Received My Order — Confirm Receipt
                                    </button>
                                </>
                            )}
                            {isAlreadyCompleted && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-200">
                                    <CheckCircle2 size={13} className="text-green-600" />
                                    <span className="text-xs font-black text-green-800">Receipt confirmed. Transaction complete.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'status_completed') {
            let cd: any = {};
            try { cd = JSON.parse(msg.content); } catch {}
            const autoConfirmed = cd.confirmed_by === 'auto';
            return (
                <div key={msg.id || idx} className="flex justify-center my-4 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-green-50 to-emerald-50/50 border-2 border-emerald-300 rounded-2xl overflow-hidden shadow-md">
                        <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-white" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">🏁 Sale Complete</span>
                            <span className="ml-auto text-[9px] text-white/70 font-bold">{new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-4 py-4 space-y-2">
                            <p className="text-sm font-black text-slate-800">
                                {autoConfirmed ? 'Transaction automatically completed — no dispute was raised within 2 days.' : '✅ Buyer confirmed receipt. Transaction complete.'}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">Funds have been released to the seller's balance. Thank you for using Printis!</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'extension_request') {
            let ed: any = {};
            try { ed = JSON.parse(msg.content); } catch {}
            const isBuyer_ = activeChatData && String(currentUser?.id) === String(activeChatData.buyer_id);
            const alreadyActed = activeChatData?.orderItem?.extension_approved || activeChatData?.orderItem?.extension_denied;
            const originalDeadline = ed.current_deadline ? new Date(ed.current_deadline).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;
            return (
                <div key={msg.id || idx} className="flex justify-center my-4 px-4">
                    <div className="w-full max-w-md bg-gradient-to-r from-amber-50 to-yellow-50/60 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 flex items-center gap-2">
                            <Clock size={14} className="text-white/90" />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">Shipping Extension Requested</span>
                            <span className="ml-auto text-[9px] text-white/60 font-bold">{new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="px-4 py-3 space-y-3">
                            <p className="text-sm font-bold text-slate-800">The seller has requested 3 extra days to ship your order.</p>
                            {originalDeadline && <p className="text-xs text-slate-500 font-medium">Original deadline: {originalDeadline}</p>}
                            {isBuyer_ && !alreadyActed ? (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleExtensionAction('approve_extension', activeChatData?.orderItem?.id)}
                                        disabled={confirmingShipment}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {confirmingShipment ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                        Approve (+3 days)
                                    </button>
                                    <button
                                        onClick={() => handleExtensionAction('deny_extension', activeChatData?.orderItem?.id)}
                                        disabled={confirmingShipment}
                                        className="flex-1 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {confirmingShipment ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                        Deny
                                    </button>
                                </div>
                            ) : alreadyActed ? (
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide text-center">✓ {activeChatData?.orderItem?.extension_approved ? 'Extension approved.' : 'Extension denied.'}</p>
                            ) : (
                                <p className="text-[11px] font-black text-amber-700 uppercase tracking-wide text-center">⏳ Awaiting buyer's response...</p>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'extension_approved') {
            let ed: any = {};
            try { ed = JSON.parse(msg.content); } catch {}
            return (
                <div key={msg.id || idx} className="flex justify-center my-3 px-4">
                    <div className="w-full max-w-md bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                            <Check size={14} className="text-emerald-700" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-emerald-900">Extension Approved</p>
                            <p className="text-xs text-emerald-700 font-medium">New shipping deadline: {ed.deadline_label || 'extended by 3 days'}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'extension_denied') {
            let ed: any = {};
            try { ed = JSON.parse(msg.content); } catch {}
            return (
                <div key={msg.id || idx} className="flex justify-center my-3 px-4">
                    <div className="w-full max-w-md bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            <X size={14} className="text-slate-600" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-800">Extension Denied</p>
                            <p className="text-xs text-slate-500 font-medium">Original deadline applies: {ed.deadline_label || 'no extension granted'}</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (messageType === 'system_deadline_warning' || messageType === 'system_deadline_urgent') {
            let wd: any = {};
            try { wd = JSON.parse(msg.content); } catch {}
            const isUrgent = messageType === 'system_deadline_urgent';
            return (
                <div key={msg.id || idx} className="flex justify-center my-3 px-4">
                    <div className={`w-full max-w-md border rounded-2xl px-4 py-3 shadow-sm flex items-center gap-3 ${isUrgent ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
                        <AlertTriangle size={16} className={`shrink-0 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
                        <p className={`text-xs font-black ${isUrgent ? 'text-red-800' : 'text-orange-800'}`}>{wd.message || msg.content}</p>
                    </div>
                </div>
            );
        }

        const isSeller = activeChatData && String(currentUser?.id) === String(activeChatData.seller_id);

        return (
            <div key={msg.id || idx} className="flex justify-center my-5 px-4">
                <div className={`w-full max-w-md ${style.bg} border ${style.border} rounded-2xl overflow-hidden shadow-sm`}>
                    <div className={`bg-gradient-to-r ${style.accent} px-4 py-2 flex items-center gap-2`}>
                        <div className="text-white/90">{style.icon}</div>
                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">{style.label}</span>
                        <span className="ml-auto text-[9px] text-white/60 font-bold">
                            {new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="px-4 py-3 space-y-3">
                        {disputeData ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Problem:</span>
                                    <span className="text-sm font-bold text-slate-800">{disputeData.problemType}</span>
                                </div>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">{disputeData.description}</p>
                            </div>
                        ) : cancelData ? (
                            // ── CANCELLED message ──
                            <div className="space-y-2">
                                {cancelData.type === 'seller_cancelled' ? (
                                    <>
                                        <p className="text-sm font-black text-slate-800">😔 We're sorry — the seller has cancelled this order.</p>
                                        <p className="text-xs text-slate-500 font-medium">Reason: <span className="italic">"{cancelData.reason}"</span></p>
                                        <div className="flex items-center gap-2 mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                            <span className="text-xs font-black text-emerald-700">Full refund of €{Number(cancelData.refund_eur).toFixed(2)} credited to your Printis Wallet.</span>
                                        </div>
                                    </>
                                ) : cancelData.type === 'seller_accepted_cancel' ? (
                                    <>
                                        <p className="text-sm font-black text-slate-800">✅ Cancellation confirmed by seller.</p>
                                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                                <span>Refund issued:</span>
                                                <span className="text-emerald-700 font-black">€{Number(cancelData.refund_eur).toFixed(2)}</span>
                                            </div>
                                            {cancelData.shipping_deducted_eur > 0 && (
                                                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                                                    <span>Shipping (non-refundable):</span>
                                                    <span>−€{Number(cancelData.shipping_deducted_eur).toFixed(2)}</span>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-emerald-600 font-bold pt-1">Amount credited to your Printis Wallet.</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm font-bold text-slate-700">Order has been cancelled.</p>
                                )}
                            </div>
                        ) : cancelRequestData ? (
                            // ── CANCELLATION REQUEST message ──
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-black text-slate-800 mb-1">⚠️ The buyer has requested to cancel this order.</p>
                                    <p className="text-xs text-slate-500 font-medium">Reason: <span className="italic">"{cancelRequestData.reason}"</span></p>
                                </div>
                                <div className="p-3 bg-white rounded-xl border border-orange-200 space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold text-slate-600">
                                        <span>Item total:</span><span>€{Number(cancelRequestData.item_total_eur).toFixed(2)}</span>
                                    </div>
                                    {cancelRequestData.shipping_cost_eur > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-slate-400">
                                            <span>Shipping (non-refundable):</span><span>−€{Number(cancelRequestData.shipping_cost_eur).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-xs font-black text-emerald-700 border-t border-orange-100 pt-1.5">
                                        <span>Buyer would receive:</span><span>€{Number(cancelRequestData.refund_eur).toFixed(2)}</span>
                                    </div>
                                </div>
                                {/* Only seller sees Accept/Decline — and only when item is still cancellation_requested */}
                                {isSeller && activeChatData?.orderItem?.status === 'cancellation_requested' && (
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => handleCancelResponse(true, cancelRequestData.item_id)}
                                            disabled={cancelRespondSubmitting}
                                            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {cancelRespondSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                            Accept Cancellation
                                        </button>
                                        <button
                                            onClick={() => handleCancelResponse(false, cancelRequestData.item_id)}
                                            disabled={cancelRespondSubmitting}
                                            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            {cancelRespondSubmitting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                            Decline + Dispute
                                        </button>
                                    </div>
                                )}
                                {!isSeller && (
                                    <p className="text-[11px] font-black text-orange-600 uppercase tracking-wide text-center">⏳ Awaiting seller's response...</p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-800 font-bold leading-relaxed">{msg.content}</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderActionCard = (orderItem: any, chatData: any) => {
        if (!orderItem || !currentUser) return null;
        const status = (orderItem.status || 'pending').toLowerCase();
        const isDigital = chatData?.offers?.category === 'digital';
        const isJob = chatData?.offers?.category === 'job';
        const jobPosterId = chatData?.offers?.user_id;

        // For Job Offers: Printer = not job poster, Customer = job poster
        // For Physical/Digital Offers: Printer/Seller = seller_id, Customer/Buyer = buyer_id
        const isCustomer = isJob
            ? (jobPosterId ? String(currentUser.id) === String(jobPosterId) : String(currentUser.id) === String(chatData?.seller_id))
            : String(currentUser.id) === String(chatData?.buyer_id);

        const isPrinter = isJob
            ? (jobPosterId ? String(currentUser.id) !== String(jobPosterId) : String(currentUser.id) === String(chatData?.buyer_id))
            : String(currentUser.id) === String(chatData?.seller_id);

        const showShipCard = status === 'pending' && isPrinter;
        const showWaitCard = status === 'pending' && isCustomer;
        const showInTransitCustomer = (status === 'shipped' || status === 'in_transit') && !isDigital && isCustomer;
        const showInTransitPrinter = (status === 'shipped' || status === 'in_transit') && !isDigital && isPrinter;
        const showDeliveredCustomer = (status === 'delivered' || (status === 'shipped' && isDigital)) && isCustomer;
        const showDeliveredPrinter = (status === 'delivered' || (status === 'shipped' && isDigital)) && isPrinter;

        const pendingVerificationRequest = messages.some((m: any) => m.message_type === 'shipment_confirmation_request');

        if (showShipCard) {
            if (pendingVerificationRequest) {
                return (
                    <div className="flex justify-center px-4 w-full my-4">
                        <div className="w-full max-w-md bg-indigo-50/90 border border-indigo-200 rounded-2xl p-5 text-center shadow-sm">
                            <div className="w-10 h-10 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                                <Truck size={18} className="text-indigo-600 animate-pulse" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-1">
                                Verification Request Sent
                            </p>
                            <p className="text-xs text-slate-600 font-medium">
                                ⏳ Verification photos & shipping request sent to buyer. Waiting for buyer approval before generating shipping label.
                            </p>
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-white border-2 border-dashed border-blue-200 rounded-2xl p-5 text-center shadow-sm">
                            <div className="w-10 h-10 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                {isDigital ? <Mail size={18} className="text-blue-600" /> : <Truck size={18} className="text-blue-600" />}
                            </div>
                            <p className="text-sm font-bold text-gray-800 mb-1">
                                {isJob ? 'Ready to ship the printed item?' : isDigital ? 'Ready to deliver?' : 'Ready to ship?'}
                            </p>
                            <p className="text-xs text-gray-500 font-medium mb-3">
                                {isJob
                                    ? "You've received the 3D file via email. Print the item, attach photos of the print, and send for buyer verification."
                                    : isDigital
                                        ? "Once you've sent the files to the buyer's email, mark it as delivered below."
                                        : "Pack the order securely, attach verification photos, and send for buyer verification before generating label."}
                            </p>

                            {/* Photo Upload Attachment Section */}
                            {!isDigital && (
                                <div className="mb-4 text-left">
                                    <label className="text-[11px] font-black uppercase text-gray-700 block mb-1.5 tracking-wider">
                                        📸 Attach Verification Photos of Print / Item
                                    </label>
                                    
                                    {verificationFiles.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            {verificationFiles.map((file, fIdx) => {
                                                const previewUrl = URL.createObjectURL(file);
                                                return (
                                                    <div key={fIdx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group bg-gray-50">
                                                        <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => setVerificationFiles(prev => prev.filter((_, idx) => idx !== fIdx))}
                                                            className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-full opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-md"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <input
                                        type="file"
                                        id="verification-photo-input"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
                                                setVerificationFiles(prev => [...prev, ...newFiles].slice(0, 5));
                                            }
                                            e.target.value = '';
                                        }}
                                    />

                                    {verificationFiles.length < 5 && (
                                        <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                                            <label
                                                htmlFor="verification-photo-input"
                                                className="w-full sm:w-1/2 py-2.5 px-3 border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl text-xs font-bold text-indigo-700 flex items-center justify-center gap-2 cursor-pointer transition-all"
                                            >
                                                <Upload size={14} />
                                                Choose from Disk ({verificationFiles.length}/5)
                                            </label>
                                            <div className="w-full sm:w-1/2 relative">
                                                <input
                                                    type="text"
                                                    placeholder="📋 Click & press Ctrl+V to paste"
                                                    onPaste={(e) => {
                                                        e.stopPropagation();
                                                        if (e.clipboardData?.items) {
                                                            processPastedVerificationItems(e.clipboardData.items);
                                                        }
                                                    }}
                                                    className="w-full py-2.5 px-3 bg-indigo-50/40 border border-indigo-200 rounded-xl font-bold text-xs text-indigo-900 placeholder-indigo-400 outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
                                                    readOnly={verificationFiles.length >= 5}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isDigital && (
                                <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-xl p-3 mb-4 flex items-start gap-2.5 text-left text-[11px] font-bold text-gray-700">
                                    <div className="bg-white p-1 rounded-md shadow-sm border border-[#FFCC00]/50 shrink-0">
                                        <Mail size={14} className="text-[#D40511]" />
                                    </div>
                                    <p className="leading-snug">
                                        <span className="text-[#D40511] font-black uppercase tracking-wider block mb-0.5 text-[9px]">Important</span>
                                        A shipping label will be generated via Furgonetka once the buyer approves your verification photos.
                                    </p>
                                </div>
                            )}

                            {/* Photo required warning */}
                            {!isDigital && verificationFiles.length === 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-center gap-2.5 text-left text-[11px] font-bold text-red-600">
                                    <AlertTriangle size={14} className="shrink-0 text-red-500" />
                                    <p>⚠️ You must attach at least <strong>1 photo</strong> of the printed / packed item before sending the verification request.</p>
                                </div>
                            )}

                            {!isDigital ? (
                                <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
                                    <button
                                        onClick={() => handleFurgonetkaShip(orderItem.id)}
                                        disabled={furgonetkaLoading || verificationUploading || verificationFiles.length === 0}
                                        className={`w-full py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                            verificationFiles.length === 0
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-indigo-600/20'
                                        }`}
                                        title={verificationFiles.length === 0 ? 'Attach at least 1 photo first' : 'Send verification request'}
                                    >
                                        {(furgonetkaLoading || verificationUploading) ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <>
                                                {verificationFiles.length === 0 ? <AlertTriangle size={14} /> : <Send size={14} />}
                                                {verificationFiles.length === 0 ? 'Attach Photos First' : 'Send Photos & Request Verification'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleStatusUpdate('shipped')}
                                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                                >
                                    <Check size={14} className="inline mr-2 -mt-0.5" />
                                    Mark as Sent to Email
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (showWaitCard) {
            const digitalFileUrl = chatData?.offers?.file_url;
            if (isDigital) {
                return (
                    <div className="flex justify-center my-4 px-4 w-full">
                        <div className="w-full max-w-md bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-5 text-center shadow-sm space-y-3">
                            <div className="w-12 h-12 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                <Download size={22} />
                            </div>
                            <h4 className="text-sm font-black text-gray-900">
                                📦 Your 3D Digital File is Ready!
                            </h4>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                You bought a digital 3D model. Download your STL / 3MF file directly below.
                            </p>
                            {digitalFileUrl ? (
                                <a
                                    href={digitalFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 active:scale-95 transition-all w-full cursor-pointer"
                                >
                                    <Download size={18} /> 📥 Download 3D File (STL / 3MF)
                                </a>
                            ) : (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800">
                                    ⏳ Preparing file download link...
                                </div>
                            )}
                            <div className="pt-2 border-t border-emerald-100">
                                <button
                                    onClick={() => handleStatusUpdate('completed')}
                                    disabled={statusUpdating}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-md flex items-center justify-center gap-2"
                                >
                                    {statusUpdating ? <Loader2 size={14} className="inline animate-spin" /> : <CheckCircle2 size={14} className="inline" />} Confirm & Finalize Order
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex justify-center my-4 px-4 w-full">
                    <div className="w-full max-w-md bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-center">
                        <p className="text-xs font-bold text-amber-700">
                            {pendingVerificationRequest
                                ? '📦 The seller sent print verification photos! Please review them in the chat message above to generate the shipping label.'
                                : isJob
                                    ? '🖨️ The printer has received your 3D file and is working on it. Waiting for print verification photos...'
                                    : '📸 Waiting for the seller to upload print verification photos before shipping...'}
                        </p>
                    </div>
                </div>
            );
        }

        if (showInTransitCustomer) {
            const trackingNo = orderItem.tracking_number || orderItem.tracking_code;
            const carrier = orderItem.carrier || 'Courier';
            const selectedPoint = orderItem?.shipping_address?.selected_point || orderItem?.selected_point;
            const isLocker = !!selectedPoint?.code || ['inpost_paczkomat', 'dpd_pickup', 'dhl_pop', 'orlen_paczka'].includes(orderItem?.shipping_method_id || '');
            const deliveryType: DeliveryType = isLocker ? 'PARCEL_LOCKER' : 'COURIER';
            const pointName = selectedPoint?.name || selectedPoint?.code;

            const statusInfo = getTrackingStatusInfo(
                orderItem.status || 'IN_TRANSIT',
                deliveryType,
                pointName,
                carrier
            );

            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200 rounded-2xl p-5 text-center shadow-sm space-y-3">
                            <div className="w-10 h-10 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
                                <Truck size={20} className="animate-pulse" />
                            </div>
                            <p className="text-sm font-black text-slate-800">
                                📦 {statusInfo.title}
                            </p>
                            <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                {statusInfo.description}
                            </p>
                            {trackingNo && (
                                <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-blue-200 text-xs font-mono font-bold text-blue-700 shadow-xs mx-auto">
                                    <span>Tracking #: {trackingNo}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (showInTransitPrinter) {
            const selectedPoint = orderItem?.shipping_address?.selected_point || orderItem?.selected_point;
            const isLocker = !!selectedPoint?.code || ['inpost_paczkomat', 'dpd_pickup', 'dhl_pop', 'orlen_paczka'].includes(orderItem?.shipping_method_id || '');
            const pointName = selectedPoint?.name || selectedPoint?.code;

            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-blue-50/80 border border-blue-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-blue-700">
                                {isLocker
                                  ? `📦 Package shipped! Handed over for delivery to locker${pointName ? ` (${pointName})` : ''}. Waiting for customer pickup...`
                                  : '📦 Package shipped! Handed over to the courier. Waiting for delivery to customer...'
                                }
                            </p>
                            {isPrinter && (orderItem.furgonetka_package_id || orderItem.tracking_code || orderItem.label_url) && (
                                <button
                                    onClick={() => handleDownloadLabel(orderItem.furgonetka_package_id || orderItem.tracking_code)}
                                    className="mt-3 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 mx-auto transition-all shadow-md active:scale-95 cursor-pointer"
                                >
                                    <Printer size={14} /> 📥 Download Courier Shipping Label (PDF)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (showDeliveredCustomer) {
            const digitalFileUrl = chatData?.offers?.file_url;
            const confirmDeadline = orderItem.buyer_confirm_deadline ? new Date(orderItem.buyer_confirm_deadline) : null;
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-2 border-emerald-300 rounded-2xl p-5 text-center shadow-md space-y-3.5">
                            <div className="w-12 h-12 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                {isDigital ? <Download size={22} /> : <CheckCircle2 size={24} />}
                            </div>
                            <div>
                                <h4 className="text-base font-black text-slate-900">
                                    {isDigital ? '📦 Your 3D File is Ready!' : '✅ Package Delivered — Is Everything OK?'}
                                </h4>
                                <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1">
                                    {isDigital
                                        ? 'Your digital purchase is ready for download.'
                                        : 'The courier has delivered your package. Please inspect your item. If everything is fine with your order, confirm below to release payment to the seller.'}
                                </p>
                            </div>

                            {isDigital && digitalFileUrl && (
                                <a
                                    href={digitalFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/25 active:scale-95 transition-all w-full cursor-pointer"
                                >
                                    <Download size={18} /> 📥 Download 3D File (STL / 3MF)
                                </a>
                            )}

                            <div className="space-y-2 pt-1">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleConfirmReceipt(orderItem.id)}
                                        disabled={confirmingShipment}
                                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        {confirmingShipment ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                                        EVERYTHING IS OK! CONFIRM
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDisputeEmail(currentUser?.email || '');
                                            setDisputeProblemType('quality_issue');
                                            setDisputeDescription('Item arrived damaged / not as described / issue with package.');
                                            setShowDisputeModal(true);
                                        }}
                                        disabled={confirmingShipment}
                                        className="px-3.5 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                        <ShieldAlert size={14} /> Problem
                                    </button>
                                </div>
                                {confirmDeadline && (
                                    <p className="text-[10px] text-emerald-700 font-bold">
                                        ⏰ Auto-confirms on {confirmDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} if no issue is reported.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (showDeliveredPrinter) {
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-emerald-800">
                                ✅ Package delivered to customer! Waiting for buyer confirmation or automatic payout release in 2 days.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        if (status === 'completed' || status === 'disputed' || status === 'cancelled') {
            const digitalFileUrl = chatData?.offers?.file_url;
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className={`w-full max-w-md rounded-2xl p-5 text-center ${
                            status === 'completed' ? 'bg-green-50/90 border border-green-200 shadow-sm space-y-3' :
                            status === 'cancelled' ? 'bg-slate-50/80 border border-slate-200' :
                            'bg-red-50/80 border border-red-100'
                        }`}>
                            <p className={`text-xs font-black uppercase tracking-widest ${
                                status === 'completed' ? 'text-green-600' :
                                status === 'cancelled' ? 'text-slate-500' :
                                'text-red-600'
                            }`}>
                                {status === 'completed' ? '✅ Transaction Finalized' :
                                 status === 'cancelled' ? '🚫 Order Cancelled' :
                                 '⚠️ Dispute Open — Funds on hold'}
                            </p>
                            {status === 'completed' && (
                                <p className="text-xs text-gray-600 font-bold">
                                    Transaction completed successfully! Funds have been released.
                                </p>
                            )}
                            {status === 'completed' && digitalFileUrl && (
                                <a
                                    href={digitalFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all w-full cursor-pointer"
                                >
                                    <Download size={18} /> 📥 Download Purchased 3D File (STL / 3MF)
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // ── CANCELLATION REQUESTED — buyer waiting ──
        if (status === 'cancellation_requested') {
            return (
                <div className="flex justify-center my-4 px-4 w-full">
                    <div className="w-full max-w-md bg-orange-50/80 border border-orange-200 rounded-2xl p-4 text-center">
                        <p className="text-xs font-bold text-orange-700">
                            ⏳ Cancellation request sent — waiting for the seller's response.
                        </p>
                    </div>
                </div>
            );
        }

        // ── CANCEL BUTTONS (physical & job only, non-terminal statuses) ──
        const canShowCancelButtons = !isDigital && !['completed', 'disputed', 'cancelled'].includes(status);
        if (canShowCancelButtons) {
            return (
                <div className="flex justify-center my-2 px-4 w-full">
                    <div className="w-full max-w-md">
                        {/* Printer cancel button — available at pending OR shipped */}
                        {isPrinter && ['pending', 'shipped'].includes(status) && (
                            <button
                                onClick={() => openCancelModal('seller')}
                                className="w-full mt-2 py-2.5 border-2 border-dashed border-red-200 rounded-xl text-xs font-black uppercase tracking-wider text-red-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Ban size={13} /> Cancel Order
                            </button>
                        )}
                        {/* Customer cancel request — only at pending (not after shipped) */}
                        {isCustomer && status === 'pending' && (
                            <button
                                onClick={() => openCancelModal('buyer')}
                                className="w-full mt-2 py-2.5 border-2 border-dashed border-orange-200 rounded-xl text-xs font-black uppercase tracking-wider text-orange-400 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center gap-2"
                            >
                                <Ban size={13} /> Request Cancellation
                            </button>
                        )}
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            <main className="h-[calc(100dvh-60px)] overflow-hidden bg-slate-950 flex flex-col font-sans text-gray-900">
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between sticky top-0 z-10 shrink-0 text-white">
                <div className="flex items-center gap-3">
                    <Link href="/profile" className="p-1.5 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 hover:text-white transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-white">
                        <MessageSquare className="text-blue-400" size={18} /> Messages
                    </h1>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden min-h-0">
                <div className={`w-full md:w-1/3 max-w-sm bg-white border-r border-gray-100 flex flex-col overflow-hidden ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
                    {/* Tab bar */}
                    <div className="flex border-b border-gray-100 shrink-0">
                        <button
                            onClick={() => setChatTab('active')}
                            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${chatTab === 'active' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                            <MessageSquare size={13} /> Active
                            {chats.filter(c => !c.archived_at && c.id !== 'draft').reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
                                <span className="ml-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                                    {chats.filter(c => !c.archived_at && c.id !== 'draft').reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setChatTab('archived')}
                            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${chatTab === 'archived' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-400 hover:text-gray-700'}`}
                        >
                            <Archive size={13} /> Archive
                            {chats.filter(c => !!c.archived_at).length > 0 && (
                                <span className="ml-1 bg-gray-300 text-gray-700 text-[9px] font-black rounded-full px-1.5 h-4 flex items-center justify-center">
                                    {chats.filter(c => !!c.archived_at).length}
                                </span>
                            )}
                        </button>
                    </div>
                    {/* Chat list */}
                    <div className="flex-1 overflow-y-auto">
                    {loadingChats ? (
                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                    ) : (() => {
                        const filteredChats = chats.filter(c =>
                            chatTab === 'active' ? !c.archived_at : !!c.archived_at
                        );
                        if (filteredChats.length === 0) return (
                            <div className="p-8 text-center text-gray-400">
                                {chatTab === 'archived' ? <Archive className="mx-auto mb-2 opacity-50" size={32} /> : <MessageSquare className="mx-auto mb-2 opacity-50" size={32} />}
                                <p className="text-sm font-bold">{chatTab === 'archived' ? 'No archived chats' : 'No active chats'}</p>
                                {chatTab === 'archived' && <p className="text-xs text-gray-400 mt-1 font-medium">Chats are auto-archived 24h after completion</p>}
                            </div>
                        );
                        return filteredChats.map((chat) => {
                            const isSupport = chat.isSupport || (!chat.offer_id && !chat.order_id);
                            return (
                            <div key={chat.id} className="relative group/chatrow">
                                <button
                                    onClick={() => setActiveChatId(chat.id)}
                                    className={`w-full text-left p-3.5 border-b border-gray-100 dark:border-slate-800 transition-all flex gap-3 pr-10 ${
                                      isSupport
                                        ? activeChatId === chat.id
                                          ? 'bg-blue-900/30 border-l-4 border-l-blue-500 font-bold shadow-xs'
                                          : 'hover:bg-blue-50/50 dark:hover:bg-slate-800/50 border-l-4 border-l-blue-500'
                                        : activeChatId === chat.id
                                          ? 'bg-slate-900 text-white border-l-4 border-l-blue-500 shadow-md'
                                          : 'border-l-4 border-l-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full border overflow-hidden shrink-0 flex items-center justify-center ${
                                      isSupport
                                        ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 border-blue-400 shadow-md text-white'
                                        : 'bg-gray-100 border-gray-200'
                                    }`}>
                                        {isSupport ? (
                                            <Shield size={20} className="text-white drop-shadow-xs" />
                                        ) : chat.otherUser?.avatar_url ? (
                                            <img src={chat.otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={20} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div className="overflow-hidden flex-1 flex flex-col justify-center">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <h3 className={`truncate text-sm ${activeChatId === chat.id ? 'text-white font-black' : isSupport ? 'text-blue-600 font-black' : (chat.id === 'draft' ? 'text-blue-500 font-black' : (chat.unreadCount > 0 ? 'font-black text-gray-900 dark:text-white' : 'font-extrabold text-gray-800 dark:text-slate-200'))}`}>
                                                {isSupport ? 'Printis Support' : chat.otherUser?.full_name}
                                            </h3>
                                            {isSupport && (
                                              <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-black uppercase tracking-wider rounded flex items-center gap-0.5 shadow-2xs shrink-0">
                                                <Shield size={9} /> SUPPORT
                                              </span>
                                            )}
                                        </div>
                                        <p className={`text-xs truncate mt-0.5 ${activeChatId === chat.id ? 'text-blue-300 font-bold' : isSupport ? 'text-blue-500 font-bold' : (chat.unreadCount > 0 ? 'text-gray-900 dark:text-slate-100 font-bold' : 'text-blue-600 font-semibold')}`}>
                                            {isSupport ? 'Official System Communication' : (chat.offers?.title || 'Unknown Item')}
                                        </p>
                                        {chat.order_id && (
                                            <span className={`inline-block mt-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm w-fit ${
                                                chat.orderItem?.status === 'completed' || chat.orderItem?.status === 'transfer_completed' ? 'bg-emerald-100 text-emerald-700' :
                                                chat.orderItem?.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                chat.orderItem?.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                                chat.orderItem?.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {(() => {
                                                    const st = chat.orderItem?.status;
                                                    if (st === 'transfer_completed') return 'RESOLVED: PAID OUT';
                                                    if (st === 'cancelled') return 'RESOLVED: REFUNDED';
                                                    if (st === 'disputed') return 'DISPUTE IN REVIEW';
                                                    return st || 'pending';
                                                })()}
                                            </span>
                                        )}
                                        {chat.archived_at && chat.archived_by === 'auto' && (
                                            <span className="inline-block mt-1 text-[8px] font-black uppercase text-purple-400">Auto-archived</span>
                                        )}
                                    </div>
                                    {chat.unreadCount > 0 && (
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full self-center ml-2 border border-white shrink-0 shadow-sm" />
                                    )}
                                </button>
                                {/* Archive/Unarchive button — shown on hover, hidden for draft chats */}
                                {chat.id !== 'draft' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleArchiveChat(chat.id, !!chat.archived_at); }}
                                        disabled={archivingChatId === chat.id}
                                        title={chat.archived_at ? 'Restore from archive' : 'Archive this chat'}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/chatrow:opacity-100 transition-all p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-purple-600 disabled:opacity-50"
                                    >
                                        {archivingChatId === chat.id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : chat.archived_at
                                                ? <ArchiveRestore size={14} />
                                                : <Archive size={14} />
                                        }
                                    </button>
                                )}
                            </div>
                        );
                        });
                      })()}
                    </div>
                </div>

                <div className={`flex-1 flex flex-col bg-gray-50 relative ${!activeChatId ? 'hidden md:flex' : 'flex'}`} onPaste={handlePaste}>
                    {!activeChatId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <MessageSquare size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">Select a chat to start messaging</p>
                        </div>
                    ) : (
                        <>
                            {activeChatData && (() => {
                                const isSupport = activeChatData.isSupport || (!activeChatData.offer_id && !activeChatData.order_id);
                                return (
                                <div className={`px-3.5 sm:px-6 py-2.5 sm:py-4 border-b flex items-center gap-2 sm:gap-4 shrink-0 shadow-sm ${
                                  isSupport 
                                    ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border-blue-500/30 text-white' 
                                    : 'bg-white border-gray-100'
                                }`}>
                                    <button onClick={() => setActiveChatId(null)} className={`md:hidden p-2 -ml-2 ${isSupport ? 'text-slate-400 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className={`w-10 h-10 rounded-full border overflow-hidden shrink-0 flex items-center justify-center ${
                                      isSupport
                                        ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-slate-900 border-blue-400 shadow-lg text-white'
                                        : 'bg-gray-100 border-gray-200'
                                    }`}>
                                        {isSupport ? (
                                            <Shield size={22} className="text-white drop-shadow-md" />
                                        ) : activeChatData.otherUser?.avatar_url ? (
                                            <img src={activeChatData.otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={20} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className={`font-black text-base truncate ${isSupport ? 'text-white' : 'text-gray-900'}`}>
                                              {isSupport ? 'Printis Support' : activeChatData.otherUser?.full_name}
                                            </h2>
                                            {isSupport && (
                                              <span className="px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 text-blue-300 text-[9px] font-black uppercase tracking-wider rounded-md flex items-center gap-1">
                                                <Shield size={10} /> Verified Support
                                              </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {isSupport ? (
                                              <span className="text-xs font-medium text-slate-300 truncate">
                                                Official Customer Support & System Communication
                                              </span>
                                            ) : (
                                              <Link href={`/offer/${activeChatData.offer_id}`} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 w-fit">
                                                  <Package size={12} /> {activeChatData.offers?.title}
                                              </Link>
                                            )}
                                        </div>
                                    </div>
                                    {!isSupport && !activeChatData.order_id && (
                                        <button
                                            type="button"
                                            onClick={() => openProposalModal()}
                                            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95 border border-blue-400/20"
                                            title="Negotiate custom price, material, size or color"
                                        >
                                            <Handshake size={16} /> Negotiate / Custom Offer
                                        </button>
                                    )}
                                </div>
                                );
                            })()}
                            <div className="shrink-0 border-b border-gray-200 bg-white relative z-20 shadow-sm">
                                {(showJobProposalBanner || (activeChatData?.offers?.category === 'job')) && activeChatData && (() => {
                                    const isJobOffer = activeChatData.offers?.category === 'job';
                                    const isFixedPriceJob = isJobOffer && !activeChatData.offers?.is_negotiable && (activeChatData.offers?.price > 0);
                                    const jobPosterId = activeChatData.offers?.user_id;

                                    const isCustomer = isJobOffer
                                        ? (jobPosterId ? String(currentUser?.id) === String(jobPosterId) : String(currentUser?.id) === String(activeChatData.seller_id))
                                        : String(currentUser?.id) === String(activeChatData.buyer_id);

                                    const isPrinter = isJobOffer
                                        ? (jobPosterId ? String(currentUser?.id) !== String(jobPosterId) : String(currentUser?.id) === String(activeChatData.buyer_id))
                                        : String(currentUser?.id) === String(activeChatData.seller_id);
                                    
                                    // Find latest proposal message if any
                                    const latestProposalMsg = messages.slice().reverse().find(m => m.content.startsWith('[PROPOSAL]'));
                                    const latestProposalData = latestProposalMsg ? (() => {
                                        try { return JSON.parse(latestProposalMsg.content.substring(10)); } catch { return null; }
                                    })() : null;

                                    const hasProposal = !!latestProposalData && (latestProposalData.status === 'pending' || latestProposalData.status === 'accepted');
                                    const isOrderPaid = !!activeChatData.order_id || latestProposalData?.status === 'accepted';
                                    const proposalPrice = latestProposalData?.price || activeChatData.offers?.price;

                                    return (
                                        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white transition-all duration-300">
                                            {/* Top Compact Bar (Always visible, ~32px tall) */}
                                            <div className="px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                                                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                                    <div className="bg-blue-500/20 p-1 rounded text-blue-400 shrink-0">
                                                        <Printer size={13} />
                                                    </div>
                                                    <span className="font-black uppercase tracking-wider text-[9px] text-blue-400 shrink-0">
                                                        Job Specs:
                                                    </span>
                                                    <div className="flex items-center gap-1.5 truncate text-[11px] font-medium text-slate-200">
                                                        {activeChatData.offers?.material && (
                                                            <span className="font-bold text-white bg-blue-600/30 border border-blue-400/20 px-1.5 py-0.5 rounded text-[10px]">
                                                                {activeChatData.offers.material}
                                                            </span>
                                                        )}
                                                        {activeChatData.offers?.color && (
                                                            <span className="flex items-center gap-1 shrink-0">
                                                                <span className="w-2.5 h-2.5 rounded-full border border-white/40 shadow-xs" style={{ backgroundColor: (activeChatData.offers.color === '#0000ff' || activeChatData.offers.color === '#0000FF') ? '#3b82f6' : activeChatData.offers.color }} />
                                                                <span className="text-slate-300 text-[10px] hidden sm:inline">
                                                                    {(activeChatData.offers.color === '#0000ff' || activeChatData.offers.color === '#0000FF') ? 'Ocean Blue' : activeChatData.offers.color}
                                                                </span>
                                                            </span>
                                                        )}
                                                        <span className="font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-400/20 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                                            {isFixedPriceJob ? `${formatPrice(proposalPrice)} (Fixed)` : `${formatPrice(proposalPrice)}`}
                                                        </span>
                                                        {activeChatData.offers?.dimensions && (
                                                            <span className="text-slate-400 text-[10px] truncate hidden md:inline">• {activeChatData.offers.dimensions}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* STATE 1: Order Paid */}
                                                    {isOrderPaid ? (
                                                        isPrinter ? (
                                                            <Link href="/profile?tab=orders" className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md">
                                                                <Package size={12} /> Payment Secured — Ready to Print
                                                            </Link>
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase text-emerald-300 bg-emerald-500/20 border border-emerald-400/20 px-2 py-0.5 rounded-full tracking-wider">
                                                                📦 Paid & In Production
                                                            </span>
                                                        )
                                                    ) : hasProposal ? (
                                                        /* STATE 2: Printer has accepted/proposed, waiting for Customer payment */
                                                        isPrinter ? (
                                                            <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-500/20 border border-amber-400/20 px-2.5 py-1 rounded-lg tracking-wider flex items-center gap-1">
                                                                <Clock size={11} /> Awaiting Customer Payment
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAcceptProposal(latestProposalMsg!.id, latestProposalData)}
                                                                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md active:scale-95"
                                                            >
                                                                <CreditCard size={12} /> Pay & Checkout ({formatPrice(proposalPrice)})
                                                            </button>
                                                        )
                                                    ) : (
                                                        /* STATE 3: Initial (Printer hasn't accepted yet) */
                                                        isPrinter ? (
                                                            isFixedPriceJob ? (
                                                                <button
                                                                    onClick={() => handleSendJobProposal(activeChatData.offers.price)}
                                                                    disabled={sendingJobProposal}
                                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {sendingJobProposal ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Accept Job ({formatPrice(activeChatData.offers.price)})</>}
                                                                </button>
                                                            ) : (
                                                                <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-500/20 border border-amber-400/20 px-2 py-0.5 rounded-full tracking-wider hidden sm:inline">
                                                                    Proposal Required
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase text-blue-300 bg-blue-500/20 border border-blue-400/20 px-2 py-0.5 rounded-full tracking-wider animate-pulse">
                                                                Awaiting Printer
                                                            </span>
                                                        )
                                                    )}

                                                    {activeChatData.offers?.file_url && (
                                                        <a
                                                            href={activeChatData.offers.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                                                            title="Download 3D Model File"
                                                        >
                                                            <Download size={12} /> 3D File
                                                        </a>
                                                    )}

                                                    <button
                                                        onClick={() => setIsJobDetailsExpanded(!isJobDetailsExpanded)}
                                                        className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all border border-white/10"
                                                    >
                                                        {isJobDetailsExpanded ? 'Hide' : 'Details'} {isJobDetailsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Content Panel (Shown when toggle clicked) */}
                                            {isJobDetailsExpanded && (
                                                <div className="px-4 py-3 border-t border-white/10 flex flex-col gap-3 bg-gradient-to-b from-blue-950/40 to-slate-900 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-300">
                                                                {isPrinter ? 'Printer Fulfillment' : 'Customer Job Status'}
                                                            </p>
                                                            <p className="text-xs font-bold text-white">
                                                                {isOrderPaid ? (
                                                                    isPrinter 
                                                                        ? `Payment confirmed! You have 4 days to print & ship "${activeChatData.offers?.title}". Generate shipping label when ready.`
                                                                        : `Your print job for "${activeChatData.offers?.title}" is paid and in production! The printer will ship within 4 days.`
                                                                ) : hasProposal ? (
                                                                    isPrinter 
                                                                        ? `You accepted this job for ${formatPrice(proposalPrice)}. We are waiting for the customer to complete payment.`
                                                                        : `The printer accepted your job for ${formatPrice(proposalPrice)}! Complete payment below to start production.`
                                                                ) : (
                                                                    isPrinter 
                                                                        ? (isFixedPriceJob 
                                                                            ? `Fixed Price Job: ${formatPrice(activeChatData.offers.price)}. Click Accept to accept this job.` 
                                                                            : 'Propose your price to print this item.') 
                                                                        : 'The printer is reviewing your 3D file and requirements.'
                                                                )}
                                                            </p>
                                                        </div>

                                                        {/* Action buttons inside expanded drawer */}
                                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                                            {isOrderPaid ? (
                                                                isPrinter && (
                                                                    <Link 
                                                                        href="/profile?tab=orders"
                                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg active:scale-95"
                                                                    >
                                                                        <Truck size={14} /> Generate Shipping Label (Furgonetka)
                                                                    </Link>
                                                                )
                                                            ) : hasProposal ? (
                                                                isCustomer ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleAcceptProposal(latestProposalMsg!.id, latestProposalData)}
                                                                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg active:scale-95"
                                                                        >
                                                                            <CreditCard size={14} /> Pay & Checkout ({formatPrice(proposalPrice)})
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRejectProposal(latestProposalMsg!.id, latestProposalData)}
                                                                            className="px-3 py-2 bg-rose-500/20 text-rose-100 hover:bg-rose-500/40 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                                                                        >
                                                                            <XCircle size={13} /> Cancel Job
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleWithdrawProposal(latestProposalMsg!.id, latestProposalData)}
                                                                        className="px-3 py-2 bg-rose-500/20 text-rose-100 hover:bg-rose-500/40 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5"
                                                                    >
                                                                        <XCircle size={13} /> Withdraw Offer
                                                                    </button>
                                                                )
                                                            ) : (
                                                                isPrinter && (
                                                                    isFixedPriceJob ? (
                                                                        <button 
                                                                            onClick={() => handleSendJobProposal(activeChatData.offers.price)}
                                                                            disabled={sendingJobProposal}
                                                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                                                                        >
                                                                            {sendingJobProposal ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Accept & Print for {formatPrice(activeChatData.offers.price)}</>}
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                                                            <div className="relative flex-1 md:w-36">
                                                                                <input 
                                                                                    type="number" 
                                                                                    min="0.01"
                                                                                    step="0.01"
                                                                                    placeholder="Price" 
                                                                                    value={jobProposalPrice} 
                                                                                    onChange={e => setJobProposalPrice(e.target.value.replace(/-/g, ''))} 
                                                                                    onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-black text-white placeholder:text-blue-200/50 focus:outline-none focus:bg-white/20 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                                />
                                                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-300 uppercase tracking-widest pointer-events-none">{currency}</span>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => handleSendJobProposal()}
                                                                                disabled={!jobProposalPrice || sendingJobProposal}
                                                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                                                                            >
                                                                                {sendingJobProposal ? <Loader2 size={13} className="animate-spin" /> : <><Send size={13} /> Send Proposal</>}
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-black/30 rounded-xl p-2.5 border border-white/10 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                                                        {activeChatData.offers?.material && (
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300 mb-0.5 flex items-center gap-1"><Palette size={9} /> Material</span>
                                                                <span className="text-xs font-bold text-white">{activeChatData.offers.material}</span>
                                                            </div>
                                                        )}
                                                        {activeChatData.offers?.color && (
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300 mb-0.5 flex items-center gap-1"><Palette size={9} /> Color</span>
                                                                <span className="text-xs font-bold text-white flex items-center gap-2">
                                                                    <span className="w-2.5 h-2.5 rounded-full border border-white/30" style={{backgroundColor: (activeChatData.offers.color === '#0000ff' || activeChatData.offers.color === '#0000FF') ? '#3b82f6' : activeChatData.offers.color}} />
                                                                    {(activeChatData.offers.color === '#0000ff' || activeChatData.offers.color === '#0000FF') ? 'Ocean Blue' : activeChatData.offers.color}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {activeChatData.offers?.dimensions && (
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300 mb-0.5 flex items-center gap-1"><Ruler size={9} /> Dimensions</span>
                                                                <span className="text-xs font-bold text-white max-w-[200px] truncate">{activeChatData.offers.dimensions}</span>
                                                            </div>
                                                        )}
                                                        {activeChatData.offers?.weight && (
                                                             <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300 mb-0.5 flex items-center gap-1"><Package size={9} /> Est. Weight</span>
                                                                <span className="text-xs font-bold text-white">{activeChatData.offers.weight}</span>
                                                            </div>
                                                        )}
                                                         {activeChatData.offers?.custom_instructions && (
                                                             <div className="flex flex-col w-full md:flex-1 md:min-w-[200px] md:border-l md:border-white/10 md:pl-4 pt-1.5 md:pt-0 border-t border-white/10 md:border-t-0">
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-300 mb-0.5 flex items-center gap-1"><MessageSquare size={9} /> Technical Notes</span>
                                                                <p className="text-xs font-medium text-white/90 italic leading-tight">{activeChatData.offers.custom_instructions}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {selectedPreviewImage && (
                                <div
                                    className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
                                    onClick={() => setSelectedPreviewImage(null)}
                                >
                                    <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                        <img
                                            src={selectedPreviewImage}
                                            alt="Enlarged verification preview"
                                            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                                        />
                                        <button
                                            onClick={() => setSelectedPreviewImage(null)}
                                            className="absolute -top-3 -right-3 p-2.5 bg-slate-900/90 hover:bg-slate-800 text-white rounded-full transition-all shadow-lg border border-white/20"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {showDisputeModal && activeChatData && (
                                <div
                                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
                                    onClick={(e) => { if (e.target === e.currentTarget) setShowDisputeModal(false); }}
                                >
                                    <div
                                        className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full animate-in zoom-in-95 duration-200 relative border border-gray-100"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="flex justify-between items-center mb-6 sticky top-0 bg-white pt-1 pb-2 z-10 border-b border-gray-100">
                                            <div>
                                                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                                                    <ShieldAlert size={20} className="text-red-500 shrink-0" /> Open a Dispute
                                                </h3>
                                                <p className="text-xs text-gray-500 font-medium mt-0.5">Describe your problem.</p>
                                            </div>
                                            <button
                                                onClick={() => setShowDisputeModal(false)}
                                                className="text-gray-400 hover:text-gray-900 p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors shrink-0"
                                                title="Close modal"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                        <div className="space-y-5">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-wider">Type of Problem</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {PROBLEM_TYPES.filter(pt => activeChatData?.offers?.category === 'digital' ? pt.digital : !pt.digital || pt.value === 'other').map(pt => (
                                                        <button key={pt.value} onClick={() => setDisputeProblemType(pt.value)} className={`p-3 rounded-xl border-2 text-left transition-all ${disputeProblemType === pt.value ? 'border-red-400 bg-red-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                            <div className="text-base mb-0.5">{pt.icon}</div>
                                                            <div className="text-xs font-bold text-gray-700">{pt.label}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 tracking-wider">Describe your problem</label>
                                                <textarea value={disputeDescription} onChange={e => setDisputeDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-red-400 rounded-xl text-sm font-medium outline-none resize-none" placeholder="Explain what went wrong..." />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 tracking-wider">Contact Email</label>
                                                <input value={disputeEmail} onChange={e => setDisputeEmail(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-red-400 rounded-xl text-sm font-medium outline-none" />
                                            </div>
                                            {formError && (
                                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-1 text-center">
                                                    {formError}
                                                </div>
                                            )}
                                            <div className="flex gap-2 pt-1">
                                                <button 
                                                    onClick={handleDisputeSubmit} 
                                                    disabled={!disputeProblemType || !disputeDescription.trim() || !disputeEmail.trim() || disputeSubmitting} 
                                                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2 text-xs"
                                                >
                                                    {disputeSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><ShieldAlert size={16} /> Submit Dispute</>}
                                                </button>
                                                <button 
                                                    onClick={() => setShowDisputeModal(false)} 
                                                    className="px-4 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black uppercase tracking-widest text-xs transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {showProposalModal && activeChatData && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-md p-4">
                                    <div className="bg-white p-8 rounded-[40px] w-full max-w-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 transition-all border border-white/20">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-gray-900 font-black tracking-tight text-xl flex items-center gap-2"><Handshake className="text-blue-600" /> PROPOSE CHANGES</h3>
                                            <button onClick={() => setShowProposalModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={16} /></button>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-5 shadow-inner">
                                                {(() => {
                                                    const sd = editingProposalData || activeChatData.offers;
                                                    const isJob = activeChatData.offers?.category === 'job';
                                                    const isDigital = activeChatData.offers?.category === 'digital';
                                                    const sp = sd?.price !== undefined ? (currency !== 'EUR' && rates && rates[currency] ? sd.price * rates[currency] : sd.price) : 0;
                                                    const pDiff = Math.abs(parseFloat(proposalPrice || '0') - sp) > 0.01;
                                                    const qDiff = proposalQty !== (sd?.quantity?.toString() || '1');

                                                    // Comprehensive change detection
                                                    const hasMatChanges = (activeChatData.offers?.category === 'physical' || isJob) && (
                                                        swappedLayers.some(sl => {
                                                            const currentChoiceName = sl.swapped_filament_id
                                                                ? sellerFilaments.find(f => f.id === sl.swapped_filament_id)?.color_name
                                                                : (sl.showCustom ? sl.custom_color_name : '');
                                                            return currentChoiceName && currentChoiceName !== sl.original_color_name;
                                                        }) ||
                                                        (proposalMaterial !== (sd?.material || '')) ||
                                                        (proposalColor !== (sd?.color || ''))
                                                    );

                                                    const originalDims = parseDimensionsAdvanced(sd?.dimensions || activeChatData.offers?.dimensions || '');
                                                    const hasDimChanges = !isJob && !isDigital && (proposalScale !== 100 || proposalDims.some((dim, idx) => {
                                                        const orig = originalDims[idx]?.originalValue || dim.originalValue;
                                                        return Math.abs(parseFloat(dim.currentValueStr || '0') - orig) > 0.01;
                                                    }));

                                                    const hasProposalChanges = isDigital ? pDiff : (pDiff || qDiff || hasMatChanges || hasDimChanges);

                                                    return (
                                                        <div className={`grid ${isJob || isDigital ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <label className={`text-[9px] font-black uppercase ${pDiff ? 'text-blue-600' : 'text-gray-400'}`}>Price</label>
                                                                    {activeChatData.offers && (
                                                                        <span className="text-[8px] font-bold text-blue-500/60 tracking-tight">Original: {formatPrice(activeChatData.offers.price)}</span>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <input
                                                                        type="number"
                                                                        min="0.01"
                                                                        step="0.01"
                                                                        value={proposalPrice}
                                                                        onChange={e => setProposalPrice(e.target.value.replace(/-/g, ''))}
                                                                        onKeyDown={e => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                                                                        className={`w-full pl-10 pr-4 py-3 bg-white border ${pDiff ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-200'} rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 shadow-sm`}
                                                                    />
                                                                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-[10px] uppercase tracking-widest ${pDiff ? 'text-blue-600' : 'text-gray-400'}`}>{currency}</span>
                                                                </div>
                                                            </div>
                                                            {!isJob && !isDigital && (
                                                                <div>
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <label className={`text-[9px] font-black uppercase ${qDiff ? 'text-blue-600' : 'text-gray-400'}`}>Quantity</label>
                                                                        <span className="text-[8px] font-bold text-blue-500/60 tracking-tight">Original: 1</span>
                                                                    </div>
                                                                    <input type="number" min="1" value={proposalQty} onChange={e => setProposalQty(e.target.value)} className={`w-full px-4 py-3 bg-white border ${qDiff ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-200'} rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 shadow-sm`} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* FILAMENT SELECTION / MULTI-COLOR SWAPPING */}
                                            {(activeChatData.offers?.category === 'physical' || activeChatData.offers?.category === 'job') && (
                                                <div className="space-y-4">
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Material & Color</span>

                                                    {swappedLayers.length > 0 ? (
                                                        /* MULTI-COLOR LAYER EDITOR */
                                                        <div className="space-y-4">
                                                            {swappedLayers.map((layer, lIdx) => {
                                                                // determine which filament is currently active for this layer
                                                                const activeFilament = layer.swapped_filament_id 
                                                                    ? sellerFilaments.find(f => f.id === layer.swapped_filament_id)
                                                                    : null;
                                                                const activeName = layer.showCustom 
                                                                    ? (layer.custom_color_name || 'Custom') 
                                                                    : (activeFilament?.color_name || layer.original_color_name);
                                                                const activeHex = layer.showCustom 
                                                                    ? layer.custom_color_hex 
                                                                    : (activeFilament?.color_hex || layer.original_color_hex);
                                                                const activeMaterial = activeFilament?.plastic_type || '';

                                                                return (
                                                                    <div key={lIdx} className="bg-gray-50 border border-gray-100 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-1 transition-all">
                                                                        {/* Layer header with current selection + grams */}
                                                                        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                                                                            <div className="w-8 h-8 rounded-full border-2 border-white shadow-md ring-2 ring-gray-200" style={{ backgroundColor: activeHex }} />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Color {lIdx + 1}</div>
                                                                                <div className="text-sm font-black text-gray-900 truncate">{activeName}</div>
                                                                                {activeMaterial && <div className="text-[9px] font-bold text-gray-400 uppercase">{activeMaterial}</div>}
                                                                            </div>
                                                                            <div className="text-right flex-shrink-0">
                                                                                <div className="text-lg font-black text-blue-600 leading-none">{layer.grams}g</div>
                                                                                <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">weight</div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Filament choice grid */}
                                                                        <div className="px-5 py-4">
                                                                            <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-3">Choose color</div>
                                                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                                                {loadingFilaments ? (
                                                                                    <div className="col-span-full py-4 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                                                                                ) : (
                                                                                    <>
                                                                                        {sellerFilaments.map(fil => {
                                                                                            const nameMatch = fil.color_name?.toLowerCase() === layer.original_color_name?.toLowerCase();
                                                                                            const hexMatch = fil.color_hex?.toLowerCase() === layer.original_color_hex?.toLowerCase();
                                                                                            const isSelected = layer.swapped_filament_id === fil.id || (!layer.swapped_filament_id && !layer.showCustom && (nameMatch || hexMatch));
                                                                                            return (
                                                                                                <button
                                                                                                    key={fil.id}
                                                                                                    onClick={() => {
                                                                                                        const updated = [...swappedLayers];
                                                                                                        updated[lIdx].swapped_filament_id = fil.id;
                                                                                                        updated[lIdx].showCustom = false;
                                                                                                        updated[lIdx].custom_color_name = '';
                                                                                                        setSwappedLayers(updated);
                                                                                                    }}
                                                                                                    title={`${fil.color_name} (${fil.plastic_type})`}
                                                                                                    className={`p-2 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 group relative ${isSelected ? 'border-blue-600 bg-blue-50/80 shadow-lg shadow-blue-100' : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'}`}
                                                                                                >
                                                                                                    {isSelected && (
                                                                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center z-10">
                                                                                                            <Check size={8} className="text-white" />
                                                                                                        </div>
                                                                                                    )}
                                                                                                    <div className={`w-7 h-7 rounded-full border-2 shadow-sm transition-transform group-hover:scale-110 ${isSelected ? 'border-blue-400 scale-110' : 'border-white'}`} style={{ backgroundColor: fil.color_hex }} />
                                                                                                    <div className={`text-[8px] font-black leading-tight truncate w-full text-center ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>{fil.color_name}</div>
                                                                                                    <div className="text-[7px] font-bold text-gray-400 uppercase">{fil.plastic_type}</div>
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const updated = [...swappedLayers];
                                                                                                updated[lIdx].swapped_filament_id = null;
                                                                                                updated[lIdx].showCustom = true;
                                                                                                setSwappedLayers(updated);
                                                                                            }}
                                                                                            className={`p-2 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center gap-1 ${layer.showCustom ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
                                                                                        >
                                                                                            <Palette size={14} className="text-gray-400" />
                                                                                            <div className="text-[8px] font-black text-gray-500 uppercase">Custom</div>
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>

                                                                            {layer.showCustom && (
                                                                                <div className="flex gap-2 mt-3 animate-in fade-in">
                                                                                    <div className="relative shrink-0" title="Click to pick color">
                                                                                        <div className="w-9 h-9 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center transition-transform hover:scale-105 overflow-hidden cursor-pointer" style={{ backgroundColor: layer.custom_color_hex }}>
                                                                                            <input
                                                                                                type="color"
                                                                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                                                                value={layer.custom_color_hex}
                                                                                                onChange={e => {
                                                                                                    const updated = [...swappedLayers];
                                                                                                    updated[lIdx].custom_color_hex = e.target.value;
                                                                                                    setSwappedLayers(updated);
                                                                                                }}
                                                                                                title="Click to pick color"
                                                                                            />
                                                                                            {layer.custom_color_hex === '#cccccc' && <Palette size={14} className="text-gray-400 pointer-events-none" />}
                                                                                        </div>
                                                                                    </div>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Color name or HEX..."
                                                                                        value={layer.custom_color_name}
                                                                                        onChange={e => {
                                                                                            const updated = [...swappedLayers];
                                                                                            updated[lIdx].custom_color_name = e.target.value;
                                                                                            setSwappedLayers(updated);
                                                                                        }}
                                                                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 transition-colors"
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        /* STANDARD VIEW — seller filament picker */
                                                        <div className="space-y-3">
                                                            <div className="text-[8px] font-black uppercase text-gray-400 tracking-widest">
                                                                Choose filament <span className="text-blue-400 normal-case">· Original: {activeChatData.offers?.color} ({activeChatData.offers?.material})</span>
                                                            </div>

                                                            {loadingFilaments ? (
                                                                <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
                                                            ) : (
                                                                <>
                                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                        {sellerFilaments.map(fil => {
                                                                            const isSelected = selectedFilamentId === fil.id ||
                                                                                (!selectedFilamentId && !showCustomFilamentInput && (
                                                                                    fil.color_name?.toLowerCase() === (activeChatData.offers?.color || '').toLowerCase() ||
                                                                                    fil.color_hex?.toLowerCase() === (activeChatData.offers?.color || '').toLowerCase()
                                                                                ));
                                                                            return (
                                                                                <button
                                                                                    key={fil.id}
                                                                                    onClick={() => {
                                                                                        setSelectedFilamentId(fil.id);
                                                                                        setProposalColor(fil.color_name);
                                                                                        setProposalColorHex(fil.color_hex || '#cccccc');
                                                                                        setProposalMaterial(fil.plastic_type || '');
                                                                                        setShowCustomFilamentInput(false);
                                                                                    }}
                                                                                    title={`${fil.color_name} · ${fil.plastic_type}`}
                                                                                    className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border-2 transition-all text-left group ${isSelected ? 'border-blue-600 bg-blue-50/80 shadow-md shadow-blue-100' : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm'}`}
                                                                                >
                                                                                    {isSelected && (
                                                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center z-10">
                                                                                            <Check size={8} className="text-white" />
                                                                                        </div>
                                                                                    )}
                                                                                    <div className={`w-8 h-8 rounded-full border-2 flex-shrink-0 shadow-sm transition-transform ${isSelected ? 'border-blue-400 scale-110' : 'border-white group-hover:scale-105'}`} style={{ backgroundColor: fil.color_hex }} />
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <div className={`text-[10px] font-black leading-tight truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{fil.color_name}</div>
                                                                                        <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{fil.plastic_type}</div>
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                        {/* Custom filament button */}
                                                                        <button
                                                                            onClick={() => { setSelectedFilamentId(null); setShowCustomFilamentInput(v => !v); }}
                                                                            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 border-dashed transition-all ${showCustomFilamentInput ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-400'}`}
                                                                        >
                                                                            <Palette size={16} className={showCustomFilamentInput ? 'text-blue-600' : 'text-gray-400'} />
                                                                            <div className={`text-[9px] font-black uppercase ${showCustomFilamentInput ? 'text-blue-600' : 'text-gray-500'}`}>Custom</div>
                                                                        </button>
                                                                    </div>

                                                                    {/* Custom filament input */}
                                                                    {(showCustomFilamentInput || sellerFilaments.length === 0) && (
                                                                        <div className="space-y-3 pt-1 animate-in fade-in slide-in-from-top-1">
                                                                            <ColorPickerInput
                                                                                value={proposalColorHex}
                                                                                onChange={(hex) => {
                                                                                    setProposalColorHex(hex);
                                                                                    // Auto-set color name from sellerFilaments if match found
                                                                                    const match = sellerFilaments.find(f => (f.color_hex || '').toUpperCase() === hex.toUpperCase());
                                                                                    if (match && !proposalColor) setProposalColor(match.color_name);
                                                                                }}
                                                                                label="Color"
                                                                                sellerColors={sellerFilaments.map(f => ({ id: String(f.id), color_name: f.color_name, color_hex: f.color_hex || '#cccccc', plastic_type: f.plastic_type }))}
                                                                            />
                                                                            <div className="space-y-2 pt-1">
                                                                                <div className="flex items-center justify-between">
                                                                                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Suggested Materials</span>
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {POPULAR_MATERIALS.map(mat => (
                                                                                        <button
                                                                                            key={mat.name}
                                                                                            type="button"
                                                                                            onClick={() => setProposalMaterial(mat.name)}
                                                                                            className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                                                                                                proposalMaterial.trim().toLowerCase() === mat.name.toLowerCase()
                                                                                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/30'
                                                                                                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-xs'
                                                                                            }`}
                                                                                        >
                                                                                            {mat.name}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>

                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Material type (PLA, PETG, ABS, PA, Resin...)"
                                                                                    value={proposalMaterial}
                                                                                    onChange={e => setProposalMaterial(e.target.value)}
                                                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 text-gray-900 transition-all"
                                                                                />

                                                                                {/* Material Info Preview Card */}
                                                                                {(() => {
                                                                                    const matInfo = getMaterialInfo(proposalMaterial);
                                                                                    if (!matInfo) return null;
                                                                                    return (
                                                                                        <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-[10px] text-blue-900 space-y-0.5 animate-in fade-in">
                                                                                            <span className="font-black text-blue-950 uppercase tracking-wider flex items-center gap-1">
                                                                                                💡 {matInfo.fullName}
                                                                                            </span>
                                                                                            <p className="text-slate-600 leading-normal">{matInfo.desc}</p>
                                                                                        </div>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {activeChatData.offers?.category !== 'job' && activeChatData.offers?.category !== 'digital' && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dimensions</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-black text-gray-500">Scale %:</span>
                                                            <input type="number" step="1" value={proposalScale} onChange={e => handleScaleChange(e.target.value)} className="w-14 px-1 py-1 border rounded text-xs font-bold text-center" />
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                                        {(() => {
                                                            const sd = editingProposalData || activeChatData.offers;
                                                            const originalDims = parseDimensionsAdvanced(sd?.dimensions || activeChatData.offers?.dimensions || '');
                                                            return proposalDims.map((dim, idx) => {
                                                                const orig = originalDims[idx]?.originalValue || dim.originalValue;
                                                                const isDimChanged = Math.abs(parseFloat(dim.currentValueStr || '0') - orig) > 0.01;
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-2">
                                                                        <span className={`w-20 text-[10px] font-black uppercase ${isDimChanged ? 'text-blue-600' : 'text-gray-500'} truncate`}>{dim.name}</span>
                                                                        <input type="number" step="0.1" value={dim.currentValueStr} onChange={e => handleDimChange(idx, e.target.value)} className={`flex-1 px-3 py-2 border ${isDimChanged ? 'border-blue-400 ring-2 ring-blue-50 bg-white' : 'border-gray-200'} rounded-lg text-sm font-bold transition-all`} />
                                                                        <span className="text-[10px] font-bold text-gray-400">{dim.unit}</span>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                            <button onClick={sendProposal} disabled={!proposalPrice || !hasProposalChanges} className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none transition-all ${currentUser?.id === activeChatData.seller_id ? 'bg-amber-500' : 'bg-blue-600'}`}>
                                                <Handshake size={15} /> {currentUser?.id === activeChatData.seller_id ? 'Send Offer' : 'Send Proposal'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ═══ VINTED-STYLE ORDER PROGRESS BAR ═══ */}
                            {activeChatData?.orderItem && activeChatData?.offers?.category !== 'digital' && (() => {
                                const oi = activeChatData.orderItem;
                                const status = oi?.status || 'pending';
                                const isSeller_ = currentUser?.id === activeChatData.seller_id;
                                const shipDeadline = oi?.ship_by_deadline ? new Date(oi.ship_by_deadline) : null;
                                const now = new Date();
                                const daysLeft = shipDeadline ? Math.ceil((shipDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                                const deadlinePassed = shipDeadline && shipDeadline < now;

                                const steps = [
                                    { key: 'pending', label: 'Ordered', icon: '🛒' },
                                    { key: 'shipped', label: 'Shipped', icon: '📦' },
                                    { key: 'in_transit', label: 'In Transit', icon: '🚚' },
                                    { key: 'delivered', label: 'Delivered', icon: '✅' },
                                    { key: 'completed', label: 'Complete', icon: '🏁' },
                                ];
                                const statusOrder = ['pending', 'shipped', 'in_transit', 'delivered', 'completed'];
                                const currentIdx = statusOrder.indexOf(status) >= 0 ? statusOrder.indexOf(status) : (status === 'disputed' ? 3 : 0);

                                return (
                                    <div className="px-3 py-1.5 border-b border-slate-800 bg-[#0f172a] text-white shrink-0">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            {/* Inline Compact Steps */}
                                            <div className="flex items-center gap-1.5 sm:gap-3 flex-1 overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden">
                                                {steps.map((step, i) => {
                                                    const isDone = i < currentIdx;
                                                    const isCurrent = i === currentIdx;
                                                    return (
                                                        <div key={step.key} className="flex items-center gap-1 shrink-0">
                                                            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${
                                                                isDone ? 'bg-emerald-500 text-white shadow-xs' :
                                                                isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-400/40 animate-pulse' :
                                                                'bg-slate-800 text-slate-500'
                                                            }`}>
                                                                {isDone ? '✓' : step.icon}
                                                            </div>
                                                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                                                                isDone ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-slate-500'
                                                            }`}>{step.label}</span>
                                                            {i < steps.length - 1 && (
                                                                <span className={`text-[10px] ${isDone ? 'text-emerald-500' : 'text-slate-700'}`}>›</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Compact Deadline Pill */}
                                            {isSeller_ && status === 'pending' && shipDeadline && (
                                                <div className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${deadlinePassed ? 'bg-red-500/20 text-red-300 border border-red-500/30' : daysLeft !== null && daysLeft <= 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                                    <Clock size={10} className="shrink-0" />
                                                    <span>{deadlinePassed ? 'Deadline Passed' : `Ship in ${daysLeft}d (${shipDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`}</span>
                                                    {!oi.extension_requested_at && !deadlinePassed && (
                                                        <button
                                                            className="ml-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
                                                            onClick={() => {
                                                                fetch('/api/order/status', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ action: 'request_extension', itemId: oi.id, chatId: activeChatId, userId: currentUser?.id })
                                                                }).then(r => r.json()).then(d => { if (d.success) loadMessages(activeChatId as string); else alert(d.error); });
                                                            }}
                                                        >+Ext</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 sm:px-6 sm:py-6 space-y-3.5">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
                                ) : (() => {
                                    const chronList = messages.map(m => ({ ...m, _type: 'message', _time: new Date(m.created_at).getTime() }));

                                    if (activeChatData?.orderItem) {
                                        let cardTime = Date.now() + 1000000; // default active actions to bottom

                                        if (activeChatData?.orderItem?.status === 'completed' || activeChatData?.orderItem?.status === 'disputed') {
                                            const sysMsgType = activeChatData.orderItem.status === 'completed' ? 'status_completed' : 'status_disputed';
                                            const sysMsg = messages.slice().reverse().find(m => m.message_type === sysMsgType);
                                            if (sysMsg) {
                                                cardTime = new Date(sysMsg.created_at).getTime() + 1;
                                            } else {
                                                // fallback if no system message is found
                                                cardTime = messages.length > 0 ? new Date(messages[messages.length - 1].created_at).getTime() : Date.now();
                                            }
                                        }

                                        chronList.push({
                                            _type: 'action_card',
                                            _time: cardTime,
                                            id: 'action-card-entry',
                                            content: '',
                                            sender_id: '',
                                            created_at: '',
                                        });
                                    }
                                    
                                    // Push messages to the bottom
                                    chronList.unshift({
                                        _type: 'spacer',
                                        _time: 0,
                                        id: 'spacer',
                                        content: '',
                                        sender_id: '',
                                        created_at: '',
                                    });

                                    chronList.sort((a, b) => a._time - b._time);

                                    if (chronList.length === 0 && activeChatId !== 'draft') {
                                        return <div className="text-center py-10 text-gray-400 font-medium text-sm">Empty chat. Send a message to start!</div>;
                                    }

                                    return chronList.map((msg, idx) => {
                                        if (msg._type === 'spacer') {
                                            return <div key={`spacer-${idx}`} className="flex-1 min-h-[20px]" />;
                                        }

                                        if (msg._type === 'action_card') {
                                            return <div key={`ac-${idx}`}>{renderActionCard(activeChatData?.orderItem, activeChatData)}</div>;
                                        }

                                        const isMe = msg.sender_id === currentUser?.id;
                                        if (msg.message_type && msg.message_type !== 'user') return renderSystemMessage(msg, idx);

                                         if (msg.content.startsWith('[PROPOSAL]')) {
                                            const pData = JSON.parse(msg.content.substring(10));
                                            const isSeller = currentUser?.id === activeChatData?.seller_id;
                                            const isBuyer = currentUser?.id === activeChatData?.buyer_id;
                                            const isPaidOrder = !!activeChatData?.order_id;
                                            // For job offers: the PAYER is the job poster (seller_id in chat), NOT the printer (buyer_id)
                                            const isJobOfferCard = activeChatData?.offers?.category === 'job';
                                            const jobPosterIdCard = activeChatData?.offers?.user_id || activeChatData?.seller_id;
                                            const isPayer = isJobOfferCard
                                                ? String(currentUser?.id) === String(jobPosterIdCard)
                                                : isBuyer;
                                            return (
                                                <div key={msg.id || idx} className="flex flex-col w-full my-8 px-2 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                                <div className={`w-[280px] sm:w-[320px] rounded-[24px] overflow-hidden border shadow-2xl transition-all hover:scale-[1.02] ${
                                                                    pData.status === 'accepted' ? (isPaidOrder ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-amber-500/30 bg-amber-950/20') :
                                                                    (pData.status === 'rejected' || pData.status === 'cancelled') ? 'border-rose-500/30 bg-rose-900/10' :
                                                                    pData.status === 'counter_proposed' ? 'border-fuchsia-500/30 bg-fuchsia-900/10' :
                                                                    'border-white/10 bg-[#0f172a]/80 backdrop-blur-xl'
                                                                }`}>
                                                                    {/* HEADER DECORATION */}
                                                                    <div className={`h-1.5 w-full ${
                                                                        pData.status === 'accepted' ? (isPaidOrder ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-yellow-500') :
                                                                        (pData.status === 'rejected' || pData.status === 'cancelled') ? 'bg-rose-500' :
                                                                        pData.status === 'counter_proposed' ? 'bg-gradient-to-r from-violet-500 to-purple-600' :
                                                                        pData.status === 'seller_proposed' ? 'bg-gradient-to-r from-amber-400 to-yellow-600' : 
                                                                        'bg-gradient-to-r from-blue-500 to-indigo-600'
                                                                    }`} />

                                                        <div className="p-5 space-y-5">
                                                            {/* TITLEBAR */}
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md border ${pData.status === 'counter_proposed'
                                                                            ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                                                                            : pData.status === 'seller_proposed'
                                                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                                                                : 'bg-blue-500/10 border-blue-500/30 text-blue-500'
                                                                            }`}>
                                                                            {(() => {
                                                                                const isJobChat = activeChatData?.offers?.category === 'job';
                                                                                if (pData.status === 'counter_proposed') return 'Counter Offer';
                                                                                if (pData.status === 'seller_proposed') return isJobChat ? 'Your Terms' : 'Seller Offer';
                                                                                return isJobChat ? 'Printer Bid' : 'Customer Request';
                                                                            })()}
                                                                        </span>
                                                                        <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[100px]">
                                                                            {msg.sender_id === currentUser?.id ? 'YOU' : (msg.sender_id === activeChatData?.seller_id ? activeChatData?.otherUser?.full_name : (activeChatData?.offers?.category === 'job' ? 'Printer' : 'Customer'))}
                                                                        </span>
                                                                    </div>
                                                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                                                                        pData.status === 'accepted' ? 'text-emerald-400' :
                                                                        (pData.status === 'rejected' || pData.status === 'cancelled') ? 'text-rose-400' :
                                                                        pData.status === 'counter_proposed' ? 'text-violet-400' :
                                                                        pData.status === 'seller_proposed' ? 'text-amber-400' : 'text-blue-400'
                                                                    }`}>
                                                                        {pData.status === 'counter_proposed' ? 'Counter Offer' :
                                                                            pData.status === 'accepted' ? (isPaidOrder ? 'Order Paid & Confirmed' : 'Offer Accepted') :
                                                                            pData.status === 'rejected' ? 'Offer Declined' :
                                                                            pData.status === 'cancelled' ? 'Offer Withdrawn' :
                                                                            pData.status === 'seller_proposed' ? 'Seller Offer' : 'Customer Request'}
                                                                    </span>
                                                                    <h4 className="text-white text-xs font-bold mt-0.5">
                                                                        {pData.status === 'counter_proposed' ? 'Revised Offer' :
                                                                            pData.status === 'accepted' ? (isPaidOrder ? 'Paid Order' : 'Accepted') :
                                                                            pData.status === 'cancelled' ? 'Cancelled Request' :
                                                                            pData.status === 'seller_proposed' ? 'Special Deal' : 'Custom Request'}
                                                                    </h4>
                                                                </div>
                                                                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                                    pData.status === 'accepted' ? (isPaidOrder ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-emerald-500 text-emerald-400 bg-emerald-500/10') :
                                                                    (pData.status === 'rejected' || pData.status === 'cancelled') ? 'border-rose-500 text-rose-400 bg-rose-900/20' :
                                                                    pData.status === 'countered' ? 'border-slate-500 text-slate-400 bg-slate-500/10' :
                                                                    pData.status === 'counter_proposed' ? 'border-violet-500 text-violet-400 bg-violet-500/10' :
                                                                    'border-blue-500/50 text-blue-400 bg-blue-500/10'
                                                                }`}>
                                                                    {pData.status === 'accepted' ? (isPaidOrder ? 'PAID' : 'ACCEPTED') :
                                                                     pData.status === 'countered' ? 'Offer Replaced' : 
                                                                     pData.status === 'cancelled' ? 'Cancelled' : 
                                                                     pData.status.replace('_', ' ')}
                                                                </span>
                                                            </div>

                                                            {(() => {
                                                                const orig = activeChatData?.offers;
                                                                const isPriceChanged = orig && Math.abs(parseFloat(pData.price) - orig.price) > 0.01;
                                                                const isQtyChanged = pData.quantity !== 1;
                                                                const isDimChanged = pData.dimensionScale !== 100 || (pData.dimensions && pData.dimensions !== orig?.dimensions);
                                                                const isMatChanged = orig && (pData.material !== orig.material || pData.color !== orig.color);

                                                                return (
                                                                    <div className="space-y-4">
                                                                        {/* PRICE TAG */}
                                                                        <div className="relative">
                                                                            <div className="flex items-baseline gap-1.5">
                                                                                <span className={`text-3xl font-black tracking-tight ${isPriceChanged ? 'text-amber-400' : 'text-white'}`}>
                                                                                    {formatPrice(Math.abs(pData.price))}
                                                                                </span>
                                                                                <div className={`flex items-center self-center px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${isQtyChanged ? 'ring-1 ring-amber-400/50' : ''}`}>
                                                                                    <span className={`text-[10px] font-bold ${isQtyChanged ? 'text-amber-400' : 'text-slate-400'}`}>×{pData.quantity}</span>
                                                                                </div>
                                                                            </div>
                                                                            {isPriceChanged && (
                                                                                <div className="absolute -top-3 -right-1 text-[8px] font-bold text-amber-400/70 uppercase">Special Price</div>
                                                                            )}
                                                                        </div>

                                                                        <div className="grid gap-2">
                                                                            {/* SPECS SECTION */}
                                                                            {pData.dimensions && (
                                                                                <div className={`group flex flex-col p-2.5 rounded-xl border transition-all ${isDimChanged ? 'bg-amber-400/5 border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.05)]' : 'bg-white/5 border-white/10'}`}>
                                                                                    <div className="flex items-center justify-between mb-1">
                                                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                                                            <Ruler size={10} /> Specifications
                                                                                        </span>
                                                                                        {isDimChanged && <span className="text-[8px] font-black text-amber-500/80">MODIFIED {pData.dimensionScale}%</span>}
                                                                                    </div>
                                                                                    <div className={`text-[10px] leading-tight font-bold ${isDimChanged ? 'text-amber-200/90' : 'text-slate-300'}`}>
                                                                                        {pData.dimensions?.replace(/,\s*/g, ' • ')}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* MATERIAL/COLORS SECTION */}
                                                                            {pData.swappedLayers ? (
                                                                                <div className="space-y-1.5 mt-1">
                                                                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest pl-1">Exquisite Selection</span>
                                                                                    <div className="grid gap-1.5">
                                                                                        {pData.swappedLayers.map((sl: any, slIdx: number) => (
                                                                                            <div key={slIdx} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${sl.isModified ? 'bg-amber-400/10 border-amber-400/30 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                                                                                                <div className="flex items-center gap-1.5">
                                                                                                    <div className="w-3 h-3 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: sl.from_hex || '#ccc' }} />
                                                                                                    <span className={`text-[10px] font-bold ${sl.isModified ? 'text-slate-400' : 'text-slate-200'}`}>{sl.from}</span>
                                                                                                </div>

                                                                                                {sl.isModified && (
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <ArrowLeft size={10} className="rotate-180 text-amber-500" />
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <div className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-lg shrink-0" style={{ backgroundColor: sl.to_hex || '#ccc' }} />
                                                                                                            <span className="text-[10px] font-black text-amber-100 truncate max-w-[100px]">
                                                                                                                {sl.to}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className={`flex flex-col p-2.5 rounded-xl border space-y-1.5 ${isMatChanged ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white/5 border-white/10'}`}>
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                                                                            <Palette size={10} /> {pData.swappedLayers ? 'Multi-Layer' : 'Material Choice'}
                                                                                        </span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className={`w-3.5 h-3.5 rounded-full border shadow-inner shrink-0 ${isMatChanged ? 'border-amber-400' : 'border-white/20'}`} style={{ backgroundColor: pData.colorHex || activeChatData?.offers?.color || '#ccc' }} />
                                                                                            <span className={`text-[10px] font-black ${isMatChanged ? 'text-amber-100' : 'text-slate-200'}`}>
                                                                                                {pData.material || activeChatData?.offers?.material || 'Resin'} • {pData.color || activeChatData?.offers?.color || 'Original'}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Material Explanation for Recipient */}
                                                                                    {(() => {
                                                                                        const matName = pData.material || activeChatData?.offers?.material;
                                                                                        const matInfo = getMaterialInfo(matName);
                                                                                        if (!matInfo) return null;
                                                                                        return (
                                                                                            <div className="mt-1.5 p-2 bg-slate-900/90 border border-slate-700/60 rounded-lg text-[9px] leading-normal text-slate-300">
                                                                                                <span className="font-bold text-blue-300 uppercase tracking-wider block mb-0.5">💡 {matInfo.fullName}</span>
                                                                                                <p className="text-slate-400 font-medium">{matInfo.desc}</p>
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            )}

                                                                            {/* TOTAL ORDER COST SUMMARY */}
                                                                            {(() => {
                                                                                const unitPriceNum = Math.abs(parseFloat(pData.price) || 0);
                                                                                const qtyNum = Math.max(1, parseInt(pData.quantity) || 1);
                                                                                const totalOrderCost = unitPriceNum * qtyNum;

                                                                                return (
                                                                                    <div className="mt-3 p-3 bg-slate-900/90 border border-amber-500/30 rounded-xl flex items-center justify-between shadow-inner">
                                                                                        <div>
                                                                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 block">Total Order Cost</span>
                                                                                            <span className="text-[10px] text-slate-400 font-bold">
                                                                                                {formatPrice(unitPriceNum)} × {qtyNum} {qtyNum === 1 ? 'unit' : 'units'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="text-right">
                                                                                            <div className="text-sm font-black text-amber-400 leading-tight">
                                                                                                {formatPrice(totalOrderCost)} <span className="text-[10px] font-bold text-slate-400">+ shipping</span>
                                                                                            </div>
                                                                                            <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                                                                                                Calculated at checkout
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* ACTIONS */}
                                                            {(() => {
                                                                const inCart = cartItems.some(i => i.id === pData.custom_offer_id);

                                                                if (inCart && isPayer && !isPaidOrder) {
                                                                    return (
                                                                        <div className="space-y-2 mt-2">
                                                                            <button
                                                                                onClick={() => router.push('/cart')}
                                                                                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-gray-950 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                                                                            >
                                                                                <CreditCard size={14} /> Proceed to Checkout ({formatPrice(Math.abs(pData.price))})
                                                                            </button>
                                                                            <p className="text-[9px] font-bold text-amber-400 text-center uppercase tracking-wider">
                                                                                🛒 In your Cart — Complete payment to confirm order
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }

                                                                const isOfferWithdrawable = isMe && (pData.status === 'pending' || pData.status === 'seller_proposed' || pData.status === 'counter_proposed');

                                                                if (isOfferWithdrawable) {
                                                                    return (
                                                                        <div className="pt-2 space-y-2">
                                                                            <button
                                                                                onClick={() => handleWithdrawProposal(msg.id, pData)}
                                                                                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                                            >
                                                                                <X size={12} /> Withdraw (Cancel Offer)
                                                                            </button>
                                                                            <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-wider">
                                                                                ⏳ Waiting for response...
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }

                                                                const isProposalFromOtherParty = !isMe && (pData.status === 'seller_proposed' || pData.status === 'counter_proposed' || pData.status === 'pending');

                                                                if (isProposalFromOtherParty) {
                                                                    return (
                                                                        <div className="space-y-2 pt-2">
                                                                            <button
                                                                                disabled={acceptingProposalId === msg.id}
                                                                                onClick={() => {
                                                                                    if (isPayer) {
                                                                                        handleBuyerAcceptsSellerProposal(msg.id, pData);
                                                                                    } else {
                                                                                        handleAcceptProposal(msg.id, pData);
                                                                                    }
                                                                                }}
                                                                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-xl shadow-emerald-900/40 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                                            >
                                                                                {acceptingProposalId === msg.id ? (
                                                                                    <>
                                                                                        <Loader2 size={14} className="animate-spin" />
                                                                                        Accepting...
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <CreditCard size={14} className="inline mr-1 -mt-0.5" />
                                                                                        {isPayer ? 'Accept Terms & Proceed to Payment' : 'Accept Counter Offer'}
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <button
                                                                                    onClick={() => openProposalModal(pData, msg.id)}
                                                                                    className="py-2.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                                                >
                                                                                    <RefreshCcw size={12} /> Counter
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleRejectProposal(msg.id, pData)}
                                                                                    className="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                                                >
                                                                                    <X size={12} /> Reject
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (pData.status === 'accepted' && isPayer) {
                                                                    if (isPaidOrder) {
                                                                        return (
                                                                            <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-2">
                                                                                <Check size={14} /> Paid & Confirmed
                                                                            </div>
                                                                        );
                                                                    }
                                                                    const inCart = cartItems.some(i => i.id === pData.custom_offer_id);
                                                                    return (
                                                                        <div className="space-y-2 mt-2">
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                                <button
                                                                                    onClick={() => handleBuyCustomOffer(pData)}
                                                                                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.1em] shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-1.5"
                                                                                >
                                                                                    <Zap size={13} className="fill-white" /> Buy Now ({formatPrice(pData.price)})
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleAddToCartCustomOffer(pData)}
                                                                                    className={`w-full py-3.5 font-black rounded-xl text-[10px] uppercase tracking-[0.1em] transition-all transform active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                                                                                        inCart
                                                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                                                                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                                                                    }`}
                                                                                >
                                                                                    <ShoppingBag size={13} /> {inCart ? 'In Cart' : 'Add to Cart'}
                                                                                </button>
                                                                            </div>
                                                                            <p className="text-[9px] font-bold text-emerald-400 text-center uppercase tracking-wider">
                                                                                ✅ Offer Accepted! Choose Buy Now or Add to Cart.
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }

                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <span className={`text-[9px] text-slate-500 font-bold mt-2 tracking-wide ${isMe ? 'mr-2' : 'ml-2'}`}>
                                                        {new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} • Secured Transaction
                                                    </span>
                                                </div>
                                            );
                                        }

                                        if (msg.message_type === 'admin_resolution') {
                                            let resData: any = null;
                                            try { resData = JSON.parse(msg.content); } catch (_) {}
                                            const isRefund = resData?.action === 'refund_buyer';

                                            return (
                                                <div key={msg.id || idx} className="my-6 p-4 bg-gradient-to-r from-blue-950/90 via-purple-950/90 to-blue-950/90 border-2 border-blue-500/40 rounded-2xl text-center space-y-2 shadow-2xl animate-in zoom-in-95">
                                                    <div className="flex items-center justify-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
                                                        <ShieldAlert size={18} className="text-blue-400" /> OFFICIAL PLATFORM ADMINISTRATION RESOLUTION
                                                    </div>
                                                    {resData ? (
                                                        <p className="text-sm font-black text-white">
                                                            {isRefund
                                                                ? `Decision: Full Item Refund of €${Number(resData.amountEUR).toFixed(2)} has been credited to Buyer (return shipping fees excluded).`
                                                                : `Decision: Dispute resolved in favor of Seller. Funds of €${Number(resData.amountEUR).toFixed(2)} have been released to Seller.`
                                                            }
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-200 font-bold">{msg.content}</p>
                                                    )}
                                                    {resData?.notes && (
                                                        <p className="text-xs text-slate-300 italic font-medium">"{resData.notes}"</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-400 font-mono pt-1">{new Date(msg.created_at).toLocaleString()}</p>
                                                </div>
                                            );
                                        }

                                        if (msg.message_type === 'status_shipped' || (msg.content && msg.content.includes('shipped the package'))) {
                                            const isSellerUser = activeChatData?.seller_id === currentUser?.id || activeChatData?.orderItem?.seller_id === currentUser?.id;
                                            const packageId = activeChatData?.orderItem?.furgonetka_package_id;
                                            return (
                                                <div key={msg.id || idx} className="flex flex-col items-center my-4 w-full">
                                                    <div className="max-w-[85%] bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 text-slate-800 rounded-2xl p-4 shadow-sm text-center space-y-2">
                                                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
                                                            <Truck size={16} /> Shipment Confirmed
                                                        </div>
                                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{msg.content}</p>
                                                        {isSellerUser && packageId && (
                                                            <button
                                                                onClick={() => handleDownloadLabel(packageId)}
                                                                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                                                            >
                                                                <Printer size={14} /> Download PDF Shipping Label
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        if (msg.message_type === 'admin_chat') {
                                            return (
                                                <div key={msg.id || idx} className="flex flex-col items-center my-4">
                                                    <div className="max-w-[85%] bg-gradient-to-br from-blue-900/90 to-purple-900/90 border border-blue-400/40 text-white rounded-2xl p-4 shadow-xl space-y-2">
                                                        <div className="flex items-center gap-2 border-b border-blue-500/30 pb-2">
                                                            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                                                <Shield size={11} /> OFFICIAL ADMIN SUPPORT
                                                            </span>
                                                            <span className="text-[10px] text-blue-200 font-mono ml-auto">{new Date(msg.created_at).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-xs font-medium leading-relaxed text-slate-100 whitespace-pre-wrap">{msg.content}</p>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // ── IMAGE MESSAGE rendering ──
                                        if (msg.content?.startsWith('[IMAGE]')) {
                                            // Parse URLs and optional caption
                                            const rawContent = msg.content.substring(7); // strip [IMAGE]
                                            let imgUrls: string[] = [];
                                            let caption = '';
                                            const captionIdx = rawContent.indexOf('[CAPTION]');
                                            try {
                                                if (captionIdx !== -1) {
                                                    imgUrls = JSON.parse(rawContent.substring(0, captionIdx));
                                                    caption = rawContent.substring(captionIdx + 9);
                                                } else {
                                                    imgUrls = JSON.parse(rawContent);
                                                }
                                            } catch {
                                                imgUrls = [rawContent];
                                            }
                                            return (
                                                <div key={msg.id || idx} className={`flex flex-col w-full max-w-full min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className={`overflow-hidden rounded-2xl border shadow-md max-w-[85%] sm:max-w-[75%] min-w-0 ${
                                                        isMe
                                                            ? 'bg-blue-600 border-blue-500/40 text-white rounded-tr-sm'
                                                            : 'bg-white border-gray-200/80 text-gray-800 rounded-tl-sm'
                                                    }`}>
                                                        <div className="p-1.5 flex flex-wrap gap-1.5">
                                                            {imgUrls.map((url: string, i: number) => (
                                                                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-black/10 hover:opacity-95 transition-opacity">
                                                                    <img
                                                                        src={url}
                                                                        alt={`Shared photo ${i + 1}`}
                                                                        className="w-auto h-auto max-w-[220px] max-h-[220px] sm:max-w-[260px] sm:max-h-[260px] object-cover rounded-xl cursor-pointer"
                                                                    />
                                                                </a>
                                                            ))}
                                                        </div>
                                                        {caption && (
                                                            <div className={`px-3.5 py-2 text-xs font-medium border-t break-all [word-break:break-all] [overflow-wrap:anywhere] ${
                                                                isMe
                                                                    ? 'border-blue-500/30 bg-blue-700/40 text-white'
                                                                    : 'border-gray-100 bg-gray-50/90 text-gray-800'
                                                            }`}>
                                                                <p className="text-sm font-medium leading-relaxed break-all [word-break:break-all] [overflow-wrap:anywhere]">
                                                                    {(() => {
                                                                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                                        const parts = caption.split(urlRegex);
                                                                        return parts.map((part: string, index: number) => {
                                                                            if (part.match(urlRegex)) {
                                                                                const displayUrl = part.length > 55 ? part.substring(0, 50) + '...' : part;
                                                                                return (
                                                                                    <a
                                                                                        key={index}
                                                                                        href={part}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        title={part}
                                                                                        className={`underline break-all font-bold ${isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                                                                    >
                                                                                        {displayUrl}
                                                                                    </a>
                                                                                );
                                                                            }
                                                                            return part;
                                                                        });
                                                                    })()}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-bold mt-1">
                                                        {new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id || idx} className={`flex flex-col w-full max-w-full min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 break-all [word-break:break-all] [overflow-wrap:anywhere] ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                                    <p className="text-sm font-medium leading-relaxed break-all [word-break:break-all] [overflow-wrap:anywhere]">
                                                        {(() => {
                                                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                            const parts = (msg.content || '').split(urlRegex);
                                                            return parts.map((part: string, index: number) => {
                                                                if (part.match(urlRegex)) {
                                                                    const displayUrl = part.length > 55 ? part.substring(0, 50) + '...' : part;
                                                                    return (
                                                                        <a
                                                                            key={index}
                                                                            href={part}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title={part}
                                                                            className={`underline break-all font-bold ${isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                                                        >
                                                                            {displayUrl}
                                                                        </a>
                                                                    );
                                                                }
                                                                return part;
                                                            });
                                                        })()}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-bold mt-1">
                                                    {new Date(msg.created_at).toLocaleString([], { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* ── IMAGE PREVIEW PANEL ─────────────────────── */}
                            {pendingImages.length > 0 && (
                                <div className="bg-white border-t border-indigo-100 px-4 pt-4 pb-2 shrink-0 animate-in slide-in-from-bottom-2 duration-200">
                                    <div className="max-w-4xl mx-auto">
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
                                                <ImageIcon size={12} /> {pendingImages.length}/3 photo{pendingImages.length > 1 ? 's' : ''} ready to send
                                            </span>
                                            <button
                                                type="button"
                                                onClick={cancelPendingImages}
                                                className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                                                title="Discard"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Thumbnails */}
                                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                                            {pendingPreviews.map((url, i) => (
                                                <div key={i} className="relative shrink-0 group">
                                                    <img
                                                        src={url}
                                                        alt={`Preview ${i + 1}`}
                                                        className="w-20 h-20 object-cover rounded-xl border-2 border-indigo-100 shadow-sm"
                                                    />
                                                    {/* Remove single image */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            URL.revokeObjectURL(pendingPreviews[i]);
                                                            const newFiles = pendingImages.filter((_, fi) => fi !== i);
                                                            const newPrev = pendingPreviews.filter((_, pi) => pi !== i);
                                                            if (newFiles.length === 0) { cancelPendingImages(); return; }
                                                            setPendingImages(newFiles);
                                                            setPendingPreviews(newPrev);
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            ))}
                                            {pendingImages.length < 3 && (
                                                <button
                                                    type="button"
                                                    onClick={() => chatImageInputRef.current?.click()}
                                                    className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-indigo-200 flex flex-col items-center justify-center gap-1 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                                                    title="Add photo (max 3)"
                                                >
                                                    <Camera size={16} />
                                                    <span className="text-[9px] font-black uppercase tracking-wider">+ Add ({pendingImages.length}/3)</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Caption input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={pendingCaption}
                                                onChange={e => setPendingCaption(e.target.value)}
                                                onPaste={handlePaste}
                                                placeholder="Add a caption (optional)..."
                                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendImage(pendingImages, pendingCaption); } }}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleSendImage(pendingImages, pendingCaption)}
                                                disabled={chatImageUploading || spamCooldownSec > 0}
                                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md active:scale-95"
                                            >
                                                {chatImageUploading
                                                    ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                                                    : <><Send size={14} /> Send</>
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="px-2 py-2.5 sm:px-4 sm:py-4 bg-white border-t border-gray-100 shrink-0 w-full overflow-x-hidden">
                                {spamCooldownSec > 0 && (
                                    <div className="max-w-4xl mx-auto mb-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl px-4 py-2.5 text-xs font-black flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-amber-500 animate-spin shrink-0" />
                                            <span><strong>Slow down a bit!</strong> Please wait <strong>{spamCooldownSec}s</strong> before sending another message.</span>
                                        </div>
                                    </div>
                                )}
                                <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto space-y-1.5 w-full">
                                    {/* Negotiate button pill on mobile if no order */}
                                    {activeChatData && !activeChatData.orderItem && (
                                        <button
                                            type="button"
                                            onClick={() => openProposalModal()}
                                            className="w-full py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200/80 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-xs active:scale-98"
                                        >
                                            <Handshake size={14} className="text-blue-600" /> Negotiate Price / Custom Offer
                                        </button>
                                    )}

                                    <div className="flex items-end gap-1 sm:gap-1.5 w-full">
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            onPaste={handlePaste}
                                            placeholder="Type a message..."
                                            className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 min-h-[44px] sm:min-h-[46px] max-h-[140px] focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-[16px] sm:text-sm font-medium"
                                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                        />
                                        <input
                                            ref={chatImageInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleImagePicked(e.target.files); }}
                                        />
                                        {/* Camera / image upload button */}
                                        <button
                                            type="button"
                                            onClick={() => chatImageInputRef.current?.click()}
                                            disabled={chatImageUploading || spamCooldownSec > 0}
                                            title="Send photo or paste image"
                                            className="bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-600 p-2 sm:p-2.5 rounded-xl transition-all h-[44px] w-[38px] sm:w-[46px] sm:h-[46px] flex items-center justify-center shrink-0 border border-gray-200 hover:border-indigo-300 disabled:opacity-50"
                                        >
                                            {chatImageUploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                                        </button>

                                        {/* 3-dot menu for Options / Report / Cancel */}
                                        {(() => {
                                            const isBuyer = currentUser?.id === activeChatData?.buyer_id;
                                            const isSeller = currentUser?.id === activeChatData?.seller_id;
                                            const canCancel = (isBuyer && activeChatData?.orderItem?.status === 'pending')
                                                || (isSeller && ['pending', 'shipped'].includes(activeChatData?.orderItem?.status));
                                            const hasOrder = !!activeChatData?.orderItem;

                                            return (
                                                <div className="relative shrink-0" style={{ zIndex: 50 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowChatMenu(v => !v)}
                                                        className="h-[44px] w-[38px] sm:w-[46px] sm:h-[46px] flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500 transition shadow-xs p-2 sm:p-2.5"
                                                        title="More options"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {showChatMenu && (
                                                        <>
                                                            <div className="fixed inset-0" style={{ zIndex: 40 }} onClick={() => setShowChatMenu(false)} />
                                                            <div className="absolute right-0 bottom-14 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 min-w-[210px]">
                                                                {!hasOrder && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setShowChatMenu(false); openProposalModal(); }}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-blue-600 hover:bg-blue-50 transition text-xs font-black uppercase tracking-wider border-b border-gray-100"
                                                                    >
                                                                        <Handshake size={15} /> Negotiate / Custom Offer
                                                                    </button>
                                                                )}
                                                                {canCancel && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setShowChatMenu(false); openCancelModal(isSeller ? 'seller' : 'buyer'); }}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 transition text-xs font-black uppercase tracking-wider border-b border-gray-100"
                                                                    >
                                                                        <Ban size={15} /> Cancel Order
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setShowChatMenu(false); setReportSubject(''); setReportDescription(''); setReportError(''); setReportSuccess(false); setShowReportModal(true); }}
                                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-amber-600 hover:bg-amber-50 transition text-xs font-black uppercase tracking-wider"
                                                                >
                                                                    <Flag size={15} /> Report a Problem
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* Send button */}
                                        <button type="submit" disabled={(!newMessage.trim() && pendingImages.length === 0) || spamCooldownSec > 0} className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-2.5 rounded-xl transition-all disabled:opacity-50 h-[44px] w-[40px] sm:w-[46px] sm:h-[46px] flex items-center justify-center shrink-0 shadow-md active:scale-95">
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>

        {/* ─── CANCEL ORDER MODAL ─────────────────────────────────── */}
        {showCancelModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCancelModal(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full border border-gray-100" onClick={e => e.stopPropagation()}>

                    {/* Header */}
                    <div className={`px-6 py-5 flex items-center gap-3 ${cancelInitiator === 'seller' ? 'bg-gradient-to-r from-red-500 to-rose-600' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`}>
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Ban size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-base uppercase tracking-tight">
                                {cancelInitiator === 'seller' ? 'Cancel This Order' : 'Request Cancellation'}
                            </h2>
                            <p className="text-white/70 text-[11px] font-bold">
                                {cancelInitiator === 'seller' ? 'This action cannot be undone' : 'The seller must agree to proceed'}
                            </p>
                        </div>
                        <button onClick={() => setShowCancelModal(false)} className="ml-auto text-white/70 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* SELLER CANCEL: warning about full refund */}
                        {cancelInitiator === 'seller' && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                                <p className="text-sm font-black text-red-700 mb-1">⚠️ Important before you cancel:</p>
                                <ul className="text-xs text-red-600 font-medium space-y-1 list-disc list-inside">
                                    <li>The buyer will receive a <strong>full refund</strong> to their Printis Wallet.</li>
                                    <li>Your seller reliability score may be affected.</li>
                                    <li>Repeated cancellations may lead to account review.</li>
                                </ul>
                            </div>
                        )}

                        {/* BUYER CANCEL: shipping cost warning */}
                        {cancelInitiator === 'buyer' && (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                                <p className="text-sm font-black text-amber-800">📦 Shipping has already been paid.</p>
                                <div className="space-y-1.5 text-xs font-bold">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Item total:</span>
                                        <span>{formatPrice(cancelItemTotalEur)}</span>
                                    </div>
                                    {cancelShippingEur > 0 && (
                                        <div className="flex justify-between text-red-500">
                                            <span>Shipping (non-refundable):</span>
                                            <span>-{formatPrice(cancelShippingEur)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-emerald-700 font-black border-t border-amber-200 pt-1.5">
                                        <span>You would receive back:</span>
                                        <span>{formatPrice(Math.max(0, cancelItemTotalEur - cancelShippingEur))}</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-amber-600 font-bold">The seller must accept your request. If they decline, a dispute will be opened.</p>
                            </div>
                        )}

                        {/* Reason input */}
                        <div>
                            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                                Reason for cancellation <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                placeholder={cancelInitiator === 'seller'
                                    ? 'e.g. Material out of stock, printer malfunction, unable to fulfil order...'
                                    : 'e.g. Changed my mind, ordered by mistake, found another seller...'}
                                rows={3}
                                className="w-full p-3 border-2 border-gray-100 bg-gray-50 rounded-2xl focus:border-red-400 focus:bg-white outline-none transition-all text-sm font-medium text-gray-800 placeholder:text-gray-300 resize-none"
                            />
                            {cancelReason.trim().length > 0 && cancelReason.trim().length < 5 && (
                                <p className="text-[11px] text-red-500 font-bold mt-1">Please provide a more detailed reason (min. 5 characters)</p>
                            )}
                        </div>

                        {cancelError && (
                            <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl text-red-600 text-xs font-bold leading-relaxed">
                                ⚠️ {cancelError}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex-1 py-3 border-2 border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
                            >
                                Keep Order
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={cancelSubmitting}
                                className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    cancelInitiator === 'seller'
                                        ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/20'
                                        : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
                                }`}
                            >
                                {cancelSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                                {cancelInitiator === 'seller' ? 'Cancel & Refund' : 'Send Request'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ─── REPORT A PROBLEM MODAL ──────────────────────────── */}
        {showReportModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowReportModal(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full border border-gray-100" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="px-6 py-5 flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Flag size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-base uppercase tracking-tight">Report a Problem</h2>
                            <p className="text-white/70 text-[11px] font-bold">Our team will review your report</p>
                        </div>
                        <button onClick={() => setShowReportModal(false)} className="ml-auto w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all">
                            <X size={16} className="text-white" />
                        </button>
                    </div>

                    <div className="px-6 py-6 space-y-5">
                        {reportSuccess ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={32} className="text-green-600" />
                                </div>
                                <p className="font-black text-gray-900 text-sm uppercase tracking-wide">Report Submitted!</p>
                                <p className="text-xs text-gray-500 font-medium">Our admin team will review it shortly.</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                                        Subject <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={reportSubject}
                                        onChange={e => setReportSubject(e.target.value)}
                                        placeholder="e.g. Seller not responding, Damaged item..."
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                                        maxLength={100}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={reportDescription}
                                        onChange={e => setReportDescription(e.target.value)}
                                        placeholder="Describe the problem in detail..."
                                        rows={4}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none"
                                        maxLength={1000}
                                    />
                                    <p className="text-[10px] text-gray-400 font-bold mt-1 text-right">{reportDescription.length}/1000</p>
                                </div>

                                {reportError && (
                                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                        <AlertTriangle size={14} className="text-red-500 shrink-0" />
                                        <p className="text-xs font-bold text-red-600">{reportError}</p>
                                    </div>
                                )}

                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <p className="text-[10px] font-bold text-amber-700">
                                        ℹ️ Chat and order information will be automatically attached to your report.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setShowReportModal(false)}
                                        className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReport}
                                        disabled={reportSubmitting}
                                        className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {reportSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                                        Submit Report
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <MessagesInner />
        </Suspense>
    );
}
