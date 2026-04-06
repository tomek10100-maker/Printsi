const fs = require('fs');
const file = 'c:/Printis/frontend/app/upload/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. In variants.map, calculate the actual stock for the header
const variantMapStart = `                    {variants.map((v, vIdx) => {
                      const price = variantPrices[vIdx];
                      const isMulti = v.layers.length > 1;

                      return (`;

const variantMapStartNew = `                    {variants.map((v, vIdx) => {
                      const price = variantPrices[vIdx];
                      const isMulti = v.layers.length > 1;
                      
                      let calculatedStock = 0;
                      if (v.stockTracking === 'manual') {
                        calculatedStock = parseInt(v.stock) || 0;
                      } else {
                        let maxP = Infinity;
                        let ok = false;
                        for (const l of v.layers) {
                          if (l.filament && l.filament.stock_grams !== null && l.grams) {
                            const g = parseFloat(l.grams);
                            if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                            else { ok = false; break; }
                          } else { ok = false; break; }
                        }
                        calculatedStock = ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
                      }

                      return (`;

if(txt.includes(variantMapStart)) {
    txt = txt.replace(variantMapStart, variantMapStartNew);
} else {
    console.log("variantMapStart not found");
}

// 2. Fix the header rendering qty
const headerQty = `{v.stock ? \` · qty \${v.stock}\` : ''}`;
const newHeaderQty = ` · qty \${calculatedStock}`;

if(txt.includes(headerQty)) {
    txt = txt.replace(headerQty, newHeaderQty);
} else {
    console.log("headerQty not found");
}

// 3. Fix the selected filament display to show remaining grams
const selectedFilamentStr = `                                                {layer.filament.plastic_type} · {fmt(layer.filament.price_per_gram * 1000)}/kg
                                              </p>`;
const selectedFilamentNew = `                                                {layer.filament.plastic_type} · {fmt(layer.filament.price_per_gram * 1000)}/kg · <span className="text-orange-500 font-black">{Math.round(layer.filament.stock_grams || 0)}g in stock</span>
                                              </p>`;

if(txt.includes(selectedFilamentStr)) {
    txt = txt.replace(selectedFilamentStr, selectedFilamentNew);
} else {
    console.log("selectedFilamentStr not found");
}

// 4. Fix the dropdown filament choices to show remaining grams next to price
const dropdownFilamentStr = `                                              <span className="text-[10px] font-bold text-gray-500 flex-shrink-0">{fmt(fil.price_per_gram * 1000)}/kg</span>
                                            </button>`;
const dropdownFilamentNew = `                                              <div className="flex flex-col items-end flex-shrink-0">
                                                <span className="text-[10px] font-bold text-gray-500">{fmt(fil.price_per_gram * 1000)}/kg</span>
                                                <span className="text-[9px] font-black text-orange-500">{Math.round(fil.stock_grams || 0)}g left</span>
                                              </div>
                                            </button>`;

if(txt.includes(dropdownFilamentStr)) {
    txt = txt.replace(dropdownFilamentStr, dropdownFilamentNew);
} else {
    console.log("dropdownFilamentStr not found");
}

fs.writeFileSync(file, txt);
console.log('done fixing qty UI');
