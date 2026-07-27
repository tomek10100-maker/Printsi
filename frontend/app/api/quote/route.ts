import { NextResponse } from 'next/server';

// ─── PRICING CONSTANTS ────────────────────────────────────────────────────────
// Filament cost per kg in PLN (midpoint of range provided by operator)
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
const DEFAULT_FILAMENT_PLN_PER_KG = 110; // fallback for unknown material

// Machine & operator costs
const MACHINE_HOURLY_RATE_PLN = 8.0;   // electricity + printer wear
const STARTUP_FEE_PLN = 5.0;           // nozzle prep, first-layer check, slicing time
const EUR_TO_PLN = 4.25;               // approximate rate stored in EUR in DB

// Typical infill ratio for a "standard" print (20% infill assumed)
const INFILL_FACTOR = 0.22;            // fraction of bounding volume that is actually plastic

// Material densities in g/cm³
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

// Print speed model constants (empirical, tuned against real PrusaSlicer outputs)
// Base: ~20 cm³/h volumetric throughput for typical 0.2mm layer, 60mm/s, 20% infill
const VOLUMETRIC_THROUGHPUT_CM3_PER_HOUR = 18;

// ─── STL PARSER ───────────────────────────────────────────────────────────────
// Computes the signed volume of a mesh (divergence theorem / Gauss)
// Works for both manifold and near-manifold meshes.

function parseSTLVolumeCm3(buffer: Buffer): { volumeCm3: number; triangles: number } {
  // Detect ASCII vs binary STL
  const header = buffer.slice(0, 80).toString('ascii');
  const isAscii = header.trimStart().toLowerCase().startsWith('solid') &&
    buffer.toString('utf8').includes('facet normal');

  let signedVolume = 0; // in mm³
  let triangleCount = 0;

  if (isAscii) {
    // ── ASCII STL ──
    const text = buffer.toString('utf8');
    const facetRegex = /facet\s+normal\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+[\d.eE+\-]+\s+outer\s+loop\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/gi;
    let match;
    while ((match = facetRegex.exec(text)) !== null) {
      const [, x1, y1, z1, x2, y2, z2, x3, y3, z3] = match.map(Number);
      signedVolume += signedTetraVolume(x1, y1, z1, x2, y2, z2, x3, y3, z3);
      triangleCount++;
    }
  } else {
    // ── Binary STL ──
    // Binary format: 80-byte header, 4-byte uint32 triangle count, then N × 50-byte records
    if (buffer.length < 84) throw new Error('STL file too small — likely corrupted.');
    const numTriangles = buffer.readUInt32LE(80);
    const expectedSize = 84 + numTriangles * 50;
    if (buffer.length < expectedSize) {
      throw new Error(`STL file appears corrupted (expected ${expectedSize} bytes, got ${buffer.length}).`);
    }
    for (let i = 0; i < numTriangles; i++) {
      const offset = 84 + i * 50;
      // Skip normal (12 bytes), read 3 vertices
      const x1 = buffer.readFloatLE(offset + 12);
      const y1 = buffer.readFloatLE(offset + 16);
      const z1 = buffer.readFloatLE(offset + 20);
      const x2 = buffer.readFloatLE(offset + 24);
      const y2 = buffer.readFloatLE(offset + 28);
      const z2 = buffer.readFloatLE(offset + 32);
      const x3 = buffer.readFloatLE(offset + 36);
      const y3 = buffer.readFloatLE(offset + 40);
      const z3 = buffer.readFloatLE(offset + 44);
      signedVolume += signedTetraVolume(x1, y1, z1, x2, y2, z2, x3, y3, z3);
      triangleCount++;
    }
  }

  const volumeMm3 = Math.abs(signedVolume) / 6.0;
  const volumeCm3 = volumeMm3 / 1000;
  return { volumeCm3, triangles: triangleCount };
}

/** Signed volume of tetrahedron formed by origin and triangle (v1, v2, v3) */
function signedTetraVolume(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number
): number {
  return (
    x1 * (y2 * z3 - y3 * z2) +
    x2 * (y3 * z1 - y1 * z3) +
    x3 * (y1 * z2 - y2 * z1)
  );
}

// ─── PRICE CALCULATION ────────────────────────────────────────────────────────
function computeQuote(volumeCm3: number, material: string) {
  const density = MATERIAL_DENSITY[material] ?? DEFAULT_DENSITY;
  const filamentPricePerKg = FILAMENT_PRICE_PLN_PER_KG[material] ?? DEFAULT_FILAMENT_PLN_PER_KG;

  // Effective plastic volume accounting for infill
  const plasticVolumeCm3 = volumeCm3 * INFILL_FACTOR;

  // Weight in grams
  const estimatedGrams = plasticVolumeCm3 * density;

  // Print time: effective volume / volumetric throughput
  const printTimeHours = plasticVolumeCm3 / VOLUMETRIC_THROUGHPUT_CM3_PER_HOUR;
  const printTimeMinutes = Math.round(printTimeHours * 60);

  // Cost breakdown in PLN
  const filamentCostPLN = (estimatedGrams / 1000) * filamentPricePerKg;
  const machineCostPLN = printTimeHours * MACHINE_HOURLY_RATE_PLN;
  const startupCostPLN = STARTUP_FEE_PLN;
  const totalPLN = filamentCostPLN + machineCostPLN + startupCostPLN;

  // Convert to EUR for display (the DB stores prices in EUR)
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
      material,
      filamentPricePerKgPLN: filamentPricePerKg,
    },
  };
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with a .stl file.' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('stl') as File | null;
    const material = (formData.get('material') as string | null)?.trim() || 'PLA';

    if (!file) {
      return NextResponse.json({ error: 'No STL file provided. Field name must be "stl".' }, { status: 400 });
    }

    const fileName = file.name?.toLowerCase() ?? '';
    if (!fileName.endsWith('.stl')) {
      return NextResponse.json(
        { error: 'Only .stl files are supported for instant estimation.' },
        { status: 400 }
      );
    }

    // File size guard: 150 MB max
    if (file.size > 150 * 1024 * 1024) {
      return NextResponse.json({ error: 'STL file exceeds 150 MB limit.' }, { status: 413 });
    }

    // Read the file into a Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 84) {
      return NextResponse.json({ error: 'File is too small to be a valid STL.' }, { status: 422 });
    }

    // Parse and compute
    const { volumeCm3, triangles } = parseSTLVolumeCm3(buffer);

    if (volumeCm3 <= 0 || !isFinite(volumeCm3)) {
      return NextResponse.json(
        { error: 'Could not determine model volume. The STL file may be corrupted or non-manifold.' },
        { status: 422 }
      );
    }

    const quote = computeQuote(volumeCm3, material);

    return NextResponse.json({
      success: true,
      fileName: file.name,
      triangles,
      ...quote,
    });
  } catch (err: any) {
    console.error('[/api/quote] Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Internal server error during STL analysis.' },
      { status: 500 }
    );
  }
}
