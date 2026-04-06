const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Fix isBase array
const oldIsBase = `                const isBase = lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('depth') ||
                               lowerName.includes('szerokość') || lowerName.includes('wysokość') || lowerName.includes('głębokość') ||
                               lowerName.includes('szerokosc') || lowerName.includes('wysokosc') || lowerName.includes('glebokosc');`;

const newIsBase = `                const isBase = lowerName.includes('width') || lowerName.includes('height') || lowerName.includes('depth') || lowerName.includes('length') ||
                               lowerName.includes('szerokość') || lowerName.includes('wysokość') || lowerName.includes('głębokość') || lowerName.includes('długość') ||
                               lowerName.includes('szerokosc') || lowerName.includes('wysokosc') || lowerName.includes('glebokosc') || lowerName.includes('dlugosc') ||
                               lowerName === 'w' || lowerName === 'h' || lowerName === 'l' || lowerName === 'd';`;

if(txt.includes(oldIsBase)) {
    txt = txt.replace(oldIsBase, newIsBase);
} else {
    console.log("oldIsBase missed");
}

// 2. Add handleScaleChange
const handleDimChangeFn = `    const handleDimChange = (idx: number, newValStr: string) => {
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
    };`;

const newHandleDimChangeFn = `    const handleDimChange = (idx: number, newValStr: string) => {
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

    const handleScaleChange = (newScaleStr: string) => {
        const val = parseFloat(newScaleStr);
        setProposalScale(isNaN(val) ? 0 : val);
        
        if (!isNaN(val) && val > 0) {
            const ratio = val / 100;
            const newDims = [...proposalDims];
            newDims.forEach(d => {
                if (d.isBase && d.originalValue > 0) {
                    d.currentValueStr = (d.originalValue * ratio).toFixed(2).replace(/\\.00$/, '');
                }
            });
            setProposalDims(newDims);
        }
    };`;

if(txt.includes(handleDimChangeFn)) {
    txt = txt.replace(handleDimChangeFn, newHandleDimChangeFn);
} else {
    console.log("handleDimChangeFn missed");
}

// 3. UI Fix for the scale percentage display
const oldScaleUI = `                                                        <div className="flex items-center gap-2">
                                                            <Ruler size={14} className="text-gray-400" />
                                                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dimensions</span>
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full shadow-sm border border-blue-100">
                                                            Scale: {proposalScale.toFixed(2)}%
                                                        </div>`;
                     
const newScaleUI = `                                                        <div className="flex items-center gap-2">
                                                            <Ruler size={14} className="text-gray-400" />
                                                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dimensions</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black uppercase text-gray-500">Scale %:</span>
                                                            <input
                                                                type="number" step="1"
                                                                value={proposalScale || 0}
                                                                onChange={e => handleScaleChange(e.target.value)}
                                                                className="w-16 px-1.5 py-1 bg-white border border-blue-200 focus:border-blue-500 rounded text-xs font-bold text-blue-600 outline-none transition text-center"
                                                            />
                                                        </div>`;

if(txt.includes(oldScaleUI)) {
    txt = txt.replace(oldScaleUI, newScaleUI);
} else {
    console.log("oldScaleUI missed");
}


// 4. FIX PLACEHOLDER IN COLOR NAME
// "placeholder={activeChatData.offers?.color || 'e.g. Red'}"
// Let's replace the placeholder logic for Color Name to make sure it doesn't default to a Hex code,
// and since they said "w color name nie powinno być takiego wypełnienia powinna być nazwa", they want it empty or just the name!
const colorHtmlOld = `                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Color Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={proposalColor}
                                                                        onChange={e => { setProposalColor(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        placeholder={activeChatData.offers?.color || 'e.g. Red'}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition"
                                                                    />
                                                                </div>`;
                                                                
const colorHtmlNew = `                                                                <div>
                                                                    <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Color Name</label>
                                                                    <input
                                                                        type="text"
                                                                        value={proposalColor}
                                                                        onChange={e => { setProposalColor(e.target.value); setSelectedFilamentId(null); setShowCustomFilamentInput(true); }}
                                                                        placeholder="e.g. Red"
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg text-xs font-bold outline-none transition"
                                                                    />
                                                                </div>`;
if(txt.includes(colorHtmlOld)) {
    txt = txt.replace(colorHtmlOld, colorHtmlNew);
} else {
    console.log("colorHtmlOld missed");
}
                     
fs.writeFileSync(file, txt);
console.log('done updating dim logic');
