const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Ensure ProposalDims is populated with default base dimensions if empty!
const parseDimsOld = `    const parseDimensionsAdvanced = (dimStr: string): ParsedDim[] => {
        if (!dimStr) return [];
        return dimStr.split(',').map(part => {
            const match = part.match(/^(.*?):\\s*(\\d+(?:\\.\\d+)?)\\s*(.*)$/);
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
    };`;

const parseDimsNew = `    const parseDimensionsAdvanced = (dimStr: string): ParsedDim[] => {
        let parsed: ParsedDim[] = [];
        if (dimStr) {
            parsed = dimStr.split(',').map(part => {
                const match = part.match(/^(.*?):\\s*(\\d+(?:\\.\\d+)?)\\s*(.*)$/);
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
        
        // If no base dimensions found, add defaults
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
    };`;
if(txt.includes(parseDimsOld)) {
    txt = txt.replace(parseDimsOld, parseDimsNew);
} else {
    console.log("parseDimsOld NOT FOUND");
}

// 2. Add manual add/remove/update logic for dimensions
const handleScaleLogic = `    const handleScaleChange = (newScaleStr: string) => {`;
const addRemoveDimLogic = `    const addProposalDim = () => {
        setProposalDims(prev => [...prev, { name: 'Dodaj Otwór', originalValue: 100, currentValueStr: '10', unit: 'mm', isBase: false }]);
    };
    
    const removeProposalDim = (idx: number) => {
        setProposalDims(prev => prev.filter((_, i) => i !== idx));
    };
    
    const updateProposalDimName = (idx: number, newName: string) => {
        setProposalDims(prev => {
            const next = [...prev];
            next[idx].name = newName;
            return next;
        });
    };

    const handleScaleChange = (newScaleStr: string) => {`;
if(txt.includes(handleScaleLogic)) {
    txt = txt.replace(handleScaleLogic, addRemoveDimLogic);
} else {
    console.log("handleScaleLogic NOT FOUND");
}

// 3. Update the UI for editing dimensions!
const oldDimSection = `                                            {/* DIMENSIONS SECTION */}
                                            {proposalDims.length > 0 && (
                                                <div>
                                                    <div className="flex items-center justify-between mb-3 px-1">
                                                        <div className="flex items-center gap-2">
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
                                            )}`;
                                            
const newDimSection = `                                            {/* DIMENSIONS SECTION */}
                                            <div>
                                                <div className="flex items-center justify-between mb-3 px-1">
                                                    <div className="flex items-center gap-2">
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
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                                    {proposalDims.map((dim, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            {!dim.isBase ? (
                                                                <input 
                                                                    type="text" 
                                                                    value={dim.name}
                                                                    onChange={e => updateProposalDimName(idx, e.target.value)}
                                                                    placeholder="Label" 
                                                                    className="w-24 flex-shrink-0 p-2 bg-white border border-gray-200 rounded-xl font-bold text-[10px] outline-none focus:border-blue-500 transition-all"
                                                                />
                                                            ) : (
                                                                <span className="w-24 flex-shrink-0 text-[10px] font-black uppercase text-gray-500 px-1 truncate" title={dim.name}>
                                                                    {dim.name}
                                                                </span>
                                                            )}
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="number" step="0.1"
                                                                    value={dim.currentValueStr}
                                                                    onChange={e => handleDimChange(idx, e.target.value)}
                                                                    className={\`w-full px-3 py-2 bg-white border \${dim.isBase ? 'border-blue-200 focus:border-blue-500' : 'border-gray-200 focus:border-gray-400'} rounded-lg text-sm font-bold outline-none transition pr-10\`}
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">
                                                                    {dim.unit}
                                                                </span>
                                                            </div>
                                                            {!dim.isBase && (
                                                                <button type="button" onClick={() => removeProposalDim(idx)} className="p-2 rounded-xl bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                                                                    <X size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                                                        <button type="button" onClick={addProposalDim} className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-100 transition-all uppercase tracking-widest">
                                                            + Add custom
                                                        </button>
                                                        <p className="text-[9px] font-bold text-gray-400 text-right leading-relaxed max-w-[120px]">
                                                            Modifying base dimensions scales proportionally.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>`;

if(txt.includes(oldDimSection)) {
    txt = txt.replace(oldDimSection, newDimSection);
} else {
    console.log("oldDimSection NOT FOUND");
}

fs.writeFileSync(file, txt);
console.log('done adding flexible dimensions logic');
