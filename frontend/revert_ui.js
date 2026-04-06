const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// REVERT 1: The message container (return to old blue/green/red)
const msgRenderNew = `                                                    <div className={\`w-64 sm:w-80 rounded-3xl overflow-hidden border shadow-md transition-all \${pData.status === 'accepted' ? 'border-emerald-200 bg-emerald-50/30' : pData.status === 'rejected' ? 'border-gray-200 bg-gray-50/50 opacity-80' : 'border-indigo-300 shadow-indigo-100 bg-white ring-4 ring-indigo-50'}\`}>
                                                        <div className={\`px-4 py-3 flex items-center justify-between border-b \${pData.status === 'accepted' ? 'bg-emerald-100 border-emerald-200' : pData.status === 'rejected' ? 'bg-gray-100 border-gray-200' : 'bg-gradient-to-r from-indigo-100 to-indigo-50 border-indigo-200'}\`}>
                                                            <span className={\`text-[11px] font-black uppercase flex items-center gap-2 \${pData.status === 'pending' || pData.status === 'seller_proposed' ? 'text-indigo-800' : 'text-gray-700'}\`}>
                                                                <Handshake size={14} className={pData.status === 'pending' || pData.status === 'seller_proposed' ? 'text-indigo-600' : ''} /> 
                                                                Negotiation Request
                                                            </span>
                                                            <span className={\`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full text-white shadow-sm \${pData.status === 'accepted' ? 'bg-emerald-500' : pData.status === 'rejected' ? 'bg-gray-400' : 'bg-indigo-600 animate-pulse'}\`}>
                                                                {pData.status}
                                                            </span>
                                                        </div>`;

const msgRenderOriginal = `                                                    <div className={\`w-64 sm:w-80 rounded-2xl overflow-hidden border shadow-sm \${pData.status === 'accepted' ? 'border-green-200 bg-green-50' : pData.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-white'}\`}>
                                                        <div className={\`px-4 py-2 flex items-center justify-between border-b \${pData.status === 'accepted' ? 'bg-green-100 border-green-200' : pData.status === 'rejected' ? 'bg-red-100 border-red-200' : 'bg-blue-50 border-blue-100'}\`}>
                                                            <span className="text-[10px] font-black uppercase flex items-center gap-1 text-gray-700">
                                                                <Handshake size={12} /> Custom Proposal
                                                            </span>
                                                            <span className={\`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white \${pData.status === 'accepted' ? 'bg-green-500' : pData.status === 'rejected' ? 'bg-red-500' : 'bg-blue-500'}\`}>
                                                                {pData.status}
                                                            </span>
                                                        </div>`;

if(txt.includes(msgRenderNew)) {
    txt = txt.replace(msgRenderNew, msgRenderOriginal);
}

// REVERT 2: The buttons (return to basic simple rows but INCLUDE Renegotiate Button)
const buttonsNew = `                                                            {/* ACTIONS */}
                                                            {pData.status === 'pending' && isSeller && (
                                                                <div className="flex flex-col gap-2 mt-4">
                                                                    <button onClick={() => handleAcceptProposal(msg.id, pData)} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"><Check size={14} /> Accept Offer</button>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => handleRenegotiate(msg.id, pData)} className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white shadow rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all">Renegotiate</button>
                                                                        <button onClick={() => handleRejectProposal(msg.id, pData)} className="px-3 py-2 bg-gray-100 hover:bg-red-500 hover:text-white text-gray-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"><X size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pData.status === 'pending' && isBuyer && (
                                                                <div className="mt-3 text-center py-2 px-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">⏳ Waiting for maker...</span>
                                                                </div>
                                                            )}

                                                            {pData.status === 'seller_proposed' && isBuyer && (
                                                                <div className="flex flex-col gap-2 mt-4">
                                                                    <button onClick={() => handleBuyerAcceptsSellerProposal(msg.id, pData)} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all"><Check size={14} /> Accept & Buy</button>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => handleRenegotiate(msg.id, pData)} className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white shadow rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all">Renegotiate</button>
                                                                        <button onClick={() => handleRejectProposal(msg.id, pData)} className="px-3 py-2 bg-gray-100 hover:bg-red-500 hover:text-white text-gray-500 rounded-xl text-xs font-black uppercase tracking-wider transition-all"><X size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pData.status === 'seller_proposed' && isSeller && (
                                                                <div className="mt-3 text-center py-2 px-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">⏳ Waiting for buyer...</span>
                                                                </div>
                                                            )}`;

const buttonsOriginalPlusRenegotiate = `                                                            {/* ACTIONS */}
                                                            {pData.status === 'pending' && isSeller && (
                                                                <div className="flex flex-col gap-2 mt-4">
                                                                    <button onClick={() => handleAcceptProposal(msg.id, pData)} className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all"><Check size={14} /> Accept Offer</button>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => handleRenegotiate(msg.id, pData)} className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all">Renegotiate</button>
                                                                        <button onClick={() => handleRejectProposal(msg.id, pData)} className="px-3 py-2 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 rounded-lg text-xs font-black uppercase tracking-wider transition-all"><X size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pData.status === 'pending' && isBuyer && (
                                                                <div className="mt-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waiting for maker approval...</div>
                                                            )}

                                                            {pData.status === 'seller_proposed' && isBuyer && (
                                                                <div className="flex flex-col gap-2 mt-4">
                                                                    <button onClick={() => handleBuyerAcceptsSellerProposal(msg.id, pData)} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white shadow rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all">Accept & Buy</button>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => handleRenegotiate(msg.id, pData)} className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all">Renegotiate</button>
                                                                        <button onClick={() => handleRejectProposal(msg.id, pData)} className="px-3 py-2 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 rounded-lg text-xs font-black uppercase tracking-wider transition-all"><X size={14} /></button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pData.status === 'seller_proposed' && isSeller && (
                                                                <div className="mt-2 text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waiting for buyer to purchase...</div>
                                                            )}`;

if(txt.includes(buttonsNew)) {
    txt = txt.replace(buttonsNew, buttonsOriginalPlusRenegotiate);
}

fs.writeFileSync(file, txt);
console.log('done reverting UI colors/layout to previous state!');
