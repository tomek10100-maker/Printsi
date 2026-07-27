// ─── 3D MODEL COST ESTIMATOR (STL & 3MF - PURE JS) ──────────────

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
const EUR_TO_PLN = 4.25;
const INFILL_FACTOR = 0.22; // 22% typical infill

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
  gramsPerUnit: number;
  totalGrams: number;
  quantity: number;
  scalePercent: number;
  volumeCm3: number;
  estimatedPriceEUR: number;
  estimatedPricePLN: number;
  fileType: 'STL' | '3MF';
  breakdown: {
    material: string;
    filamentPricePerKgPLN: number;
    pricePerGramPLN: number;
    gramsPerUnit: number;
    quantity: number;
    scalePercent: number;
    totalGrams: number;
    totalPricePLN: number;
    totalPriceEUR: number;
  };
};

/**
 * Calculates model volume from binary or ASCII STL
 */
function parseSTLVolumeCm3(arrayBuffer: ArrayBuffer): { volumeCm3: number; triangles: number } {
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  let isAscii = false;
  try {
    const headerStr = new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(80, bytes.length)));
    if (headerStr.trimStart().toLowerCase().startsWith('solid')) {
      const sample = new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(bytes.length, 2000)));
      if (sample.includes('facet') || sample.includes('FACET') || sample.includes('vertex')) {
        isAscii = true;
      }
    }
  } catch (e) {
    isAscii = false;
  }

  let signedVolume = 0;
  let triangleCount = 0;

  if (isAscii) {
    const text = new TextDecoder('utf-8').decode(bytes);
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
    if (arrayBuffer.byteLength < 84) throw new Error('File too small to be a valid STL.');
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
  return { volumeCm3: volumeMm3 / 1000.0, triangles: triangleCount };
}

/**
 * Calculates model volume from 3MF ZIP archive
 */
async function parse3MFVolumeCm3(arrayBuffer: ArrayBuffer): Promise<{ volumeCm3: number; triangles: number }> {
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  let offset = 0;
  let modelXmlText = '';

  while (offset < bytes.length - 30) {
    if (dataView.getUint32(offset, true) !== 0x04034b50) {
      offset++;
      continue;
    }
    const compression = dataView.getUint16(offset + 8, true);
    const compSize = dataView.getUint32(offset + 18, true);
    const fileNameLen = dataView.getUint16(offset + 26, true);
    const extraLen = dataView.getUint16(offset + 28, true);
    const fileName = new TextDecoder('utf-8').decode(bytes.subarray(offset + 30, offset + 30 + fileNameLen));

    const payloadStart = offset + 30 + fileNameLen + extraLen;

    if (fileName.toLowerCase().endsWith('.model') || fileName.toLowerCase().includes('3dmodel')) {
      const payloadBytes = bytes.subarray(payloadStart, payloadStart + compSize);
      if (compression === 0) {
        modelXmlText = new TextDecoder('utf-8').decode(payloadBytes);
      } else if (compression === 8 && typeof DecompressStream !== 'undefined') {
        try {
          const ds = new DecompressStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(payloadBytes);
          writer.close();
          const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
          modelXmlText = new TextDecoder('utf-8').decode(decompressedBuffer);
        } catch (e) {
          console.warn("3MF decompression failed:", e);
        }
      }
      if (modelXmlText) break;
    }
    offset = payloadStart + compSize;
  }

  if (!modelXmlText) {
    throw new Error('Could not read 3D geometry from .3MF package.');
  }

  const vertices: Array<[number, number, number]> = [];
  const vertexRegex = /<vertex\s+x=["']([\d.eE+\-]+)["']\s+y=["']([\d.eE+\-]+)["']\s+z=["']([\d.eE+\-]+)["']/gi;
  let vMatch;
  while ((vMatch = vertexRegex.exec(modelXmlText)) !== null) {
    vertices.push([parseFloat(vMatch[1]), parseFloat(vMatch[2]), parseFloat(vMatch[3])]);
  }

  if (vertices.length === 0) {
    throw new Error('No 3D vertices found in .3MF file.');
  }

  let signedVolume = 0;
  let triangleCount = 0;
  const triangleRegex = /<triangle\s+v1=["'](\d+)["']\s+v2=["'](\d+)["']\s+v3=["'](\d+)["']/gi;
  let tMatch;
  while ((tMatch = triangleRegex.exec(modelXmlText)) !== null) {
    const v1Idx = parseInt(tMatch[1]), v2Idx = parseInt(tMatch[2]), v3Idx = parseInt(tMatch[3]);
    const p1 = vertices[v1Idx], p2 = vertices[v2Idx], p3 = vertices[v3Idx];
    if (p1 && p2 && p3) {
      signedVolume += (p1[0] * (p2[1] * p3[2] - p3[1] * p2[2]) + p2[0] * (p3[1] * p1[2] - p1[1] * p3[2]) + p3[0] * (p1[1] * p2[2] - p2[1] * p1[2]));
      triangleCount++;
    }
  }

  const volumeMm3 = Math.abs(signedVolume) / 6.0;
  return { volumeCm3: volumeMm3 / 1000.0, triangles: triangleCount };
}

export async function calculate3DModelQuoteFromBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  material: string,
  scalePercentInput: number | string = 100,
  quantityInput: number | string = 1
): Promise<QuoteResult> {
  const lowerName = fileName.toLowerCase();
  const is3MF = lowerName.endsWith('.3mf');
  const isSTL = lowerName.endsWith('.stl');

  if (!isSTL && !is3MF) {
    throw new Error('Instant estimation supports .STL and .3MF files.');
  }

  let volumeCm3 = 0;

  if (is3MF) {
    const res = await parse3MFVolumeCm3(arrayBuffer);
    volumeCm3 = res.volumeCm3;
  } else {
    const res = parseSTLVolumeCm3(arrayBuffer);
    volumeCm3 = res.volumeCm3;
  }

  if (volumeCm3 <= 0 || !isFinite(volumeCm3)) {
    throw new Error('Could not calculate 3D model volume. File may be empty or corrupted.');
  }

  const scaleNum = parseFloat(String(scalePercentInput)) || 100;
  const qtyNum = Math.max(1, parseInt(String(quantityInput)) || 1);
  const scaleFactor = Math.max(0.01, scaleNum / 100.0);

  // Scaled 3D volume (cube of scale factor)
  const scaledVolumeCm3 = volumeCm3 * (scaleFactor * scaleFactor * scaleFactor);

  const density = MATERIAL_DENSITY[material] ?? DEFAULT_DENSITY;
  const filamentPricePerKg = FILAMENT_PRICE_PLN_PER_KG[material] ?? DEFAULT_FILAMENT_PLN_PER_KG;
  const pricePerGramPLN = filamentPricePerKg / 1000.0;

  // Grams per single unit (with 22% infill)
  const plasticVolumePerUnitCm3 = scaledVolumeCm3 * INFILL_FACTOR;
  const gramsPerUnit = plasticVolumePerUnitCm3 * density;
  const totalGrams = gramsPerUnit * qtyNum;

  // Simple direct formula: Total Grams * Price Per Gram
  const totalPricePLN = totalGrams * pricePerGramPLN;
  const totalPriceEUR = totalPricePLN / EUR_TO_PLN;

  return {
    gramsPerUnit: Math.round(gramsPerUnit * 10) / 10,
    totalGrams: Math.round(totalGrams * 10) / 10,
    quantity: qtyNum,
    scalePercent: scaleNum,
    volumeCm3: Math.round(scaledVolumeCm3 * 100) / 100,
    estimatedPriceEUR: Math.round(totalPriceEUR * 100) / 100,
    estimatedPricePLN: Math.round(totalPricePLN * 100) / 100,
    fileType: is3MF ? '3MF' : 'STL',
    breakdown: {
      material: material || 'PLA',
      filamentPricePerKgPLN: filamentPricePerKg,
      pricePerGramPLN: Math.round(pricePerGramPLN * 1000) / 1000,
      gramsPerUnit: Math.round(gramsPerUnit * 10) / 10,
      quantity: qtyNum,
      scalePercent: scaleNum,
      totalGrams: Math.round(totalGrams * 10) / 10,
      totalPricePLN: Math.round(totalPricePLN * 100) / 100,
      totalPriceEUR: Math.round(totalPriceEUR * 100) / 100,
    },
  };
}
