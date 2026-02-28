'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageSquare, Loader2, Send, Package, User, Handshake, Check, X } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { useCurrency } from '../../../context/CurrencyContext';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MessagesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialChatId = searchParams?.get('chat');

    const { addItem } = useCart();
    const { formatPrice } = useCurrency();

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

    const messagesEndRef = useRef<HTMLDivElement>(null);

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
        // 1. Load chats where user is buyer or seller
        const { data: fetchedChats, error } = await supabase
            .from('chats')
            .select(`
        id, created_at, updated_at, order_id,
        buyer_id, seller_id,
        offer_id,
        offers ( id, title, image_urls, category, price, material, color )
      `)
            .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error(error);
            setLoadingChats(false);
            return;
        }

        // 2. We need details of the OTHER user. Since postgrest doesn't easily do dynamic joins conditionally,
        // we'll fetch the profiles manually for the other party.
        const enrichChats = await Promise.all((fetchedChats || []).map(async (chat) => {
            const otherUserId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;
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

            return { ...chat, otherUser: otherProfile || { full_name: 'Unknown User' }, unreadCount: unreadCount || 0 };
        }));

        setChats(enrichChats);
        setLoadingChats(false);

        if (initialChatId && enrichChats.some(c => c.id === initialChatId)) {
            setActiveChatId(initialChatId);
        } else if (!initialChatId && enrichChats.length > 0) {
            setActiveChatId(enrichChats[0].id);
        }
    };

    useEffect(() => {
        if (activeChatId && currentUser) {
            const currentChatId = activeChatId;
            loadMessages(currentChatId);

            // Mark as read
            const markAsRead = async () => {
                await supabase.from('messages')
                    .update({ is_read: true })
                    .eq('chat_id', currentChatId)
                    .neq('sender_id', currentUser.id);
            };
            markAsRead();

            // Update local state to remove the red dot immediately
            setChats(prev => prev.map(c => c.id === currentChatId ? { ...c, unreadCount: 0 } : c));
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
        setNewMessage(''); // optimistic clear

        // Optimistic UI update
        const tempMsg = {
            id: 'temp-' + Date.now(),
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        const { error } = await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
        });

        if (error) {
            console.error(error);
            alert("Failed to send message");
        } else {
            // Refresh messages to get true ID and timestamp
            loadMessages(activeChatId);
            // Refresh chats to update sorting by updated_at
            loadChats(currentUser.id);
        }
    };

    const activeChatData = chats.find(c => c.id === activeChatId);

    // --- PROPOSAL LOGIC ---

    const sendProposal = async () => {
        if (!activeChatId || !currentUser || !activeChatData) return;

        let payload: any = {
            price: parseFloat(proposalPrice),
            quantity: parseInt(proposalQty),
            material: proposalMaterial || activeChatData.offers?.material || 'Any',
            color: proposalColor || activeChatData.offers?.color || 'Any',
            status: 'pending'
        };

        const isSeller = currentUser.id === activeChatData.seller_id;

        // SELLER PROPOSAL: Create custom offer instantly
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
                    image_urls: activeChatData.offers?.image_urls || null
                }).select().single();

                if (offerError) throw offerError;

                payload.status = 'seller_proposed';
                payload.custom_offer_id = newOffer.id;
            } catch (e) {
                console.error(e);
                alert("Błąd podczas wystawienia oferty. Upewnij się czy cena jest prawidłowa.");
                return;
            }
        }

        const content = `[PROPOSAL]${JSON.stringify(payload)}`;
        setShowProposalModal(false);
        setProposalPrice('');

        // Optimistic UI update
        const tempMsg = {
            id: 'temp-' + Date.now(),
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        scrollToBottom();

        await supabase.from('messages').insert({
            chat_id: activeChatId,
            sender_id: currentUser.id,
            content: content,
        });

        loadMessages(activeChatId);
        loadChats(currentUser.id);
    };

    const handleAcceptProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData || activeChatData.seller_id !== currentUser.id) return;

        if (!parsedData || !parsedData.price || isNaN(Number(parsedData.price))) {
            alert("Błąd: Propozycja nie ma poprawnej ceny! Spróbuj odświeżyć stronę lub poproś o wysłanie nowej.");
            return;
        }

        try {
            // 1. Create the NEW hidden offer for this specific user
            const { data: newOffer, error: offerError } = await supabase.from('offers').insert({
                user_id: currentUser.id,
                category: activeChatData.offers?.category || 'physical',
                title: `Custom Order: ${activeChatData.offers?.title || 'Item'}`.substring(0, 150),
                description: 'Custom order negotiated via chat.',
                price: Number(parsedData.price),
                material: parsedData.material || 'N/A',
                color: parsedData.color || 'N/A',
                stock: Number(parsedData.quantity) || 1,
                is_custom: true,
                parent_offer_id: activeChatData.offers?.id || null,
                image_urls: activeChatData.offers?.image_urls || null
            }).select().single();

            if (offerError) throw offerError;

            // 2. Update the message status
            parsedData.status = 'accepted';
            parsedData.custom_offer_id = newOffer.id;

            await supabase.from('messages').update({
                content: `[PROPOSAL]${JSON.stringify(parsedData)}`
            }).eq('id', msgId);
            loadMessages(activeChatId as string);
        } catch (e: any) {
            console.error("Failed to accept proposal", e);
            alert(`Błąd podczas akceptacji oferty: ${e.message || JSON.stringify(e)} \n(Upewnij się, że wykonałeś najnowszy skrypt w edytorze SQL!)`);
        }
    };

    const handleBuyerAcceptsSellerProposal = async (msgId: string, parsedData: any) => {
        if (!activeChatData || activeChatData.buyer_id !== currentUser.id) return;

        parsedData.status = 'accepted';
        await supabase.from('messages').update({
            content: `[PROPOSAL]${JSON.stringify(parsedData)}`
        }).eq('id', msgId);

        loadMessages(activeChatId as string);
        handleBuyCustomOffer(parsedData);
    };

    const handleRejectProposal = async (msgId: string, parsedData: any) => {
        parsedData.status = 'rejected';
        await supabase.from('messages').update({
            content: `[PROPOSAL]${JSON.stringify(parsedData)}`
        }).eq('id', msgId);
        loadMessages(activeChatId as string);
    };

    const handleBuyCustomOffer = (parsedData: any) => {
        if (!activeChatData || !parsedData.custom_offer_id) return;

        addItem({
            id: parsedData.custom_offer_id,
            title: `Custom: ${activeChatData.offers?.title}`,
            price: parsedData.price,
            image_url: activeChatData.offers?.image_urls?.[0] || null,
            seller_id: activeChatData.seller_id,
            stock: parsedData.quantity
        }, parsedData.quantity);

        router.push('/cart');
    };

    return (
        <main className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">

            {/* HEADER */}
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

                {/* LEFT PANEL: CHAT LIST */}
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
                                    <h3 className={`truncate text-sm ${chat.unreadCount > 0 ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>{chat.otherUser?.full_name}</h3>
                                    <p className={`text-xs truncate mt-0.5 ${chat.unreadCount > 0 ? 'text-gray-900 font-bold' : 'text-blue-600 font-bold'}`}>{chat.offers?.title || 'Unknown Item'}</p>
                                    {chat.order_id && <span className="inline-block mt-1 text-[9px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded-sm w-fit">Order Placed</span>}
                                </div>
                                {chat.unreadCount > 0 && (
                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full self-center ml-2 border border-white shrink-0 shadow-sm" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* RIGHT PANEL: ACTIVE CHAT */}
                <div className={`flex-1 flex flex-col bg-gray-50 relative ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
                    {!activeChatId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <MessageSquare size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">Select a chat to start messaging</p>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            {activeChatData && (
                                <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center gap-4 shrink-0 shadow-sm">
                                    {/* Mobile Back Button */}
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
                                        <Link href={`/offer/${activeChatData.offer_id}`} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 w-fit">
                                            <Package size={12} /> {activeChatData.offers?.title}
                                        </Link>
                                    </div>

                                    {currentUser?.id === activeChatData.buyer_id && (
                                        <button
                                            onClick={() => setShowProposalModal(true)}
                                            className="px-4 py-2 shrink-0 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2"
                                        >
                                            <Handshake size={14} /> Negotiate
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* PROPOSAL MODAL */}
                            {showProposalModal && activeChatData && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-black text-gray-900 uppercase">Propose Customization</h3>
                                            <button onClick={() => setShowProposalModal(false)} className="text-gray-400 hover:text-gray-900 p-1 bg-gray-100 rounded-full"><X size={16} /></button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Target Price per item</label>
                                                <div className="relative">
                                                    <input type="number" min="0" step="0.01" value={proposalPrice} onChange={e => setProposalPrice(e.target.value)} placeholder={activeChatData.offers?.price?.toString()} className="w-full pl-8 pr-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl text-sm font-bold outline-none" />
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Quantity</label>
                                                <input type="number" min="1" value={proposalQty} onChange={e => setProposalQty(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl text-sm font-bold outline-none" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Material</label>
                                                    <input type="text" value={proposalMaterial} onChange={e => setProposalMaterial(e.target.value)} placeholder={activeChatData.offers?.material || 'Any'} className="w-full px-3 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Color</label>
                                                    <input type="text" value={proposalColor} onChange={e => setProposalColor(e.target.value)} placeholder={activeChatData.offers?.color || 'Any'} className="w-full px-3 py-3 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-xl text-xs font-bold outline-none" />
                                                </div>
                                            </div>
                                            <button
                                                onClick={sendProposal}
                                                disabled={!proposalPrice || !proposalQty}
                                                className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition"
                                            >
                                                Send Proposal
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" /></div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400 font-medium text-sm">No messages yet. Send a message to start!</div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        const isMe = msg.sender_id === currentUser?.id;
                                        const isSystem = msg.sender_id === null; // In case we add system messages

                                        if (isSystem) {
                                            return (
                                                <div key={msg.id || idx} className="flex justify-center my-4">
                                                    <div className="bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-blue-100">
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        if (msg.content.startsWith('[PROPOSAL]')) {
                                            const jsonStr = msg.content.substring(10);
                                            let pData: any = {};
                                            try { pData = JSON.parse(jsonStr); } catch (e) { }

                                            const isBuyer = currentUser?.id === activeChatData?.buyer_id;
                                            const isSeller = currentUser?.id === activeChatData?.seller_id;

                                            return (
                                                <div key={msg.id || idx} className={`flex flex-col w-full my-6 ${isMe ? 'items-end' : 'items-start'}`}>
                                                    <div className={`w-64 sm:w-80 rounded-2xl overflow-hidden border shadow-sm ${pData.status === 'accepted' ? 'border-green-200 bg-green-50' : pData.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-white'}`}>
                                                        <div className={`px-4 py-2 flex items-center justify-between border-b ${pData.status === 'accepted' ? 'bg-green-100 border-green-200' : pData.status === 'rejected' ? 'bg-red-100 border-red-200' : 'bg-blue-50 border-blue-100'}`}>
                                                            <span className="text-[10px] font-black uppercase flex items-center gap-1 text-gray-700">
                                                                <Handshake size={12} /> Custom Proposal
                                                            </span>
                                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white ${pData.status === 'accepted' ? 'bg-green-500' : pData.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'}`}>
                                                                {pData.status}
                                                            </span>
                                                        </div>
                                                        <div className="p-4 space-y-3">
                                                            <div className="flex justify-between items-end">
                                                                <div>
                                                                    <div className="text-[10px] font-black uppercase text-gray-400">Total / Piece</div>
                                                                    <div className="text-xl font-black text-gray-900">{formatPrice(pData.price)} <span className="text-xs text-gray-400 font-bold">x {pData.quantity}</span></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 mb-2">
                                                                <div className="text-[10px] font-bold text-gray-600 bg-white/50 px-2 py-1 rounded">Mat: {pData.material}</div>
                                                                <div className="text-[10px] font-bold text-gray-600 bg-white/50 px-2 py-1 rounded">Col: {pData.color}</div>
                                                            </div>

                                                            {/* ACTIONS */}
                                                            {pData.status === 'pending' && isSeller && (
                                                                <div className="flex gap-2 mt-4">
                                                                    <button onClick={() => handleAcceptProposal(msg.id, pData)} className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"><Check size={14} /> Accept Offer</button>
                                                                    <button onClick={() => handleRejectProposal(msg.id, pData)} className="flex-1 py-2 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"><X size={14} /> Reject</button>
                                                                </div>
                                                            )}
                                                            {pData.status === 'pending' && isBuyer && (
                                                                <div className="mt-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waiting for maker approval...</div>
                                                            )}

                                                            {/* SELLER PROPOSED ACTIONS */}
                                                            {pData.status === 'seller_proposed' && isBuyer && (
                                                                <div className="flex gap-2 mt-4">
                                                                    <button onClick={() => handleBuyerAcceptsSellerProposal(msg.id, pData)} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all">Accept & Buy</button>
                                                                    <button onClick={() => handleRejectProposal(msg.id, pData)} className="px-3 py-2 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"><X size={14} /></button>
                                                                </div>
                                                            )}
                                                            {pData.status === 'seller_proposed' && isSeller && (
                                                                <div className="mt-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waiting for buyer to purchase...</div>
                                                            )}

                                                            {/* ADD TO CART ACTION (if previously accepted and buyer is viewing) */}
                                                            {pData.status === 'accepted' && isBuyer && !msg.id.startsWith('temp-') && (
                                                                <button onClick={() => handleBuyCustomOffer(pData)} className="w-full mt-2 py-3 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                                                                    Add to Cart
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'}`}>
                                                    <p className="text-sm font-medium leading-relaxed" style={{ wordBreak: 'break-word' }}>{msg.content}</p>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-bold mt-1 px-1">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                                <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-h-[50px] max-h-[150px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all text-sm font-medium text-gray-800"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-blue-600 shrink-0 shadow-md"
                                    >
                                        <Send size={20} className="ml-1" />
                                    </button>
                                </form>
                                <p className="text-center text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-widest">Press Enter to send, Shift + Enter for new line</p>
                            </div>
                        </>
                    )}
                </div>

            </div>
        </main>
    );
}
