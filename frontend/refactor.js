const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. the state variables (line 54+)
txt = txt.replace(
    /const \[proposalColor, setProposalColor\] = useState\(''\);/,
    `const [proposalColor, setProposalColor] = useState('');
    const [proposalColorHex, setProposalColorHex] = useState('#cccccc');
    const [selectedFilamentId, setSelectedFilamentId] = useState<string | null>(null);
    const [sellerFilaments, setSellerFilaments] = useState<any[]>([]);
    const [showCustomFilamentInput, setShowCustomFilamentInput] = useState(false);
    const [customFilamentText, setCustomFilamentText] = useState('');
    const [loadingFilaments, setLoadingFilaments] = useState(false);

    type ParsedDim = { name: string; originalValue: number; currentValueStr: string; unit: string; isBase: boolean; };
    const [proposalDims, setProposalDims] = useState<ParsedDim[]>([]);
    const [proposalScale, setProposalScale] = useState<number>(100);`
);

// 2. new sendProposal logic and openProposalModal
const newProposalLogic = `
    const parseDimensionsAdvanced = (dimStr: string): ParsedDim[] => {
        if (!dimStr) return [];
        return dimStr.split(',').map(part => {
            const match = part.match(/^(.*?):\\s*(\\d+(?:\\.\\d+)?)\\s*(.*)$/);
            if (match) {
                const name = match[1].trim();
                const val = parseFloat(match[2]);
                const unit = match[3].trim();
                const lowerName = name.toLowerCase();
                const isBase = lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('depth') ||
                               lowerName.includes('szerokość') || lowerName.includes('wysokość') || lowerName.includes('głębokość') ||
                               lowerName.includes('szerokosc') || lowerName.includes('wysokosc') || lowerName.includes('glebokosc');
                return { name, originalValue: val, currentValueStr: val.toString(), unit, isBase };
            }
            return { name: part.trim(), originalValue: 0, currentValueStr: '', unit: '', isBase: false };
        }).filter(d => d.originalValue > 0);
    };

    const openProposalModal = async () => {
        if (!activeChatData) return;
        const offerPrice = activeChatData.offers?.price;
        if (offerPrice !== undefined && offerPrice !== null) {
            const displayPrice = currency !== 'EUR' && rates && rates[currency]
                ? (offerPrice * rates[currency]).toFixed(2)
                : offerPrice.toFixed(2);
            setProposalPrice(displayPrice);
        } else {
            setProposalPrice('');
        }
        setProposalQty('1');
        setProposalMaterial(activeChatData.offers?.material || '');
        setProposalColor(activeChatData.offers?.color || '');
        setProposalColorHex('#cccccc');
        setSelectedFilamentId(null);
        setShowCustomFilamentInput(false);
        setCustomFilamentText('');

        const dimStr = activeChatData.offers?.dimensions || '';
        setProposalDims(parseDimensionsAdvanced(dimStr));
        setProposalScale(100);

        setLoadingFilaments(true);
        setShowProposalModal(true);
        try {
            const res = await fetch(\`/api/filaments?sellerId=\${activeChatData.seller_id}\`);
            const data = await res.json();
            if (data.filaments) {
                setSellerFilaments(data.filaments);
            } else {
                setSellerFilaments([]);
            }
        } catch (err) {
            console.error(err);
            setSellerFilaments([]);
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
                if (d.isBase && d !== newDims[idx] && d.originalValue > 0) {
                    d.currentValueStr = (d.originalValue * scale).toFixed(2).replace(/\\.00$/, '');
                }
            });
        }
        setProposalDims(newDims);
    };

    // --- PROPOSAL LOGIC ---
    const sendProposal = async () => {
        if (!activeChatId || !currentUser || !activeChatData) return;

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

        const payload: any = {
            price: finalPrice,
            quantity: parseInt(proposalQty),
            material: resolvedMaterial,
            color: resolvedColor,
            colorHex: resolvedColorHex,
            dimensions: proposalDims.length > 0 ? proposalDims.map(d => \`\${d.name}: \${d.currentValueStr} \${d.unit}\`).join(', ') : undefined,
            dimensionScale: proposalScale,
            status: 'pending'
        };

        const isSeller = currentUser.id === activeChatData.seller_id;

        if (isSeller) {
            try {
                const { data: newOffer, error: offerError } = await supabase.from('offers').insert({
                    user_id: currentUser.id,
                    category: activeChatData.offers?.category || 'physical',
                    title: \`Custom Order: \${activeChatData.offers?.title || 'Item'}\`.substring(0, 150),
                    description: 'Custom order negotiated via chat.',
                    price: Number(payload.price),
                    material: payload.material,
                    color: payload.color,
                    stock: Number(payload.quantity),
                    is_custom: true,
                    parent_offer_id: activeChatData.offers?.id || null,
                    image_urls: activeChatData.offers?.image_urls || null,
                    dimensions: payload.dimensions || activeChatData.offers?.dimensions || null
                }).select().single();

                if (offerError) throw offerError;

                payload.status = 'seller_proposed';
                payload.custom_offer_id = newOffer.id;
            } catch (e) {
                console.error(e);
                alert("Error creating offer. Please ensure the price is correct.");
                return;
            }
        }

        const content = \`[PROPOSAL]\${JSON.stringify(payload)}\`;`;

txt = txt.replace(/(\/\/ --- PROPOSAL LOGIC ---)[\s\S]*?(const content = `\[PROPOSAL\]\$\{JSON\.stringify\(payload\)\}`;)/, newProposalLogic);

// 3. update onClick={() => setShowProposalModal(true)} to openProposalModal()
txt = txt.replace(/onClick=\{\(\) => setShowProposalModal\(true\)\}/g, "onClick={openProposalModal}");


// 4. Update Modal UI
const newModalUI = `
                            {/* PROPOSAL MODAL */}
                            {showProposalModal && activeChatData && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2 text-gray-900 font-black tracking-tight text-xl">
                                                <Handshake className="text-blue-600" /> PROPOSE CHANGES
                                            </div>
                                            <button onClick={() => setShowProposalModal(false)} className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={16} /></button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-6">
                                            {/* PRICE & QTY SECTION */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-3 px-1">
                                                    <CreditCard size={14} className="text-gray-400" />
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Price & Quantity</span>
                                                </div>
                                                <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Target Price per item</label>
                                                        <div className="relative">
                                                            <input type="number" min="0" step="0.01" value={proposalPrice} onChange={e => setProposalPrice(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-blue-500 rounded-xl text-sm font-bold outline-none transition" />
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-[10px] tracking-wider pointer-events-none">{currency}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Quantity</label>
                                                        <input type="number" min="1" value={proposalQty} onChange={e => setProposalQty(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-blue-500 rounded-xl text-sm font-bold outline-none transition" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* FILAMENT SECTION */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-3 px-1">
                                                    <Palette size={14} className="text-gray-400" />
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Filament / Color</span>
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                                    {loadingFilaments ? (
                                                        <div className="flex items-center justify-center py-5 gap-2 text-gray-400">
                                                            <Loader2 size={14} className="animate-spin" />
                                                            <span className="text-xs font-bold">Loading seller filaments...</span>
                                                        </div>
                                                    ) : sellerFilaments.length > 0 ? (
                                                        <div className="mb-3">
                                                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-2">Seller's available filaments — click to select:</p>
                                                            <div className="grid grid-cols-4 gap-2">
                                                                {sellerFilaments.map(fil => {
                                                                    const selected = selectedFilamentId === fil.id;
                                                                    return (
                                                                        <button
                                                                            key={fil.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedFilamentId(fil.id);
                                                                                setProposalMaterial(fil.plastic_type);
                                                                                setProposalColor(fil.color_name);
                                                                                setShowCustomFilamentInput(false);
                                                                                setCustomFilamentText('');
                                                                            }}
                                                                            className={\`relative flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all text-center \${
                                                                                selected
                                                                                    ? 'border-blue-500 shadow-md scale-105 bg-blue-50'
                                                                                    : 'border-transparent hover:border-gray-300 bg-white hover:shadow-sm'
                                                                            }\`}
                                                                            title={\`\${fil.plastic_type} · \${fil.color_name}\${fil.brand ? \` (\${fil.brand})\` : ''}\`}
                                                                        >
                                                                            <div
                                                                                className="w-full h-7 rounded-lg shadow-sm"
                                                                                style={{ backgroundColor: fil.color_hex || '#cccccc' }}
                                                                            />
                                                                            <span className="text-[8px] font-black text-gray-600 leading-tight line-clamp-1 w-full">{fil.color_name}</span>
                                                                            <span className="text-[7px] font-bold text-gray-400">{fil.plastic_type}</span>
                                                                            {fil.stock_grams !== null && fil.stock_grams < 100 && (
                                                                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-400 rounded-full" title="Low stock" />
                                                                            )}
                                                                            {selected && (
                                                                                <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                                                                                    <Check size={8} className="text-white" />
                                                                                </div>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                                                            <p className="text-[10px] font-bold text-amber-600">Seller has no filaments in database.</p>
                                                        </div>
                                                    )}

                                                    {sellerFilaments.length > 0 && !showCustomFilamentInput ? (
                                                        <div className="text-center mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => { setShowCustomFilamentInput(true); setSelectedFilamentId(null); }}
                                                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-1.5"
                                                            >
                                                                ✏️ Suggest your own material / color
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white p-3 rounded-xl border border-gray-200 mt-2">
                                                            {sellerFilaments.length > 0 && (
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <label className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Custom Material</label>
                                                                    <button type="button" onClick={() => { setShowCustomFilamentInput(false); }} className="text-[9px] font-black uppercase text-gray-400 hover:text-red-500 transition">✕ Cancel</button>
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Material Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={proposalMaterial}
                                                                        onChange={e => { setProposalMaterial(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        placeholder={activeChatData.offers?.material || 'e.g. PLA'}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Color Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={proposalColor}
                                                                        onChange={e => { setProposalColor(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        placeholder={activeChatData.offers?.color || 'e.g. Red'}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Color Visual Preview (Hex)</label>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="color"
                                                                        value={proposalColorHex}
                                                                        onChange={e => { setProposalColorHex(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden shrink-0 shadow-sm"
                                                                    />
                                                                    <input 
                                                                        type="text" 
                                                                        value={proposalColorHex} 
                                                                        onChange={e => { setProposalColorHex(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition uppercase"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* DIMENSIONS SECTION */}
                                            {proposalDims.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <div className="flex items-center gap-2">
                                                            <Ruler size={14} className="text-gray-400" />
                                                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dimensions</span>
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full shadow-sm border border-blue-100">
                                                            Scale: {proposalScale.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                                        {proposalDims.map((dim, idx) => (
                                                            <div key={idx} className="flex flex-col">
                                                                <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">
                                                                    {dim.name} {dim.isBase ? '' : '(Custom/Additional)'}
                                                                </label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="number" step="0.1"
                                                                        value={dim.currentValueStr}
                                                                        onChange={e => handleDimChange(idx, e.target.value)}
                                                                        className={\`w-full px-3 py-2 bg-white border \${dim.isBase ? 'border-blue-200 focus:border-blue-500' : 'border-gray-200 focus:border-gray-400'} rounded-lg text-sm font-bold outline-none transition pr-12\`}
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">
                                                                        {dim.unit}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <p className="text-[9px] font-bold text-gray-400 text-center mt-3 max-w-xs mx-auto leading-relaxed">
                                                            Modifying any primary dimension will proportionally scale all others.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={sendProposal}
                                                disabled={!proposalPrice || !proposalQty}
                                                className="w-full py-4 mt-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                            >
                                                <Handshake size={15} /> Send Proposal
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}`;

txt = txt.replace(/\{\/\* PROPOSAL MODAL \*\/\}[\s\S]*?(?=\{\/\* Messages Area \*\/)/, newModalUI + "\n\n                            ");


// 5. Update UI for rendering proposals
const newProposalMessageRender = `
                                                            <div className="flex gap-2 mb-2">
                                                                <div className="text-[10px] font-bold text-gray-600 bg-white/50 px-2 py-1 rounded border border-gray-100 flex items-center gap-1.5">
                                                                    <Palette size={10} className="text-gray-400" />
                                                                    {pData.colorHex && pData.status === 'pending' && (
                                                                        <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: pData.colorHex }} />
                                                                    )}
                                                                    <span>{pData.material} • {pData.color}</span>
                                                                </div>
                                                            </div>
                                                            {pData.dimensions && (
                                                                <div className="mb-3 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50">
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <Ruler size={10} className="text-blue-500" />
                                                                        <span className="text-[9px] font-black uppercase text-blue-500 tracking-wider">Requested Dimensions</span>
                                                                        {pData.dimensionScale && pData.dimensionScale !== 100 && (
                                                                            <span className="ml-auto text-[8px] font-black uppercase text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                                                                {pData.dimensionScale.toFixed(2)}% Scale
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col gap-1 pl-1">
                                                                        {pData.dimensions.split(',').map((dim: string, didx: number) => (
                                                                            <span key={didx} className="text-[10px] font-bold text-gray-700">{dim.trim()}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}`;
txt = txt.replace(/<div className="flex gap-2 mb-2">[\s\S]*?<\/div>\s*<\/div>/, newProposalMessageRender);


fs.writeFileSync(file, txt);
console.log('done!');
