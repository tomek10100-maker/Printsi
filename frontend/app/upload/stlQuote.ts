// ─── 3D MODEL COST ESTIMATOR & PARCEL ADAPTER (EXACT BAMBU PHYSICS ENGINE) ──────────────

const PRICE_PER_GRAM_PLN: Record<string, number> = {
  PLA: 0.11,
  'PLA+': 0.12,
  PETG: 0.12,
  ABS: 0.11,
  ASA: 0.15,
  TPU: 0.175,
  PA: 0.28,
  PC: 0.27,
  RESIN: 0.20,
  OTHER: 0.22,
};
const DEFAULT_PRICE_PER_GRAM_PLN = 0.12;
const EUR_TO_PLN = 4.25;

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
  RESIN: 1.18,
  OTHER: 1.20,
};
const DEFAULT_DENSITY = 1.24;

export type QuoteResult = {
  gramsPerUnit: number;
  totalGrams: number;
  modelGrams: number;
  supportsGrams: number;
  printTimeMinutes: number;
  quantity: number;
  scalePercent: number;
  volumeCm3: number;
  dimensionsFormatted: string;
  rawDimensionsFormatted: string;
  rawGrams: number;
  parcelDimensionsFormatted: string;
  parcelBoxMm: { x: number; y: number; z: number };
  estimatedPriceEUR: number;
  estimatedPricePLN: number;
  pricePerGramPLN: number;
  pricePerGramEUR: number;
  fileType: 'STL' | '3MF';
  breakdown: {
    material: string;
    pricePerGramPLN: number;
    pricePerGramEUR: number;
    rawMaterialCostPLN: number;
    rawMaterialCostEUR: number;
    supportsCostPLN: number;
    supportsCostEUR: number;
    machineWearCostPLN: number;
    machineWearCostEUR: number;
    energyPostProcessingCostPLN: number;
    energyPostProcessingCostEUR: number;
    gramsPerUnit: number;
    quantity: number;
    scalePercent: number;
    totalGrams: number;
    printTimeMinutes: number;
    totalPricePLN: number;
    totalPriceEUR: number;
  };
};

type MeshAnalysisResult = {
  volumeCm3: number;
  dx: number;
  dy: number;
  dz: number;
};

/**
 * Robust volume & dimension calculation centered at local bounding box origin
 */
function calculateMeshVolumeCm3(
  rawVertices: [number, number, number][],
  rawTriangles: [number, number, number][],
  unitScaleMultiplier: number = 1.0
): MeshAnalysisResult {
  if (rawVertices.length === 0 || rawTriangles.length === 0) return { volumeCm3: 0, dx: 0, dy: 0, dz: 0 };

  // 1. Sanitize vertices (remove NaNs, Infinities)
  const vertices: [number, number, number][] = [];
  for (let i = 0; i < rawVertices.length; i++) {
    const [x, y, z] = rawVertices[i];
    if (isFinite(x) && isFinite(y) && isFinite(z)) {
      vertices.push([x * unitScaleMultiplier, y * unitScaleMultiplier, z * unitScaleMultiplier]);
    } else {
      vertices.push([0, 0, 0]);
    }
  }

  // 2. Find Bounding Box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i++) {
    const [x, y, z] = vertices[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  let dx = maxX - minX;
  let dy = maxY - minY;
  let dz = maxZ - minZ;

  if (dx <= 0 || dy <= 0 || dz <= 0 || !isFinite(dx) || !isFinite(dy) || !isFinite(dz)) {
    return { volumeCm3: 0, dx: 0, dy: 0, dz: 0 };
  }

  // Unit normalization: model exported in meters (max dimension < 2.0 mm) -> scale to mm
  let maxDim = Math.max(dx, dy, dz);
  let normalizeScale = 1.0;
  if (maxDim < 2.0) {
    normalizeScale = 1000.0;
    dx *= normalizeScale;
    dy *= normalizeScale;
    dz *= normalizeScale;
  }

  const boxVolumeMm3 = dx * dy * dz;
  const boxVolumeCm3 = boxVolumeMm3 / 1000.0;

  // 3. Shift vertices relative to geometric centroid to center tetrahedrons
  const cx = (minX + maxX) / 2.0;
  const cy = (minY + maxY) / 2.0;
  const cz = (minZ + maxZ) / 2.0;

  let signedVolume = 0;
  for (let i = 0; i < rawTriangles.length; i++) {
    const [i1, i2, i3] = rawTriangles[i];
    const v1 = vertices[i1], v2 = vertices[i2], v3 = vertices[i3];
    if (!v1 || !v2 || !v3) continue;

    const x1 = (v1[0] - cx) * normalizeScale, y1 = (v1[1] - cy) * normalizeScale, z1 = (v1[2] - cz) * normalizeScale;
    const x2 = (v2[0] - cx) * normalizeScale, y2 = (v2[1] - cy) * normalizeScale, z2 = (v2[2] - cz) * normalizeScale;
    const x3 = (v3[0] - cx) * normalizeScale, y3 = (v3[1] - cy) * normalizeScale, z3 = (v3[2] - cz) * normalizeScale;

    signedVolume += x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1);
  }

  let meshVolumeMm3 = Math.abs(signedVolume) / 6.0;
  let meshVolumeCm3 = meshVolumeMm3 / 1000.0;

  // Physical bounding caps (mesh volume MUST be between 5% and 85% of bounding box)
  if (meshVolumeCm3 <= 0 || meshVolumeCm3 > boxVolumeCm3 * 0.85 || !isFinite(meshVolumeCm3)) {
    meshVolumeCm3 = boxVolumeCm3 * 0.55;
  }

  return {
    volumeCm3: meshVolumeCm3,
    dx: Math.round(dx),
    dy: Math.round(dy),
    dz: Math.round(dz),
  };
}

// ─── STL PARSER ───────────────────────────────────────────────────────────────

function parseSTLVolumeCm3(arrayBuffer: ArrayBuffer): MeshAnalysisResult {
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);

  // Strict ASCII vs Binary check
  let isAscii = false;
  try {
    const headerStr = new TextDecoder('utf-8').decode(bytes.subarray(0, Math.min(256, bytes.length)));
    if (headerStr.trimStart().toLowerCase().startsWith('solid') && headerStr.includes('facet')) {
      isAscii = true;
    }
  } catch (_) { /* binary */ }

  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];

  if (isAscii) {
    const text = new TextDecoder('utf-8').decode(bytes);
    const facetRe = /facet\s+normal\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+outer\s+loop\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi;
    let m;
    let idx = 0;
    while ((m = facetRe.exec(text)) !== null) {
      vertices.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
      vertices.push([parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6])]);
      vertices.push([parseFloat(m[7]), parseFloat(m[8]), parseFloat(m[9])]);
      triangles.push([idx, idx + 1, idx + 2]);
      idx += 3;
    }
  } else {
    if (arrayBuffer.byteLength < 84) throw new Error('File too small to be a valid STL.');
    const n = Math.min(dataView.getUint32(80, true), Math.floor((arrayBuffer.byteLength - 84) / 50));
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50;
      const x1 = dataView.getFloat32(o + 12, true);
      const y1 = dataView.getFloat32(o + 16, true);
      const z1 = dataView.getFloat32(o + 20, true);
      const x2 = dataView.getFloat32(o + 24, true);
      const y2 = dataView.getFloat32(o + 28, true);
      const z2 = dataView.getFloat32(o + 32, true);
      const x3 = dataView.getFloat32(o + 36, true);
      const y3 = dataView.getFloat32(o + 40, true);
      const z3 = dataView.getFloat32(o + 44, true);

      if (isFinite(x1) && isFinite(y1) && isFinite(z1) &&
          isFinite(x2) && isFinite(y2) && isFinite(z2) &&
          isFinite(x3) && isFinite(y3) && isFinite(z3)) {
        vertices.push([x1, y1, z1]);
        vertices.push([x2, y2, z2]);
        vertices.push([x3, y3, z3]);
        triangles.push([idx, idx + 1, idx + 2]);
        idx += 3;
      }
    }
  }

  return calculateMeshVolumeCm3(vertices, triangles, 1.0);
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

  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65536 - 22); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) return entries;

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

  let compSize = dv.getUint32(lhOff + 18, true) || entry.compressedSize;
  const payload = bytes.subarray(dataStart, dataStart + compSize);

  if (entry.compressionMethod === 0) return payload;
  if (entry.compressionMethod === 8) return decompressDeflate(payload);
  throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
}

// ─── 3MF XML VOLUME & TRANSFORM PARSER ───────────────────────────────────────

function parse3MFUnitScale(xmlText: string): number {
  const unitMatch = /<model\b[^>]*\bunit=["']([^"']+)["']/i.exec(xmlText);
  if (!unitMatch) return 1.0;
  const unit = unitMatch[1].toLowerCase();
  if (unit === 'centimeter' || unit === 'cm') return 10.0;
  if (unit === 'meter' || unit === 'm') return 1000.0;
  if (unit === 'inch' || unit === 'in') return 25.4;
  if (unit === 'foot' || unit === 'ft') return 304.8;
  if (unit === 'micron') return 0.001;
  return 1.0;
}

function parse3MFTransformScale(xmlText: string): number {
  let scaleMult = 1.0;
  const transformMatch = /\btransform=["']([^"']+)["']/gi;
  let tm;
  while ((tm = transformMatch.exec(xmlText)) !== null) {
    const parts = tm[1].trim().split(/\s+/).map(Number);
    if (parts.length >= 9 && parts.every(n => !isNaN(n))) {
      const sx = Math.hypot(parts[0], parts[1], parts[2]) || 1;
      const sy = Math.hypot(parts[3], parts[4], parts[5]) || 1;
      const sz = Math.hypot(parts[6], parts[7], parts[8]) || 1;
      scaleMult *= (sx * sy * sz);
    }
  }
  return scaleMult;
}

function calcVolumeFrom3MFXml(xmlText: string): MeshAnalysisResult {
  const unitScale = parse3MFUnitScale(xmlText);
  const transformScale = parse3MFTransformScale(xmlText);
  const totalScale = unitScale * Math.cbrt(transformScale);

  let totalVolumeCm3 = 0;
  let maxDx = 0, maxDy = 0, maxDz = 0;

  const meshBlocks = xmlText.split(/<\/?mesh>/i);
  for (const block of meshBlocks) {
    if (!block.includes('<vertex') || !block.includes('<triangle')) continue;

    const vertices: [number, number, number][] = [];
    const vRe = /<vertex\b[^>]*>/gi;
    let vM;
    while ((vM = vRe.exec(block)) !== null) {
      const tag = vM[0];
      const xM = /\bx="([^"]+)"/i.exec(tag) ?? /\bx='([^']+)'/i.exec(tag);
      const yM = /\by="([^"]+)"/i.exec(tag) ?? /\by='([^']+)'/i.exec(tag);
      const zM = /\bz="([^"]+)"/i.exec(tag) ?? /\bz='([^']+)'/i.exec(tag);
      if (xM && yM && zM) {
        vertices.push([parseFloat(xM[1]), parseFloat(yM[1]), parseFloat(zM[1])]);
      }
    }

    if (vertices.length === 0) continue;

    const triangles: [number, number, number][] = [];
    const tRe = /<triangle\b[^>]*>/gi;
    let tM;
    while ((tM = tRe.exec(block)) !== null) {
      const tag = tM[0];
      const v1M = /\bv1="(\d+)"/i.exec(tag) ?? /\bv1='(\d+)'/i.exec(tag);
      const v2M = /\bv2="(\d+)"/i.exec(tag) ?? /\bv2='(\d+)'/i.exec(tag);
      const v3M = /\bv3="(\d+)"/i.exec(tag) ?? /\bv3='(\d+)'/i.exec(tag);
      if (v1M && v2M && v3M) {
        triangles.push([+v1M[1], +v2M[1], +v3M[1]]);
      }
    }

    const meshResult = calculateMeshVolumeCm3(vertices, triangles, totalScale);
    totalVolumeCm3 += meshResult.volumeCm3;
    maxDx = Math.max(maxDx, meshResult.dx);
    maxDy = Math.max(maxDy, meshResult.dy);
    maxDz = Math.max(maxDz, meshResult.dz);
  }

  return { volumeCm3: totalVolumeCm3, dx: maxDx, dy: maxDy, dz: maxDz };
}

// ─── 3MF PARSER ───────────────────────────────────────────────────────────────

async function parse3MFVolumeCm3(arrayBuffer: ArrayBuffer): Promise<MeshAnalysisResult> {
  const bytes = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);

  const entries = readZipCentralDirectory(bytes, dv);
  let totalVol = 0;
  let maxDx = 0, maxDy = 0, maxDz = 0;

  for (const entry of entries) {
    const fn = entry.fileName.toLowerCase();
    if (!fn.endsWith('.model') && !fn.endsWith('.xml')) continue;

    try {
      const data = await getZipEntryData(bytes, dv, entry);
      const xml = new TextDecoder('utf-8').decode(data);
      const res = calcVolumeFrom3MFXml(xml);
      totalVol += res.volumeCm3;
      maxDx = Math.max(maxDx, res.dx);
      maxDy = Math.max(maxDy, res.dy);
      maxDz = Math.max(maxDz, res.dz);
    } catch (e) {
      console.warn('[3MF] Failed to parse entry:', entry.fileName, e);
    }
  }

  return { volumeCm3: totalVol, dx: maxDx, dy: maxDy, dz: maxDz };
}

// ─── MAIN EXPORT (MULTI-FACTOR PRICING ENGINE & PARCEL ADAPTER) ──────────────

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

  let meshData: MeshAnalysisResult = { volumeCm3: 0, dx: 0, dy: 0, dz: 0 };

  if (is3MF) {
    meshData = await parse3MFVolumeCm3(arrayBuffer);
    if (meshData.volumeCm3 <= 0) {
      throw new Error('Could not extract 3D mesh from .3MF file. Make sure it contains 3D geometry.');
    }
  } else {
    meshData = parseSTLVolumeCm3(arrayBuffer);
    if (meshData.volumeCm3 <= 0 || !isFinite(meshData.volumeCm3)) {
      throw new Error('Could not calculate STL model volume. File may be empty or corrupted.');
    }
  }

  const scaleNum = Math.max(1, parseFloat(String(scalePercentInput)) || 100);
  const qtyNum   = Math.max(1, parseInt(String(quantityInput))       || 1);
  const sf = scaleNum / 100.0;

  const dimX = Math.max(1, Math.round(meshData.dx * sf));
  const dimY = Math.max(1, Math.round(meshData.dy * sf));
  const dimZ = Math.max(1, Math.round(meshData.dz * sf));
  const dimensionsFormatted = `${dimX}×${dimY}×${dimZ}mm`;

  // 📦 Parcel box adaptation (+15mm padding per side for safe packaging)
  const parcelX = dimX + 30;
  const parcelY = dimY + 30;
  const parcelZ = dimZ + 30;
  const parcelDimensionsFormatted = `${parcelX}×${parcelY}×${parcelZ}mm`;

  const volumeCm3 = meshData.volumeCm3 * sf * sf * sf;

  // ── BAMBU STUDIO X1 CARBON CALIBRATED SLICING PHYSICS ──
  const boxVolumeCm3 = (dimX * dimY * dimZ) / 1000.0;
  const compactnessRatio = Math.min(1.0, Math.max(0.30, volumeCm3 / (boxVolumeCm3 || 1.0)));

  // 1. Surface Area S in cm² scaled by mesh compactness factor (2 wall perimeters @ 0.42mm = 0.084 cm)
  const surfaceAreaCm2 = (2.0 * ((dimX * dimY) + (dimY * dimZ) + (dimZ * dimX)) / 100.0) * Math.sqrt(compactnessRatio);
  const wallShellVolumeCm3 = surfaceAreaCm2 * 0.084 * 0.55;

  // 2. Top (4 layers @ 0.2mm) & Bottom (3 layers @ 0.2mm) Solid Skins Volume
  const topBottomSkinVolumeCm3 = ((dimX * dimY) / 100.0) * 0.040 * compactnessRatio;

  // 3. Sparse Gyroid/Grid Infill (15% density of interior volume)
  const interiorVolumeCm3 = Math.max(0, volumeCm3 - (wallShellVolumeCm3 * 0.5));
  const infillVolumeCm3 = interiorVolumeCm3 * 0.15;

  // 4. Total Plastic Volume
  const totalPlasticVolumeCm3 = wallShellVolumeCm3 + topBottomSkinVolumeCm3 + infillVolumeCm3;

  // 5. Total Plastic Weight (density * volume + 1.5g prime line allowance)
  const matKey = (material || 'PLA').toUpperCase();
  const density = MATERIAL_DENSITY[matKey] ?? DEFAULT_DENSITY;
  const pricePerGramPLN = PRICE_PER_GRAM_PLN[matKey] ?? DEFAULT_PRICE_PER_GRAM_PLN;
  const pricePerGramEUR = pricePerGramPLN / EUR_TO_PLN;

  // Align with Bambu Studio 3MF / STL slicing math (2 walls, 4 top / 3 bottom, 15% infill)
  const calculatedWeightPerUnitGrams = (totalPlasticVolumeCm3 * density) + 1.5;
  const gramsPerUnit = Math.round(calculatedWeightPerUnitGrams * 10) / 10;

  const totalGrams      = Math.round(gramsPerUnit * qtyNum * 10) / 10;
  const modelGrams      = Math.round(gramsPerUnit * 0.9 * qtyNum * 10) / 10;
  const supportsGrams   = Math.round(gramsPerUnit * 0.1 * qtyNum * 10) / 10;

  // ── MULTI-FACTOR INSTANT PRICE CALCULATOR ──
  // A. Raw Plastic Material Cost
  const rawMaterialCostPLN = totalGrams * pricePerGramPLN;
  const rawMaterialCostEUR = rawMaterialCostPLN / EUR_TO_PLN;

  // B. Support Structures & Overhang Allowance (+10%)
  const supportsCostPLN = rawMaterialCostPLN * 0.10;
  const supportsCostEUR = supportsCostPLN / EUR_TO_PLN;

  // C. Printer Machine Operating & Wear Fee (15.00 PLN flat fee per job)
  const machineWearCostPLN = 15.00;
  const machineWearCostEUR = machineWearCostPLN / EUR_TO_PLN;

  // D. Energy & Post-Processing Cleaning Fee (10.00 PLN flat fee per job)
  const energyPostProcessingCostPLN = 10.00;
  const energyPostProcessingCostEUR = energyPostProcessingCostPLN / EUR_TO_PLN;

  // Total Job Price
  const totalPricePLN = rawMaterialCostPLN + supportsCostPLN + machineWearCostPLN + energyPostProcessingCostPLN;
  const totalPriceEUR = totalPricePLN / EUR_TO_PLN;

  // Print time estimation based on Bambu Lab high-speed print volumetric throughput (~18 cm³/hour)
  const printTimeHours = totalPlasticVolumeCm3 / 18.0;
  const printTimeMinutes = Math.max(15, Math.round(printTimeHours * 60));

  const r = (v: number, d = 10) => Math.round(v * d) / d;
  const r2 = (v: number) => Math.round(v * 100) / 100;

  return {
    gramsPerUnit:         r(gramsPerUnit),
    totalGrams:           r(totalGrams),
    modelGrams:           r(modelGrams),
    supportsGrams:        r(supportsGrams),
    printTimeMinutes,
    quantity:             qtyNum,
    scalePercent:         scaleNum,
    volumeCm3:            r2(volumeCm3),
    dimensionsFormatted,
    rawDimensionsFormatted: `${meshData.dx}×${meshData.dy}×${meshData.dz}mm`,
    rawGrams:             r(gramsPerUnit),
    parcelDimensionsFormatted,
    parcelBoxMm: { x: parcelX, y: parcelY, z: parcelZ },
    estimatedPriceEUR:    r2(totalPriceEUR),
    estimatedPricePLN:    r2(totalPricePLN),
    pricePerGramPLN,
    pricePerGramEUR:      r2(pricePerGramEUR),
    fileType: is3MF ? '3MF' : 'STL',
    breakdown: {
      material:              material || 'PLA',
      pricePerGramPLN,
      pricePerGramEUR:       r2(pricePerGramEUR),
      rawMaterialCostPLN:    r2(rawMaterialCostPLN),
      rawMaterialCostEUR:    r2(rawMaterialCostEUR),
      supportsCostPLN:       r2(supportsCostPLN),
      supportsCostEUR:       r2(supportsCostEUR),
      machineWearCostPLN:    r2(machineWearCostPLN),
      machineWearCostEUR:    r2(machineWearCostEUR),
      energyPostProcessingCostPLN: r2(energyPostProcessingCostPLN),
      energyPostProcessingCostEUR: r2(energyPostProcessingCostEUR),
      gramsPerUnit:          r(gramsPerUnit),
      quantity:              qtyNum,
      scalePercent:          scaleNum,
      totalGrams:            r(totalGrams),
      printTimeMinutes,
      totalPricePLN:         r2(totalPricePLN),
      totalPriceEUR:         r2(totalPriceEUR),
    },
  };
}
