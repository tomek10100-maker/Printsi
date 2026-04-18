'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, MessageSquare, Loader2, Send, Package, User, Handshake, Check, X,
    Truck, PackageCheck, CheckCircle2, AlertTriangle, ShieldAlert, Info, Mail, ExternalLink, Ruler, Palette, CreditCard, RefreshCcw, Download, Printer, XCircle
} from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    // Tracking code state
    const [trackingCodeInput, setTrackingCodeInput] = useState('');
    const [swappedLayers, setSwappedLayers] = useState<any[]>([]);

    // Job fulfillment banner state
    const [showJobProposalBanner, setShowJobProposalBanner] = useState(false);
    const [jobProposalPrice, setJobProposalPrice] = useState('');
    const [sendingJobProposal, setSendingJobProposal] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

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
        offers ( id, title, image_urls, category, price, material, color_name, color, dimensions, weight, custom_instructions, color_variants )
      `)
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error(error);
            setLoadingChats(false);
            return;
        }

        const enrichChats = await Promise.all((fetchedChats || []).map(async (chat) => {
            const otherUserId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;

            // Check if there are messages. Filter out empty chats to clean up database/clutter.
            const { data: mData, error: mError } = await supabase
                .from('messages')
                .select('id')
                .eq('chat_id', chat.id)
                .limit(1);

            const isEmpty = !mError && (!mData || mData.length === 0);

            if (isEmpty) {
                // User requirement: delete chats that have NO user content and NO order attached
                if (!chat.order_id) {
                    await supabase.from('chats').delete().eq('id', chat.id);
                    return null;
                }
            }

            const { data: otherProfile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', otherUserId)
                .single();

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
                    .select('id, status, quantity, price_at_purchase, tracking_code, offer_id, offers(parent_offer_id)')
                    .eq('order_id', chat.order_id)
                    .eq('seller_id', chat.seller_id);

                if (rawItems && rawItems.length > 0) {
                    const match = rawItems.find((item: any) => {
                        const parentId = Array.isArray(item.offers) ? item.offers[0]?.parent_offer_id : item.offers?.parent_offer_id;
                        return item.offer_id === chat.offer_id || parentId === chat.offer_id;
                    });
                    if (match) {
                        orderItemInfo = {
                            id: match.id,
                            status: match.status || 'pending',
                            quantity: match.quantity,
                            price_at_purchase: match.price_at_purchase,
                            tracking_code: match.tracking_code
                        };
                    }
                }
            }

            return { ...chat, otherUser: otherProfile || { full_name: 'Unknown User' }, unreadCount: unreadCount || 0, orderItem: orderItemInfo };
        }));

        const filteredChats = enrichChats.filter(c => c !== null) as any[];

        // HANDLE DRAFT CHAT (INITIATED BY EITHER BUYER OR SELLER)
        if ((paramSellerId || paramBuyerId) && paramOfferId && userId) {
            const otherUserId = paramSellerId || paramBuyerId;
            const existing = filteredChats.find(c =>
                ((c.seller_id === paramSellerId && c.buyer_id === userId) || (c.buyer_id === paramBuyerId && c.seller_id === userId)) &&
                c.offer_id === paramOfferId
            );

            if (existing) {
                setActiveChatId(existing.id);
            } else {
                const { data: otherProf } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', otherUserId).single();
                const { data: offerData } = await supabase.from('offers').select('id, title, image_urls, category, price, material, color, color_name, dimensions, weight, custom_instructions, color_variants').eq('id', paramOfferId).single();

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

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId || !currentUser) return;

        const content = newMessage.trim();
        setNewMessage('');
        let currentActiveId = activeChatId;

        if (currentActiveId === 'draft') {
            const draft = chats.find(c => c.id === 'draft');
            if (!draft) return;

            const { data: newChat, error: chatErr } = await supabase
                .from('chats')
                .insert({
                    buyer_id: currentUser.id,
                    seller_id: draft.seller_id,
                    offer_id: draft.offer_id
                })
                .select('id')
                .single();

            if (chatErr || !newChat) {
                console.error("Error creating chat:", chatErr);
                alert("Failed to start chat session.");
                return;
            }

            currentActiveId = newChat.id;
            setActiveChatId(currentActiveId);
            router.replace(`/profile/messages?chat=${currentActiveId}`);
        }

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

    const handleStatusUpdate = async (newStatus: string) => {
        if (!activeChatData || !activeChatData.orderItem || !currentUser) return;

        if (newStatus === 'disputed') {
            setDisputeEmail(currentUser.email || '');
            setShowDisputeModal(true);
            return;
        }

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

    const parseDimensionsAdvanced = (dimStr: string): ParsedDim[] => {
        let parsed: ParsedDim[] = [];
        if (dimStr) {
            parsed = dimStr.split(',').map(part => {
                const match = part.match(/^(.*?):\s*(\d+(?:\.\d+)?)\s*(.*)$/);
                if (match) {
                    const name = match[1].trim();
                    const val = parseFloat(match[2]);
                    const unit = match[3].trim();
                    const lowerName = name.toLowerCase();
                    const isBase = lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('depth') || lowerName.includes('length') ||
                        lowerName.includes('szerokość') || lowerName.includes('wysokość') || lowerName.includes('głębokość') || lowerName.includes('długość') ||
                        lowerName.includes('szerokosc') || lowerName.includes('wysokosc') || lowerName.includes('glebokosc') || lowerName.includes('dlugosc') ||
                        lowerName === 'w' || lowerName === 'h' || lowerName === 'l' || lowerName === 'd';
                    return { name, originalValue: val, currentValueStr: val.toString(), unit, isBase };
                }
                return { name: part.trim(), originalValue: 0, currentValueStr: '', unit: '', isBase: false };
            }).filter(d => d.originalValue > 0);
        }

        const hasBase = parsed.some(d => d.isBase);
        if (!hasBase) {
            parsed = [
                { name: 'Width', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
                { name: 'Height', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
                { name: 'Depth', originalValue: 100, currentValueStr: '100', unit: 'mm', isBase: true },
                ...parsed
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
        if (filRes.status === 'fulfilled') {
            try { const d = await filRes.value.json(); setSellerFilaments(d.filaments || []); }
            catch { setSellerFilaments([]); }
        } else { setSellerFilaments([]); }

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

        let currentPriceNum = parseFloat(proposalPrice);
        let finalPrice = currentPriceNum;
        if (currency !== 'EUR' && rates && rates[currency]) {
            finalPrice = finalPrice / rates[currency];
        }

        const priceChanged = Math.abs(finalPrice - (orig.price || 0)) > 0.01;
        const qtyChanged = parseInt(proposalQty) !== (orig.quantity || 1);
        const matChanged = proposalMaterial !== (orig.material || '');
        const colChanged = proposalColor !== (orig.color || '');
        const scaleChanged = Math.abs(proposalScale - (orig.dimensionScale || 100)) > 0.1;
        const swapsChanged = swappedLayers.some(sl => {
            const currentChoiceName = sl.swapped_filament_id
                ? sellerFilaments.find(f => f.id === sl.swapped_filament_id)?.color_name
                : (sl.showCustom ? sl.custom_color_name : sl.original_color_name);
            return currentChoiceName !== sl.original_color_name;
        });

        return priceChanged || qtyChanged || matChanged || colChanged || scaleChanged || swapsChanged;
    })();

    const sendProposal = async () => {
        if (!activeChatId || !currentUser || !activeChatData) return;

        let currentActiveId = activeChatId;

        // If it's a draft, create the chat before sending proposal
        if (currentActiveId === 'draft') {
            const { data: newChat, error: chatErr } = await supabase
                .from('chats')
                .insert({
                    buyer_id: currentUser.id,
                    seller_id: activeChatData.seller_id,
                    offer_id: activeChatData.offer_id
                })
                .select('id')
                .single();

            if (chatErr || !newChat) {
                // Fallback: Może czat już istnieje (np. konflikt constraintu) więc próbujemy go pobrać
                const { data: existingChat } = await supabase.from('chats')
                    .select('id')
                    .eq('buyer_id', currentUser.id)
                    .eq('seller_id', activeChatData.seller_id)
                    .eq('offer_id', activeChatData.offer_id)
                    .single();

                if (existingChat) {
                    currentActiveId = existingChat.id;
                } else {
                    console.error("Error creating chat for proposal:", chatErr);
                    alert(`Failed to create chat session: ${chatErr?.message || JSON.stringify(chatErr)}`);
                    return;
                }
            } else {
                currentActiveId = newChat.id;
            }
            setActiveChatId(currentActiveId);
            router.replace(`/profile/messages?chat=${currentActiveId}`);
        }

        let finalPrice = parseFloat(proposalPrice);
        if (currency !== 'EUR' && rates && rates[currency]) {
            finalPrice = finalPrice / rates[currency];
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
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
            message_type: 'user',
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
        });

        // Trigger Negotiation Email
        const emailType = payload.status === 'counter_proposed' ? 'counter_offer' : (payload.status === 'seller_proposed' ? 'seller_offer' : 'new_offer');
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
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

        loadMessages(activeChatId);
        loadChats(currentUser.id);
    };

    // ── JOB FULFILLMENT: Quick Price Proposal ──
    const handleSendJobProposal = async () => {
        if (!currentUser || !activeChatData || !jobProposalPrice) return;
        setSendingJobProposal(true);

        let finalPrice = parseFloat(jobProposalPrice);
        if (currency !== 'EUR' && rates && rates[currency]) {
            finalPrice = finalPrice / rates[currency];
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
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
            message_type: 'user',
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
        });

        // System message explaining the proposal
        await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: `🖨️ The printer has reviewed your 3D file and submitted a price proposal of ${formatPrice(finalPrice)}. Accept the proposal above to proceed with payment and printing.`,
            message_type: 'system',
        });

        // Notify the job poster
        try {
            await supabase.from('notifications').insert({
                user_id: activeChatData.seller_id,
                title: '💰 New price proposal for your print job!',
                message: `A printer has proposed ${formatPrice(finalPrice)} to print "${activeChatData.offers?.title}". Open chat to review and accept.`,
                type: 'job',
                sender_id: currentUser.id,
                offer_id: activeChatData.offer_id,
                is_read: false,
            });
        } catch (e) {
            console.error('Notification failed:', e);
        }

        // Trigger email
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
                senderId: currentUser.id,
                type: 'new_offer',
                price: formatPrice(finalPrice),
                productTitle: activeChatData.offers?.title || 'Print Job'
            }),
        }).catch(err => console.error('Negotiation email error:', err));

        setShowJobProposalBanner(false);
        setJobProposalPrice('');
        setSendingJobProposal(false);
        loadMessages(activeChatId!);
        loadChats(currentUser.id);
    };

    const handleDeclineJobChat = async () => {
        if (!currentUser || !activeChatData) return;

        // Send a system message in the chat
        await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: `❌ The printer reviewed the 3D file but cannot fulfill this print job. The job remains open for other printers.`,
            message_type: 'system',
        });

        // Notify the job poster
        try {
            await supabase.from('notifications').insert({
                user_id: activeChatData.seller_id,
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

        setShowJobProposalBanner(false);
        router.push('/gallery');
    };

    const handleAcceptProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData || !activeChatData.offers || activeChatData.seller_id !== currentUser?.id) {
            console.error("Accept failed: Missing chat data or unauthorized", { activeChatData, sellerId: activeChatData?.seller_id, userId: currentUser?.id });
            return;
        }

        if (!parsedData || !parsedData.price || isNaN(Number(parsedData.price))) {
            alert("Error: Proposal lacks a valid price!");
            return;
        }

        const isJobOffer = activeChatData.offers?.category === 'job';

        try {
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

            // TRY 1: Full payload
            const { data: newOffer, error: err1 } = await supabase.from('offers').insert({
                ...basePayload,
                ...(colorVariants ? { color_variants: colorVariants } : {})
            }).select().single();

            let offer = newOffer;
            lastError = err1;

            if (lastError && lastError.message?.includes('color_variants')) {
                // TRY 2: Without color_variants
                const { data: newOffer2, error: err2 } = await supabase.from('offers').insert(basePayload).select().single();
                offer = newOffer2;
                lastError = err2;
            }

            if (lastError) {
                console.error("Offer Creation Error Details:", lastError);
                throw lastError;
            }

            if (!offer) {
                throw new Error("Offer successfully inserted but not returned.");
            }

            parsedData.status = 'accepted';
            parsedData.custom_offer_id = offer.id;

            const { error: msgError } = await supabase.from('messages').update({
                content: `[PROPOSAL]${JSON.stringify(parsedData)}`
            }).eq('id', msgId);

            if (msgError) throw msgError;

            // Trigger Accepted Email
            fetch('/api/order/negotiation-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId: activeChatId,
                    senderId: currentUser.id,
                    type: 'accept',
                    productTitle: activeChatData?.offers?.title || 'Custom Item'
                }),
            }).catch(() => { });

            // For job offers: the job poster (seller in chat) pays, so redirect them to cart
            if (isJobOffer) {
                // Post a system message explaining the job flow
                await supabase.from('messages').insert({
                    chat_id: activeChatId,
                    sender_id: currentUser.id,
                    content: `✅ Print job accepted! The printer has agreed to fulfill this request for ${formatPrice(parsedData.price)}. Please complete payment to proceed — your 3D file will be sent to the printer once confirmed.`,
                    message_type: 'system',
                });

                loadMessages(activeChatId as string);
                handleBuyCustomOffer(parsedData);
            } else {
                loadMessages(activeChatId as string);
            }
        } catch (e: any) {
            console.error("Comprehensive Accept Failure:", e);
            alert(`Failed to accept: ${e.message || 'Unknown database error'}`);
        }
    };

    const handleBuyerAcceptsSellerProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData || activeChatData.buyer_id !== currentUser.id) return;

        parsedData.status = 'accepted';
        await supabase.from('messages').update({
            content: `[PROPOSAL]${JSON.stringify(parsedData)}`
        }).eq('id', msgId);

        // Trigger Accepted Email
        fetch('/api/order/negotiation-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
                senderId: currentUser.id,
                type: 'accept',
                productTitle: activeChatData.offers?.title || 'Custom Item'
            }),
        }).catch(() => { });

        loadMessages(activeChatId as string);
        handleBuyCustomOffer(parsedData);
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
        if (!activeChatData || !parsedData.custom_offer_id) return;

        const isJobOffer = activeChatData.offers?.category === 'job';

        addItem({
            id: parsedData.custom_offer_id,
            title: isJobOffer ? `Print Job: ${activeChatData.offers?.title}` : `Custom: ${activeChatData.offers?.title}`,
            price: parsedData.price,
            image_url: activeChatData.offers?.image_urls?.[0] || null,
            seller_id: isJobOffer ? activeChatData.buyer_id : activeChatData.seller_id,
            stock: parsedData.quantity,
            is_custom: true,
            category: isJobOffer ? 'job' : (activeChatData.offers?.category || 'physical')
        }, parsedData.quantity || 1);

        router.push('/cart');
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
            status_shipped: {
                bg: 'bg-gradient-to-r from-blue-50 to-indigo-50/50',
                border: 'border-blue-200',
                icon: <Truck size={16} />,
                iconColor: 'text-blue-600',
                label: 'Shipped',
                accent: 'from-blue-500 to-indigo-500',
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
                label: 'Completed',
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
        };

        const style = typeStyles[messageType] || typeStyles.system;
        let disputeData: any = null;
        if (messageType === 'dispute_opened') {
            try { disputeData = JSON.parse(msg.content); } catch { }
        }

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
                    <div className="px-4 py-3">
                        {disputeData ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">Problem:</span>
                                    <span className="text-sm font-bold text-slate-800">{disputeData.problemType}</span>
                                </div>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">{disputeData.description}</p>
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
        const isSeller = String(currentUser.id) === String(chatData?.seller_id);
        const isBuyer = String(currentUser.id) === String(chatData?.buyer_id);
        const isDigital = chatData?.offers?.category === 'digital';
        const isJob = chatData?.offers?.category === 'job';

        // For job offers: printer = buyer_id, job poster = seller_id
        // So for jobs, the BUYER (printer) ships, and the SELLER (job poster) waits
        const showShipCard = isJob ? (status === 'pending' && isBuyer) : (status === 'pending' && isSeller);
        const showWaitCard = isJob ? (status === 'pending' && isSeller) : (status === 'pending' && isBuyer);

        if (showShipCard) {
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
                                    ? "You've received the 3D file via email. Print the item, pack it securely, and ship it to the customer."
                                    : isDigital
                                        ? "Once you've sent the files to the buyer's email, mark it as delivered below."
                                        : "Pack the order securely and hand it over to the courier."}
                            </p>
                            {!isDigital && (
                                <div className="bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-xl p-3 mb-4 flex items-start gap-2.5 text-left text-[11px] font-bold text-gray-700">
                                    <div className="bg-white p-1 rounded-md shadow-sm border border-[#FFCC00]/50 shrink-0">
                                        <Mail size={14} className="text-[#D40511]" />
                                    </div>
                                    <p className="leading-snug">
                                        <span className="text-[#D40511] font-black uppercase tracking-wider block mb-0.5 text-[9px]">Important</span>
                                        A DHL shipping label will be sent to your email shortly. Please print and attach it to the package.
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={() => handleStatusUpdate('shipped')}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                            >
                                {isDigital ? <Check size={14} className="inline mr-2 -mt-0.5" /> : <Truck size={14} className="inline mr-2 -mt-0.5" />}
                                {isDigital ? 'Mark as Sent to Email' : 'Mark as Shipped via DHL'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (showWaitCard) {
            return (
                <div className="flex justify-center my-4 px-4 w-full">
                    <div className="w-full max-w-md bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-center">
                        <p className="text-xs font-bold text-amber-700">
                            {isJob ? '🖨️ The printer has received your 3D file and is working on it. Waiting for shipment...'
                                : isDigital ? '⏳ Waiting for the seller to send files to your email...' : '⏳ Waiting for the seller to ship the package...'}
                        </p>
                    </div>
                </div>
            );
        }

        // For shipped status with jobs: buyer (printer) waits, seller (job poster) confirms
        const showConfirmDelivery = isJob ? (status === 'shipped' && isSeller) : (status === 'shipped' && isBuyer);
        const showShippedWait = isJob ? (status === 'shipped' && isBuyer) : (status === 'shipped' && isSeller);

        if (showConfirmDelivery) {
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-white border-2 border-dashed border-emerald-200 rounded-2xl p-5 text-center shadow-sm">
                            <div className="w-10 h-10 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                                {isDigital ? <Mail size={18} className="text-emerald-600" /> : <PackageCheck size={18} className="text-emerald-600" />}
                            </div>
                            <p className="text-sm font-bold text-gray-800 mb-1">
                                {isJob ? 'Your printed item is on its way!' : isDigital ? 'Files delivered!' : 'Package on its way!'}
                            </p>
                            <p className="text-xs text-gray-500 font-medium mb-4">
                                {isJob
                                    ? "The printer has shipped your item via DHL. Have you received it? Confirm delivery below."
                                    : isDigital
                                        ? "The seller reported that files were sent to your email. Do you accept the delivery?"
                                        : "The seller has shipped your order via DHL. Have you received the package? Confirm delivery below."}
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => handleStatusUpdate('completed')}
                                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    <CheckCircle2 size={14} className="inline mr-2 -mt-0.5" /> {isDigital ? 'Accept Files' : 'I Received It'}
                                </button>
                                <button
                                    onClick={() => handleStatusUpdate('disputed')}
                                    className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                                >
                                    <AlertTriangle size={14} className="inline mr-2 -mt-0.5" /> Problem
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (showShippedWait) {
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className="w-full max-w-md bg-blue-50/80 border border-blue-100 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-blue-700">
                                {isJob ? '📦 Item shipped! Waiting for the customer to confirm delivery...'
                                    : isDigital ? '📧 Files sent! Waiting for the buyer to accept them...' : '📦 Package sent! Waiting for the buyer to confirm delivery...'}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        if (status === 'completed' || status === 'disputed') {
            return (
                <div className="flex flex-col gap-2 my-4">
                    <div className="flex justify-center px-4 w-full">
                        <div className={`w-full max-w-md rounded-2xl p-4 text-center ${status === 'completed' ? 'bg-green-50/80 border border-green-100' : 'bg-red-50/80 border border-red-100'
                            }`}>
                            <p className={`text-xs font-black uppercase tracking-widest ${status === 'completed' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {status === 'completed' ? '✅ Transaction Finalized' : '⚠️ Dispute Open — Funds on hold'}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/profile" className="p-2 bg-gray-50 text-gray-500 rounded-full hover:bg-gray-100 hover:text-gray-900 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <MessageSquare className="text-blue-600" /> Messages
                    </h1>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden h-[calc(100vh-73px)]">
                <div className="w-full md:w-1/3 max-w-sm bg-white border-r border-gray-100 flex flex-col overflow-y-auto">
                    {loadingChats ? (
                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
                    ) : chats.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <MessageSquare className="mx-auto mb-2 opacity-50" size={32} />
                            <p className="text-sm font-bold">No messages yet</p>
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <button
                                key={chat.id}
                                onClick={() => setActiveChatId(chat.id)}
                                className={`w-full text-left p-4 border-b border-gray-50 transition-colors hover:bg-blue-50/50 flex gap-3 ${activeChatId === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                                    {chat.otherUser?.avatar_url ? (
                                        <img src={chat.otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={20} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="overflow-hidden flex-1 flex flex-col justify-center">
                                    <h3 className={`truncate text-sm ${chat.id === 'draft' ? 'text-blue-500 font-black' : (chat.unreadCount > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-700')}`}>
                                        {chat.otherUser?.full_name}
                                    </h3>
                                    <p className={`text-xs truncate mt-0.5 ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-blue-600 font-bold'}`}>{chat.offers?.title || 'Unknown Item'}</p>
                                    {chat.order_id && (
                                        <span className={`inline-block mt-1.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-sm w-fit ${chat.orderItem?.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            chat.orderItem?.status === 'disputed' ? 'bg-red-100 text-red-700' :
                                                chat.orderItem?.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-amber-100 text-amber-700'
                                            }`}>
                                            {chat.orderItem?.status || 'pending'}
                                        </span>
                                    )}
                                </div>
                                {chat.unreadCount > 0 && (
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full self-center ml-2 border border-white shrink-0 shadow-sm" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                <div className={`flex-1 flex flex-col bg-gray-50 relative ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
                    {!activeChatId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <MessageSquare size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">Select a chat to start messaging</p>
                        </div>
                    ) : (
                        <>
                            {activeChatData && (
                                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center gap-4 shrink-0 shadow-sm">
                                    <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-900">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                                        {activeChatData.otherUser?.avatar_url ? (
                                            <img src={activeChatData.otherUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={20} className="text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="font-bold text-gray-900">{activeChatData.otherUser?.full_name}</h2>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <Link href={`/offer/${activeChatData.offer_id}`} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 w-fit">
                                                <Package size={12} /> {activeChatData.offers?.title}
                                            </Link>
                                            {activeChatData.offers?.category !== 'digital' && (
                                                <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 animate-in fade-in">
                                                    <Truck size={12} className="text-blue-500" />
                                                    <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">DHL Shipping</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {(showJobProposalBanner || (activeChatData?.offers?.category === 'job' && !activeChatData.order_id)) && activeChatData && (
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex flex-col gap-4 animate-in slide-in-from-top duration-500 shadow-lg relative z-20">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 w-full md:w-auto">
                                            <div className="bg-white/20 p-2 rounded-xl">
                                                <Printer className="text-white" size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">
                                                    {currentUser?.id === activeChatData.buyer_id ? 'Job Fulfillment' : 'Your Job Details'}
                                                </p>
                                                <p className="text-sm font-bold text-white">
                                                    {currentUser?.id === activeChatData.buyer_id 
                                                        ? 'Propose your price to print this item.' 
                                                        : 'The printer is reviewing your requirements.'}
                                                </p>
                                            </div>
                                        </div>

                                        {currentUser?.id === activeChatData.buyer_id ? (
                                            <div className="flex items-center gap-2 w-full md:w-auto">
                                                <div className="relative flex-1 md:w-40">
                                                    <input 
                                                        type="number" 
                                                        placeholder="Price" 
                                                        value={jobProposalPrice} 
                                                        onChange={e => setJobProposalPrice(e.target.value)} 
                                                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm font-black text-white placeholder:text-blue-200/50 focus:outline-none focus:bg-white/20 shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-300 uppercase tracking-widest pointer-events-none">{currency}</span>
                                                </div>
                                                <button 
                                                    onClick={handleSendJobProposal}
                                                    disabled={!jobProposalPrice || sendingJobProposal}
                                                    className="bg-white text-blue-600 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center gap-2 shadow-xl hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                                                >
                                                    {sendingJobProposal ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Proposal
                                                </button>
                                                <div className="w-px h-8 bg-white/20 mx-2 hidden md:block" />
                                                <button 
                                                    onClick={handleDeclineJobChat}
                                                    className="px-4 py-2 bg-red-500/20 text-red-100 hover:bg-red-500/40 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 group whitespace-nowrap"
                                                    title="Pass on this job"
                                                >
                                                    <XCircle size={14} className="group-hover:rotate-90 transition-transform" /> I Can't Print This
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-white/10 border border-white/10 rounded-2xl px-5 py-2.5 flex items-center gap-3 animate-pulse">
                                                <div className="w-2 h-2 bg-blue-400 rounded-full" />
                                                <span className="text-[10px] font-black uppercase text-blue-100 tracking-wider">Awaiting printer response</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/10 flex flex-wrap gap-x-6 gap-y-4">
                                        {activeChatData.offers?.material && (
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1"><Palette size={10} /> Material</span>
                                                <span className="text-sm font-bold text-white">{activeChatData.offers.material}</span>
                                            </div>
                                        )}
                                        {activeChatData.offers?.color && (
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1"><Palette size={10} /> Color</span>
                                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                                    {activeChatData.offers.color && (
                                                        <span className="w-3 h-3 rounded-full border border-white/30" style={{backgroundColor: activeChatData.offers.color}} />
                                                    )}
                                                    {activeChatData.offers.color}
                                                </span>
                                            </div>
                                        )}
                                        {activeChatData.offers?.dimensions && (
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1"><Ruler size={10} /> Dimensions</span>
                                                <span className="text-sm font-bold text-white max-w-[200px] truncate">{activeChatData.offers.dimensions}</span>
                                            </div>
                                        )}
                                        {activeChatData.offers?.weight && (
                                             <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1"><Package size={10} /> Est. Weight</span>
                                                <span className="text-sm font-bold text-white">{activeChatData.offers.weight}</span>
                                            </div>
                                        )}
                                         {activeChatData.offers?.custom_instructions && (
                                             <div className="flex flex-col w-full md:flex-1 md:min-w-[250px] md:border-l md:border-white/10 md:pl-6 pt-3 md:pt-0 border-t border-white/10 md:border-t-0">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1 flex items-center gap-1"><MessageSquare size={10} /> Technical Notes</span>
                                                <p className="text-sm font-medium text-white/90 italic leading-snug line-clamp-3">{activeChatData.offers.custom_instructions}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {showDisputeModal && activeChatData && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                                    <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h3 className="font-black text-gray-900 text-lg flex items-center gap-2"><ShieldAlert size={20} className="text-red-500" /> Open a Dispute</h3>
                                                <p className="text-xs text-gray-500 font-medium mt-1">Describe your problem.</p>
                                            </div>
                                            <button onClick={() => setShowDisputeModal(false)} className="text-gray-400 hover:text-gray-900 p-1 bg-gray-100 rounded-full"><X size={16} /></button>
                                        </div>
                                        <div className="space-y-5">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-2 tracking-wider">Type of Problem</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {PROBLEM_TYPES.filter(pt => activeChatData?.offers?.category === 'digital' ? pt.digital : !pt.digital || pt.value === 'other').map(pt => (
                                                        <button key={pt.value} onClick={() => setDisputeProblemType(pt.value)} className={`p-3 rounded-xl border-2 text-left transition-all ${disputeProblemType === pt.value ? 'border-red-400 bg-red-50' : 'border-gray-100 bg-white'}`}>
                                                            <div className="text-base mb-0.5">{pt.icon}</div>
                                                            <div className="text-xs font-bold text-gray-700">{pt.label}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1 tracking-wider">Describe your problem</label>
                                                <textarea value={disputeDescription} onChange={e => setDisputeDescription(e.target.value)} rows={4} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-red-400 rounded-xl text-sm font-medium outline-none resize-none" placeholder="Explain what went wrong..." />
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
                                            <button 
                                                onClick={handleDisputeSubmit} 
                                                disabled={!disputeProblemType || !disputeDescription.trim() || !disputeEmail.trim() || disputeSubmitting} 
                                                className="w-full py-4 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-50 hover:bg-red-700 transition-all shadow-lg flex items-center justify-center gap-2 transform active:scale-95"
                                            >
                                                {disputeSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><ShieldAlert size={16} /> Submit Dispute</>}
                                            </button>
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
                                                    const sp = sd?.price !== undefined ? (currency !== 'EUR' && rates && rates[currency] ? sd.price * rates[currency] : sd.price) : 0;
                                                    const pDiff = Math.abs(parseFloat(proposalPrice || '0') - sp) > 0.01;
                                                    const qDiff = proposalQty !== (sd?.quantity?.toString() || '1');

                                                    // Comprehensive change detection
                                                    const hasMatChanges = activeChatData.offers?.category === 'physical' && (
                                                        swappedLayers.some(sl => {
                                                            const currentChoiceName = sl.swapped_filament_id
                                                                ? sellerFilaments.find(f => f.id === sl.swapped_filament_id)?.color_name
                                                                : (sl.showCustom ? sl.custom_color_name : '');

                                                            // It's a change if:
                                                            // 1. We picked a filament and its name is different from original
                                                            // 2. We picked custom and its name is different from original AND not empty
                                                            return currentChoiceName && currentChoiceName !== sl.original_color_name;
                                                        }) ||
                                                        (proposalMaterial !== (sd?.material || '')) ||
                                                        (proposalColor !== (sd?.color || ''))
                                                    );

                                                    const originalDims = parseDimensionsAdvanced(sd?.dimensions || activeChatData.offers?.dimensions || '');
                                                    const hasDimChanges = proposalScale !== 100 || proposalDims.some((dim, idx) => {
                                                        const orig = originalDims[idx]?.originalValue || dim.originalValue;
                                                        return Math.abs(parseFloat(dim.currentValueStr || '0') - orig) > 0.01;
                                                    });

                                                    const hasProposalChanges = pDiff || qDiff || hasMatChanges || hasDimChanges;

                                                    return (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <label className={`text-[9px] font-black uppercase ${pDiff ? 'text-blue-600' : 'text-gray-400'}`}>Price per item</label>
                                                                    {activeChatData.offers && (
                                                                        <span className="text-[8px] font-bold text-blue-500/60 tracking-tight">Original: {formatPrice(activeChatData.offers.price)}</span>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <input type="number" step="0.01" value={proposalPrice} onChange={e => setProposalPrice(e.target.value)} className={`w-full pl-10 pr-4 py-3 bg-white border ${pDiff ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-200'} rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 shadow-sm`} />
                                                                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-[10px] uppercase tracking-widest ${pDiff ? 'text-blue-600' : 'text-gray-400'}`}>{currency}</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <label className={`text-[9px] font-black uppercase ${qDiff ? 'text-blue-600' : 'text-gray-400'}`}>Quantity</label>
                                                                    <span className="text-[8px] font-bold text-blue-500/60 tracking-tight">Original: 1</span>
                                                                </div>
                                                                <input type="number" min="1" value={proposalQty} onChange={e => setProposalQty(e.target.value)} className={`w-full px-4 py-3 bg-white border ${qDiff ? 'border-blue-400 ring-4 ring-blue-50' : 'border-gray-200'} rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-900 shadow-sm`} />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* FILAMENT SELECTION / MULTI-COLOR SWAPPING */}
                                            {activeChatData.offers?.category === 'physical' && (
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
                                                                                    <div className="relative shrink-0">
                                                                                        <div className="w-9 h-9 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center transition-transform hover:scale-105 overflow-hidden" style={{ backgroundColor: layer.custom_color_hex }}>
                                                                                            <input
                                                                                                type="color"
                                                                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                                                                value={layer.custom_color_hex}
                                                                                                onChange={e => {
                                                                                                    const updated = [...swappedLayers];
                                                                                                    updated[lIdx].custom_color_hex = e.target.value;
                                                                                                    setSwappedLayers(updated);
                                                                                                }}
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
                                                                    {showCustomFilamentInput && (
                                                                        <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1">
                                                                            <div className="flex gap-2">
                                                                                <div className="relative shrink-0">
                                                                                    <div className="w-10 h-10 rounded-xl border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center" style={{ backgroundColor: proposalColorHex }}>
                                                                                        <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={proposalColorHex} onChange={e => setProposalColorHex(e.target.value)} />
                                                                                        {proposalColorHex === '#cccccc' && <Palette size={14} className="text-gray-400 pointer-events-none" />}
                                                                                    </div>
                                                                                </div>
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Color name (e.g. Ocean Blue)..."
                                                                                    value={proposalColor}
                                                                                    onChange={e => setProposalColor(e.target.value)}
                                                                                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 text-gray-900 transition-all"
                                                                                />
                                                                            </div>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Material type (PLA, PETG, ABS, Resin...)"
                                                                                value={proposalMaterial}
                                                                                onChange={e => setProposalMaterial(e.target.value)}
                                                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-blue-400 text-gray-900 transition-all"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                            <button onClick={sendProposal} disabled={!proposalPrice || !proposalQty || !hasProposalChanges} className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:shadow-none transition-all ${currentUser?.id === activeChatData.seller_id ? 'bg-amber-500' : 'bg-blue-600'}`}>
                                                <Handshake size={15} /> {currentUser?.id === activeChatData.seller_id ? 'Send Offer' : 'Send Proposal'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                                    chronList.sort((a, b) => a._time - b._time);

                                    if (chronList.length === 0 && activeChatId !== 'draft') {
                                        return <div className="text-center py-10 text-gray-400 font-medium text-sm">Empty chat. Send a message to start!</div>;
                                    }

                                    return chronList.map((msg, idx) => {
                                        if (msg._type === 'action_card') {
                                            return <div key={`ac-${idx}`}>{renderActionCard(activeChatData?.orderItem, activeChatData)}</div>;
                                        }

                                        const isMe = msg.sender_id === currentUser?.id;
                                        if (msg.message_type && msg.message_type !== 'user') return renderSystemMessage(msg, idx);

                                        if (msg.content.startsWith('[PROPOSAL]')) {
                                            const pData = JSON.parse(msg.content.substring(10));
                                            const isSeller = currentUser?.id === activeChatData?.seller_id;
                                            const isBuyer = currentUser?.id === activeChatData?.buyer_id;
                                            return (
                                                <div key={msg.id || idx} className="flex flex-col w-full my-8 px-2 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                                <div className={`w-[280px] sm:w-[320px] rounded-[24px] overflow-hidden border shadow-2xl transition-all hover:scale-[1.02] ${
                                                                    pData.status === 'accepted' ? 'border-emerald-500/30 bg-emerald-900/10' :
                                                                    (pData.status === 'rejected' || pData.status === 'cancelled') ? 'border-rose-500/30 bg-rose-900/10' :
                                                                    pData.status === 'counter_proposed' ? 'border-fuchsia-500/30 bg-fuchsia-900/10' :
                                                                    'border-white/10 bg-[#0f172a]/80 backdrop-blur-xl'
                                                                }`}>
                                                                    {/* HEADER DECORATION */}
                                                                    <div className={`h-1.5 w-full ${
                                                                        pData.status === 'accepted' ? 'bg-emerald-500' :
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
                                                                            pData.status === 'accepted' ? 'Deal Reached' :
                                                                            pData.status === 'rejected' ? 'Offer Declined' :
                                                                            pData.status === 'cancelled' ? 'Offer Withdrawn' :
                                                                            pData.status === 'seller_proposed' ? 'Seller Offer' : 'Customer Request'}
                                                                    </span>
                                                                    <h4 className="text-white text-xs font-bold mt-0.5">
                                                                        {pData.status === 'counter_proposed' ? 'Revised Offer' :
                                                                            pData.status === 'accepted' ? 'Final Agreement' :
                                                                            pData.status === 'cancelled' ? 'Cancelled Request' :
                                                                            pData.status === 'seller_proposed' ? 'Special Deal' : 'Custom Request'}
                                                                    </h4>
                                                                </div>
                                                                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                                                    pData.status === 'accepted' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' :
                                                                    (pData.status === 'rejected' || pData.status === 'cancelled') ? 'border-rose-500 text-rose-400 bg-rose-900/20' :
                                                                    pData.status === 'countered' ? 'border-slate-500 text-slate-400 bg-slate-500/10' :
                                                                    pData.status === 'counter_proposed' ? 'border-violet-500 text-violet-400 bg-violet-500/10' :
                                                                    'border-blue-500/50 text-blue-400 bg-blue-500/10'
                                                                }`}>
                                                                    {pData.status === 'countered' ? 'Offer Replaced' : 
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
                                                                                    {formatPrice(pData.price)}
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
                                                                                        {pData.dimensions}
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
                                                                                <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isMatChanged ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white/5 border-white/10'}`}>
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
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* ACTIONS */}
                                                            {(() => {
                                                                const inCart = cartItems.some(i => i.id === pData.custom_offer_id);

                                                                if (inCart && isBuyer) {
                                                                    return (
                                                                        <div className="flex items-center justify-center gap-2 py-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">
                                                                            <Package size={14} /> Already in your Cart
                                                                        </div>
                                                                    );
                                                                }

                                                                const isOfferWithdrawable = isMe && (pData.status === 'pending' || pData.status === 'seller_proposed' || pData.status === 'counter_proposed');

                                                                if (isOfferWithdrawable) {
                                                                    return (
                                                                        <div className="pt-2">
                                                                            <button
                                                                                onClick={() => handleWithdrawProposal(msg.id, pData)}
                                                                                className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                                                                            >
                                                                                <X size={12} /> Withdraw (Cancel Offer)
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                }

                                                                const isOfferForBuyer = (pData.status === 'seller_proposed' || pData.status === 'counter_proposed' || pData.status === 'pending') && isBuyer && !isMe;

                                                                if (isOfferForBuyer) {
                                                                    return (
                                                                        <div className="space-y-2 pt-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (isBuyer) {
                                                                                        handleBuyerAcceptsSellerProposal(msg.id, pData);
                                                                                    } else {
                                                                                        handleAcceptProposal(msg.id, pData);
                                                                                    }
                                                                                }}
                                                                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-xl shadow-emerald-900/40 transition-all transform active:scale-[0.98]"
                                                                            >
                                                                                <CreditCard size={14} className="inline mr-2 -mt-0.5" />
                                                                                {pData.status === 'accepted' ? 'Add to Cart & Checkout' : 'Buy Now'}
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

                                                                if (pData.status === 'pending' && isSeller && !isMe) {
                                                                    const isJob = activeChatData?.offers?.category === 'job';
                                                                    return (
                                                                        <div className="space-y-2 pt-2">
                                                                            <button
                                                                                onClick={() => handleAcceptProposal(msg.id, pData)}
                                                                                className={`w-full py-3.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isJob ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-900/40' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                                                                            >
                                                                                {isJob ? <><CreditCard size={14} className="inline mr-2 -mt-0.5" /> Accept & Pay</> : 'Accept Request'}
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

                                                                if (pData.status === 'accepted' && isBuyer) {
                                                                    return (
                                                                        <button
                                                                            onClick={() => handleBuyCustomOffer(pData)}
                                                                            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.1em] shadow-xl shadow-emerald-900/40 transition-all transform active:scale-[0.98] mt-2"
                                                                        >
                                                                            <CreditCard size={14} className="inline mr-2 -mt-0.5" />
                                                                            Add to Cart & Checkout
                                                                        </button>
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

                                        return (
                                            <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                                    <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
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

                            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                                <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto items-end">
                                    {activeChatData?.orderItem && activeChatData.offers?.category !== 'digital' && (
                                        activeChatData.orderItem.tracking_code ? (
                                            <a
                                                href={`https://www.dhl.com/pl-pl/home/tracking.html?tracking-id=${activeChatData.orderItem.tracking_code}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group relative flex flex-col items-center justify-center h-[50px] w-[60px] rounded-xl bg-gray-900 border border-gray-800 text-white shadow hover:shadow-lg hover:-translate-y-0.5 transition-all shrink-0 overflow-hidden"
                                                title={`Track DHL: ${activeChatData.orderItem.tracking_code}`}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <Truck size={20} strokeWidth={2} className="relative z-10 mb-0.5 text-[#FFCC00]" />
                                                <span className="relative z-10 text-[8px] uppercase tracking-widest leading-none font-bold text-gray-300 group-hover:text-white transition-colors">Track</span>
                                            </a>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-[50px] w-[60px] rounded-xl bg-gray-50/50 border border-dashed border-gray-200 text-gray-400 shrink-0" title="Waiting for DHL tracking code">
                                                <Truck size={20} strokeWidth={1.5} className="mb-0.5 opacity-40" />
                                                <span className="text-[8px] uppercase tracking-widest leading-none font-bold opacity-60">Status</span>
                                            </div>
                                        )
                                    )}
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-h-[50px] max-h-[150px] focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all text-sm font-medium"
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                    />
                                    <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 h-[50px] w-[50px] flex items-center justify-center shrink-0 shadow-md">
                                        <Send size={20} />
                                    </button>

                                    {currentUser?.id === activeChatData?.buyer_id && (
                                        <button type="button" onClick={() => openProposalModal()} className="px-4 py-3 bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 h-[50px] shrink-0 whitespace-nowrap shadow-sm">
                                            <Handshake size={14} /> Negotiate
                                        </button>
                                    )}
                                    {currentUser?.id === activeChatData?.seller_id && (
                                        <button type="button" onClick={() => openProposalModal()} className="px-4 py-3 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 h-[50px] shrink-0 whitespace-nowrap shadow-sm">
                                            <Handshake size={14} /> Special Offer
                                        </button>
                                    )}
                                </form>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <MessagesInner />
        </Suspense>
    );
}
