// ─── STL QUOTE CALCULATOR (PURE JS - BROWSER & NODE COMPATIBLE) ──────────────

const FILAMENT_PRICE_PLN_PER_KG: Record<string, number> = {
  PLA: 105,
  'PLA+': 108,
  PETG: 117,
  ABS: 112,
  ASA: 145,
  TPU: 162,
  'PLA-CF': 205,
  'PETG-CF': 205,
  PA: 255,
  PC: 270,
  HIPS: 122,
  PVA: 390,
};
const DEFAULT_FILAMENT_PLN_PER_KG = 110;

const MACHINE_HOURLY_RATE_PLN = 8.0;
const STARTUP_FEE_PLN = 5.0;
const EUR_TO_PLN = 4.25;
const INFILL_FACTOR = 0.22;
const VOLUMETRIC_THROUGHPUT_CM3_PER_HOUR = 18;

const MATERIAL_DENSITY: Record<string, number> = {
  PLA: 1.24,
  'PLA+': 1.24,
  PETG: 1.27,
  ABS: 1.05,
  ASA: 1.07,
  TPU: 1.21,
  'PLA-CF': 1.30,
  'PETG-CF': 1.30,
  PA: 1.14,
  PC: 1.20,
  HIPS: 1.04,
  PVA: 1.23,
};
const DEFAULT_DENSITY = 1.24;

export type QuoteResult = {
  estimatedGrams: number;
  printTimeMinutes: number;
  volumeCm3: number;
  estimatedPriceEUR: number;
  estimatedPricePLN: number;
  breakdown: {
    filamentGrams: number;
    filamentCostEUR: number;
    filamentCostPLN: number;
    machineCostEUR: number;
    machineCostPLN: number;
    startupCostEUR: number;
    startupCostPLN: number;
    material: string;
    filamentPricePerKgPLN: number;
  };
};

export function calculateSTLQuoteFromBuffer(arrayBuffer: ArrayBuffer, fileName: string, material: string): QuoteResult {
  if (arrayBuffer.byteLength < 84) {
    throw new Error('File is too small to be a valid 3D STL file.');
  }

  const dataView = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  // Check ASCII vs Binary
  let isAscii = false;
  const headerStr = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(80, bytes.length)));
  if (headerStr.trimStart().toLowerCase().startsWith('solid')) {
    const sample = new TextDecoder('utf8').decode(bytes.subarray(0, Math.min(bytes.length, 2000)));
    if (sample.includes('facet') || sample.includes('FACET') || sample.includes('vertex')) {
      isAscii = true;
    }
  }

  let signedVolume = 0;
  let triangleCount = 0;

  if (isAscii) {
    const text = new TextDecoder('utf8').decode(bytes);
    const facetRegex = /facet\s+normal\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+outer\s+loop\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi;
    let match;
    while ((match = facetRegex.exec(text)) !== null) {
      const x1 = parseFloat(match[1]), y1 = parseFloat(match[2]), z1 = parseFloat(match[3]);
      const x2 = parseFloat(match[4]), y2 = parseFloat(match[5]), z2 = parseFloat(match[6]);
      const x3 = parseFloat(match[7]), y3 = parseFloat(match[8]), z3 = parseFloat(match[9]);
      signedVolume += (x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1));
      triangleCount++;
    }
  } else {
    const numTriangles = dataView.getUint32(80, true);
    const maxPossibleTriangles = Math.floor((arrayBuffer.byteLength - 84) / 50);
    const totalTris = Math.min(numTriangles, maxPossibleTriangles);
    
    for (let i = 0; i < totalTris; i++) {
      const offset = 84 + i * 50;
      const x1 = dataView.getFloat32(offset + 12, true);
      const y1 = dataView.getFloat32(offset + 16, true);
      const z1 = dataView.getFloat32(offset + 20, true);
      const x2 = dataView.getFloat32(offset + 24, true);
      const y2 = dataView.getFloat32(offset + 28, true);
      const z2 = dataView.getFloat32(offset + 32, true);
      const x3 = dataView.getFloat32(offset + 36, true);
      const y3 = dataView.getFloat32(offset + 40, true);
      const z3 = dataView.getFloat32(offset + 44, true);
      signedVolume += (x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1));
      triangleCount++;
    }
  }

  const volumeMm3 = Math.abs(signedVolume) / 6.0;
  const volumeCm3 = volumeMm3 / 1000.0;

  if (volumeCm3 <= 0 || !isFinite(volumeCm3)) {
    throw new Error('Could not calculate STL model volume. File may be empty or corrupted.');
  }

  const density = MATERIAL_DENSITY[material] ?? DEFAULT_DENSITY;
  const filamentPricePerKg = FILAMENT_PRICE_PLN_PER_KG[material] ?? DEFAULT_FILAMENT_PLN_PER_KG;

  const plasticVolumeCm3 = volumeCm3 * INFILL_FACTOR;
  const estimatedGrams = plasticVolumeCm3 * density;

  const printTimeHours = plasticVolumeCm3 / VOLUMETRIC_THROUGHPUT_CM3_PER_HOUR;
  const printTimeMinutes = Math.round(printTimeHours * 60);

  const filamentCostPLN = (estimatedGrams / 1000) * filamentPricePerKg;
  const machineCostPLN = printTimeHours * MACHINE_HOURLY_RATE_PLN;
  const startupCostPLN = STARTUP_FEE_PLN;
  const totalPLN = filamentCostPLN + machineCostPLN + startupCostPLN;

  const totalEUR = totalPLN / EUR_TO_PLN;
  const filamentCostEUR = filamentCostPLN / EUR_TO_PLN;
  const machineCostEUR = machineCostPLN / EUR_TO_PLN;
  const startupCostEUR = startupCostPLN / EUR_TO_PLN;

  return {
    estimatedGrams: Math.round(estimatedGrams * 10) / 10,
    printTimeMinutes: Math.max(1, printTimeMinutes),
    volumeCm3: Math.round(volumeCm3 * 100) / 100,
    estimatedPriceEUR: Math.round(totalEUR * 100) / 100,
    estimatedPricePLN: Math.round(totalPLN * 100) / 100,
    breakdown: {
      filamentGrams: Math.round(estimatedGrams * 10) / 10,
      filamentCostEUR: Math.round(filamentCostEUR * 100) / 100,
      filamentCostPLN: Math.round(filamentCostPLN * 100) / 100,
      machineCostEUR: Math.round(machineCostEUR * 100) / 100,
      machineCostPLN: Math.round(machineCostPLN * 100) / 100,
      startupCostEUR: Math.round(startupCostEUR * 100) / 100,
      startupCostPLN: Math.round(startupCostPLN * 100) / 100,
      material: material || 'PLA',
      filamentPricePerKgPLN: filamentPricePerKg,
    },
  };
}
