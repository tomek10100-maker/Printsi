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
const INFILL_FACTOR = 0.22;

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
  filamentPricePerKgEUR: number;
  filamentPricePerKgPLN: number;
  fileType: 'STL' | '3MF';
  breakdown: {
    material: string;
    filamentPricePerKgPLN: number;
    filamentPricePerKgEUR: number;
    gramsPerUnit: number;
    quantity: number;
    scalePercent: number;
    totalGrams: number;
    totalPricePLN: number;
    totalPriceEUR: number;
  };
};

// ─── STL PARSER ───────────────────────────────────────────────────────────────

function parseSTLVolumeCm3(arrayBuffer: ArrayBuffer): number {
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  let signedVolume = 0;

  // Detect ASCII vs binary
  let isAscii = false;
  try {
    const header = new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(256, bytes.length)));
    if (header.trimStart().toLowerCase().startsWith('solid') && header.includes('facet')) {
      isAscii = true;
    }
  } catch (_) { /* binary */ }

  if (isAscii) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const facetRe = /facet\s+normal\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+outer\s+loop\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi;
    let m;
    while ((m = facetRe.exec(text)) !== null) {
      const [x1,y1,z1] = [+m[1],+m[2],+m[3]];
      const [x2,y2,z2] = [+m[4],+m[5],+m[6]];
      const [x3,y3,z3] = [+m[7],+m[8],+m[9]];
      signedVolume += x1*(y2*z3-y3*z2) + x2*(y3*z1-y1*z3) + x3*(y1*z2-y2*z1);
    }
  } else {
    if (arrayBuffer.byteLength < 84) throw new Error('File too small to be a valid STL.');
    const n = Math.min(dataView.getUint32(80, true), Math.floor((arrayBuffer.byteLength - 84) / 50));
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50;
      const [x1,y1,z1] = [dataView.getFloat32(o+12,true), dataView.getFloat32(o+16,true), dataView.getFloat32(o+20,true)];
      const [x2,y2,z2] = [dataView.getFloat32(o+24,true), dataView.getFloat32(o+28,true), dataView.getFloat32(o+32,true)];
      const [x3,y3,z3] = [dataView.getFloat32(o+36,true), dataView.getFloat32(o+40,true), dataView.getFloat32(o+44,true)];
      signedVolume += x1*(y2*z3-y3*z2) + x2*(y3*z1-y1*z3) + x3*(y1*z2-y2*z1);
    }
  }

  return Math.abs(signedVolume) / 6000.0; // mm³ → cm³
}

// ─── ZIP CENTRAL DIRECTORY READER ─────────────────────────────────────────────

interface ZipEntry {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

function readZipCentralDirectory(bytes: Uint8Array, dv: DataView): ZipEntry[] {
  const entries: ZipEntry[] = [];

  // Find End-of-Central-Directory record by scanning from end
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65536 - 22); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) return entries; // Not a valid ZIP

  const cdOffset = dv.getUint32(eocdOffset + 16, true);
  const cdEntries = dv.getUint16(eocdOffset + 10, true);

  let pos = cdOffset;
  for (let i = 0; i < cdEntries && pos < bytes.length - 46; i++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) break;

    const compressionMethod = dv.getUint16(pos + 10, true);
    const compressedSize = dv.getUint32(pos + 20, true);
    const fileNameLen = dv.getUint16(pos + 28, true);
    const extraLen = dv.getUint16(pos + 30, true);
    const commentLen = dv.getUint16(pos + 32, true);
    const localHeaderOffset = dv.getUint32(pos + 42, true);
    const fileName = new TextDecoder('utf-8').decode(bytes.subarray(pos + 46, pos + 46 + fileNameLen));

    entries.push({ fileName, compressionMethod, compressedSize, localHeaderOffset });
    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a plain ArrayBuffer to satisfy strict TypeScript types
  const plain = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  for (const fmt of ['deflate-raw', 'deflate'] as CompressionFormat[]) {
    try {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(plain));
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      return new Uint8Array(buf);
    } catch (_) { /* try next */ }
  }
  throw new Error('deflate decompression failed');
}

async function getZipEntryData(bytes: Uint8Array, dv: DataView, entry: ZipEntry): Promise<Uint8Array> {
  const lhOff = entry.localHeaderOffset;
  if (dv.getUint32(lhOff, true) !== 0x04034b50) throw new Error('Bad local header');

  const fnLen = dv.getUint16(lhOff + 26, true);
  const exLen = dv.getUint16(lhOff + 28, true);
  const dataStart = lhOff + 30 + fnLen + exLen;

  // Actual compressed size from local header (use central dir value if 0)
  let compSize = dv.getUint32(lhOff + 18, true) || entry.compressedSize;
  const payload = bytes.subarray(dataStart, dataStart + compSize);

  if (entry.compressionMethod === 0) return payload; // stored
  if (entry.compressionMethod === 8) return decompressDeflate(payload);
  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

// ─── 3MF XML VOLUME CALCULATOR ────────────────────────────────────────────────

function calcVolumeFromXml(xmlText: string): number {
  let signedVolume = 0;

  // Parse all vertex positions
  const vertices: [number, number, number][] = [];
  // Match any <vertex ... x="..." y="..." z="..." /> or with spaces
  const vRe = /<vertex\b[^>]*>/gi;
  let vM;
  while ((vM = vRe.exec(xmlText)) !== null) {
    const tag = vM[0];
    const xM = /\bx="([^"]+)"/i.exec(tag) ?? /\bx='([^']+)'/i.exec(tag);
    const yM = /\by="([^"]+)"/i.exec(tag) ?? /\by='([^']+)'/i.exec(tag);
    const zM = /\bz="([^"]+)"/i.exec(tag) ?? /\bz='([^']+)'/i.exec(tag);
    if (xM && yM && zM) {
      vertices.push([parseFloat(xM[1]), parseFloat(yM[1]), parseFloat(zM[1])]);
    }
  }

  if (vertices.length === 0) return 0;

  // Parse all triangles
  const tRe = /<triangle\b[^>]*>/gi;
  let tM;
  while ((tM = tRe.exec(xmlText)) !== null) {
    const tag = tM[0];
    const v1M = /\bv1="(\d+)"/i.exec(tag) ?? /\bv1='(\d+)'/i.exec(tag);
    const v2M = /\bv2="(\d+)"/i.exec(tag) ?? /\bv2='(\d+)'/i.exec(tag);
    const v3M = /\bv3="(\d+)"/i.exec(tag) ?? /\bv3='(\d+)'/i.exec(tag);
    if (v1M && v2M && v3M) {
      const p1 = vertices[+v1M[1]], p2 = vertices[+v2M[1]], p3 = vertices[+v3M[1]];
      if (p1 && p2 && p3) {
        signedVolume += p1[0]*(p2[1]*p3[2]-p3[1]*p2[2]) + p2[0]*(p3[1]*p1[2]-p1[1]*p3[2]) + p3[0]*(p1[1]*p2[2]-p2[1]*p1[2]);
      }
    }
  }

  return Math.abs(signedVolume) / 6000.0; // mm³ → cm³
}

// ─── 3MF PARSER ───────────────────────────────────────────────────────────────

async function parse3MFVolumeCm3(arrayBuffer: ArrayBuffer): Promise<number> {
  const bytes = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);

  const entries = readZipCentralDirectory(bytes, dv);
  console.log('[3MF] ZIP entries found:', entries.map(e => e.fileName));

  let totalVol = 0;

  for (const entry of entries) {
    const fn = entry.fileName.toLowerCase();
    // 3MF spec: geometry is in *.model files (typically 3D/3dmodel.model)
    if (!fn.endsWith('.model') && !fn.endsWith('.xml')) continue;

    try {
      const data = await getZipEntryData(bytes, dv, entry);
      const xml = new TextDecoder('utf-8').decode(data);
      console.log('[3MF] Parsing entry:', entry.fileName, 'size:', xml.length, 'chars');
      const vol = calcVolumeFromXml(xml);
      console.log('[3MF] Volume from entry:', vol, 'cm³');
      totalVol += vol;
    } catch (e) {
      console.warn('[3MF] Failed to parse entry:', entry.fileName, e);
    }
  }

  return totalVol;
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

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
    throw new Error('Instant estimation supports .STL and .3MF files only.');
  }

  let volumeCm3 = 0;

  if (is3MF) {
    volumeCm3 = await parse3MFVolumeCm3(arrayBuffer);
    if (volumeCm3 <= 0) {
      throw new Error('Could not extract 3D mesh from .3MF file. Make sure it contains 3D geometry (not just textures or metadata).');
    }
  } else {
    volumeCm3 = parseSTLVolumeCm3(arrayBuffer);
    if (volumeCm3 <= 0 || !isFinite(volumeCm3)) {
      throw new Error('Could not calculate STL model volume. File may be empty or corrupted.');
    }
  }

  const scaleNum = Math.max(1, parseFloat(String(scalePercentInput)) || 100);
  const qtyNum   = Math.max(1, parseInt(String(quantityInput))       || 1);
  const sf = scaleNum / 100.0;

  const scaledVolumeCm3 = volumeCm3 * sf * sf * sf;
  const density = MATERIAL_DENSITY[material] ?? DEFAULT_DENSITY;
  const pricePerKgPLN = FILAMENT_PRICE_PLN_PER_KG[material] ?? DEFAULT_FILAMENT_PLN_PER_KG;
  const pricePerKgEUR = pricePerKgPLN / EUR_TO_PLN;

  const gramsPerUnit = scaledVolumeCm3 * INFILL_FACTOR * density;
  const totalGrams   = gramsPerUnit * qtyNum;
  const totalPricePLN = (totalGrams / 1000.0) * pricePerKgPLN;
  const totalPriceEUR = totalPricePLN / EUR_TO_PLN;

  const r = (v: number, d = 10) => Math.round(v * d) / d;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    gramsPerUnit:         r(gramsPerUnit),
    totalGrams:           r(totalGrams),
    quantity:             qtyNum,
    scalePercent:         scaleNum,
    volumeCm3:            r2(scaledVolumeCm3),
    estimatedPriceEUR:    r2(totalPriceEUR),
    estimatedPricePLN:    r2(totalPricePLN),
    filamentPricePerKgEUR: r2(pricePerKgEUR),
    filamentPricePerKgPLN: pricePerKgPLN,
    fileType: is3MF ? '3MF' : 'STL',
    breakdown: {
      material:              material || 'PLA',
      filamentPricePerKgPLN: pricePerKgPLN,
      filamentPricePerKgEUR: r2(pricePerKgEUR),
      gramsPerUnit:          r(gramsPerUnit),
      quantity:              qtyNum,
      scalePercent:          scaleNum,
      totalGrams:            r(totalGrams),
      totalPricePLN:         r2(totalPricePLN),
      totalPriceEUR:         r2(totalPriceEUR),
    },
  };
}
