const fs = require('fs');
const file = 'c:/Printis/frontend/app/profile/messages/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Remove the add/remove functions and update handleDimChange / handleScaleChange
const oldLogic = `    const addProposalDim = () => {
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

const newLogic = `    const handleScaleChange = (newScaleStr: string) => {
        const val = parseFloat(newScaleStr);
        setProposalScale(isNaN(val) ? 0 : val);
        
        if (!isNaN(val) && val > 0) {
            const ratio = val / 100;
            const newDims = [...proposalDims];
            newDims.forEach(d => {
                if (d.originalValue > 0) { // ALL dimensions scale proportionally!
                    d.currentValueStr = (d.originalValue * ratio).toFixed(2).replace(/\\.00$/, '');
                }
            });
            setProposalDims(newDims);
        }
    };`;

if(txt.includes(oldLogic)) {
    txt = txt.replace(oldLogic, newLogic);
} else {
    console.log("oldLogic NOT FOUND");
}

// 2. Fix handleDimChange to scale ALL dimensions when a Base dimension is modified
const oldHandleDim = `    const handleDimChange = (idx: number, newValStr: string) => {
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

const newHandleDim = `    const handleDimChange = (idx: number, newValStr: string) => {
        const dim = proposalDims[idx];
        const newDims = [...proposalDims];
        newDims[idx].currentValueStr = newValStr;
        const numVal = parseFloat(newValStr);

        if (dim.isBase && !isNaN(numVal) && numVal > 0 && dim.originalValue > 0) {
            const scale = numVal / dim.originalValue;
            setProposalScale(Math.round(scale * 10000) / 100);

            newDims.forEach(d => {
                if (d !== newDims[idx] && d.originalValue > 0) {
                    // Everyone scales if a base dimension is touched
                    d.currentValueStr = (d.originalValue * scale).toFixed(2).replace(/\\.00$/, '');
                }
            });
        }
        setProposalDims(newDims);
    };`;

if(txt.includes(oldHandleDim)) {
    txt = txt.replace(oldHandleDim, newHandleDim);
} else {
    console.log("oldHandleDim NOT FOUND");
}


// 3. Fix the UI (remove add/remove buttons, edit label)
const oldUI = `                                            {/* DIMENSIONS SECTION */}
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

const newUI = `                                            {/* DIMENSIONS SECTION */}
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
                                                            <span className={\`w-24 flex-shrink-0 text-[10px] font-black uppercase px-1 truncate \${dim.isBase ? 'text-gray-500' : 'text-purple-500'}\`} title={dim.name}>
                                                                {dim.name}
                                                            </span>
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="number" step="0.1"
                                                                    value={dim.currentValueStr}
                                                                    onChange={e => handleDimChange(idx, e.target.value)}
                                                                    className={\`w-full px-3 py-2 bg-white border \${dim.isBase ? 'border-blue-200 focus:border-blue-500' : 'border-gray-200 focus:border-purple-400'} rounded-lg text-sm font-bold outline-none transition pr-10\`}
                                                                />
                                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">
                                                                    {dim.unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-center items-center mt-3 pt-3 border-t border-gray-200">
                                                        <p className="text-[9px] font-bold text-gray-400 text-center leading-relaxed">
                                                            Scaling affects all dimensions. You can manually edit non-base dimensions independently.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>`;

if(txt.includes(oldUI)) {
    txt = txt.replace(oldUI, newUI);
} else {
    console.log("oldUI NOT FOUND");
}

fs.writeFileSync(file, txt);
console.log('done fixing ultimate logic');
