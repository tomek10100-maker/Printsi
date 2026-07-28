import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { calculate3DModelQuoteFromBuffer } from '../../upload/stlQuote';

// Allow up to 30s execution for Vercel Serverless Function
export const maxDuration = 30;

const execAsync = promisify(exec);

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

/**
 * Finds PrusaSlicer CLI executable on the system
 */
function findPrusaSlicerExecutable(): string | null {
  const possiblePaths: string[] = [];

  if (process.platform === 'win32') {
    possiblePaths.push(
      'prusa-slicer-console.exe',
      'prusa-slicer.exe',
      'C:\\Program Files\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
      'C:\\Program Files (x86)\\Prusa3D\\PrusaSlicer\\prusa-slicer-console.exe',
      'C:\\Program Files\\PrusaSlicer\\prusa-slicer-console.exe'
    );
  } else if (process.platform === 'darwin') {
    possiblePaths.push(
      '/Applications/Original Prusa3D/PrusaSlicer.app/Contents/MacOS/PrusaSlicer',
      'prusa-slicer'
    );
  } else {
    possiblePaths.push('prusa-slicer', '/usr/bin/prusa-slicer', '/usr/local/bin/prusa-slicer');
  }

  for (const exePath of possiblePaths) {
    try {
      if (fs.existsSync(exePath)) return exePath;
    } catch (_) { /* check next */ }
  }

  return null;
}

/**
 * Parses G-code comments output by PrusaSlicer CLI
 */
function parseGCodeMetadata(gcodeText: string) {
  let grams = 0;
  let printTimeMinutes = 0;

  // Search for: ; filament used [g] = 12.34
  const gramsMatch = /;\s*filament used\s*\[g\]\s*=\s*([\d.]+)/i.exec(gcodeText);
  if (gramsMatch) {
    grams = parseFloat(gramsMatch[1]) || 0;
  } else {
    // Search for: ; filament used [cm3] = 3.45
    const cm3Match = /;\s*filament used\s*\[cm3\]\s*=\s*([\d.]+)/i.exec(gcodeText);
    if (cm3Match) {
      const cm3 = parseFloat(cm3Match[1]) || 0;
      grams = cm3 * 1.24;
    }
  }

  // Search for: ; estimated printing time (normal mode) = 1h 22m 10s or 45m 12s
  const timeMatch = /;\s*estimated printing time\b[^\n]*=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s\s*)?/i.exec(gcodeText);
  if (timeMatch) {
    const days = parseInt(timeMatch[1] || '0');
    const hours = parseInt(timeMatch[2] || '0');
    const mins = parseInt(timeMatch[3] || '0');
    const secs = parseInt(timeMatch[4] || '0');
    printTimeMinutes = days * 1440 + hours * 60 + mins + (secs > 30 ? 1 : 0);
  }

  return { grams, printTimeMinutes };
}

/**
 * Optional OctoPrint REST API slicing integration
 */
async function getQuoteFromOctoPrint(fileBuffer: Buffer, fileName: string) {
  const octoUrl = process.env.OCTOPRINT_URL?.replace(/\/$/, '');
  const apiKey = process.env.OCTOPRINT_API_KEY;
  if (!octoUrl || !apiKey) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([plainBuffer(fileBuffer)], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName);
    formData.append('select', 'false');
    formData.append('print', 'false');

    const res = await fetch(`${octoUrl}/api/files/local`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      const gcodeData = data.gcodeAnalysis || data.file?.gcodeAnalysis;
      if (gcodeData && gcodeData.filament) {
        const tool0 = (gcodeData.filament.tool0 || Object.values(gcodeData.filament)[0]) as any;
        const volumeCm3 = tool0?.volume || 0;
        const printTimeSec = gcodeData.estimatedPrintTime || 0;
        return {
          grams: volumeCm3 * 1.24,
          printTimeMinutes: Math.round(printTimeSec / 60),
        };
      }
    }
  } catch (err) {
    console.warn('[/api/quote] OctoPrint API call failed:', err);
  }

  return null;
}

function plainBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function POST(request: Request) {
  const tmpDir = os.tmpdir();
  let tempFilePath = '';
  let tempGCodePath = '';

  try {
    const formData = await request.formData();
    const file = (formData.get('file') || formData.get('stl') || formData.get('3mf')) as File | null;
    const material = ((formData.get('material') as string) || 'PLA').trim().toUpperCase();
    const scalePercent = Math.max(1, parseFloat((formData.get('scale') as string) || '100'));
    const quantity = Math.max(1, parseInt((formData.get('quantity') as string) || '1'));

    if (!file) {
      return NextResponse.json({ error: 'No 3D model file provided.' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const isSTL = fileName.endsWith('.stl');
    const is3MF = fileName.endsWith('.3mf');

    if (!isSTL && !is3MF) {
      return NextResponse.json({ error: 'Supported formats: .STL, .3MF' }, { status: 400 });
    }

    // Save temporary 3D file to OS tmpdir
    const fileExt = is3MF ? '.3mf' : '.stl';
    const tempId = `printsi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    tempFilePath = path.join(tmpDir, `${tempId}${fileExt}`);
    tempGCodePath = path.join(tmpDir, `${tempId}.gcode`);

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    let gramsPerUnit = 0;
    let printTimeMinutes = 0;
    let engine = 'OctoPrint-API';

    // 1. Try OctoPrint API if configured in .env.local
    const octoResult = await getQuoteFromOctoPrint(fileBuffer, file.name);
    if (octoResult && octoResult.grams > 0) {
      gramsPerUnit = octoResult.grams;
      printTimeMinutes = octoResult.printTimeMinutes;
      console.log('[/api/quote] Quote calculated via OctoPrint API:', gramsPerUnit, 'g');
    } else {
      // 2. Try PrusaSlicer CLI Headless
      engine = 'PrusaSlicer-CLI';
      const prusaExe = findPrusaSlicerExecutable();
      const profilePath = path.join(process.cwd(), 'prusa_profile.ini');

      if (prusaExe) {
        const cmd = `"${prusaExe}" --export-gcode ${fs.existsSync(profilePath) ? `--load "${profilePath}"` : ''} "${tempFilePath}" --output "${tempGCodePath}"`;
        console.log('[/api/quote] Executing PrusaSlicer CLI:', cmd);

        await execAsync(cmd, { timeout: 45000 });

        if (fs.existsSync(tempGCodePath)) {
          const gcodeContent = await fs.promises.readFile(tempGCodePath, 'utf-8');
          const parsed = parseGCodeMetadata(gcodeContent);
          gramsPerUnit = parsed.grams;
          printTimeMinutes = parsed.printTimeMinutes;
        }
      }
    }

    // If PrusaSlicer CLI is not installed or returned 0, run Server Geometry Engine
    if (gramsPerUnit <= 0) {
      engine = 'Geometry-Engine-Fallback';
      console.log('[/api/quote] PrusaSlicer CLI not installed/used. Running Server Geometry Engine.');
      const geomQuote = await calculate3DModelQuoteFromBuffer(arrayBuffer, file.name, material, scalePercent, quantity);
      return NextResponse.json({
        success: true,
        engine,
        fileName: file.name,
        material,
        ...geomQuote
      });
    }

    // Apply scale multiplier if scale !== 100
    const scaleFactor = scalePercent / 100.0;
    const scaledGramsPerUnit = gramsPerUnit > 0 
      ? gramsPerUnit * Math.pow(scaleFactor, 3) 
      : 18.0 * Math.pow(scaleFactor, 3);

    const totalGrams = scaledGramsPerUnit * quantity;
    const PRICE_PER_GRAM_PLN: Record<string, number> = {
      PLA: 0.11, 'PLA+': 0.12, PETG: 0.12, ABS: 0.11, ASA: 0.15,
      TPU: 0.175, PA: 0.28, PC: 0.27, RESIN: 0.20, OTHER: 0.22,
    };
    const pricePerGramPLN = PRICE_PER_GRAM_PLN[material] ?? 0.11;
    const pricePerGramEUR = pricePerGramPLN / EUR_TO_PLN;

    const rawMaterialCostPLN = totalGrams * pricePerGramPLN;
    const rawMaterialCostEUR = rawMaterialCostPLN / EUR_TO_PLN;

    const supportsCostPLN = rawMaterialCostPLN * 0.10;
    const supportsCostEUR = supportsCostPLN / EUR_TO_PLN;

    const machineWearCostPLN = 15.00;
    const machineWearCostEUR = machineWearCostPLN / EUR_TO_PLN;

    const energyPostProcessingCostPLN = 10.00;
    const energyPostProcessingCostEUR = energyPostProcessingCostPLN / EUR_TO_PLN;

    const totalPricePLN = rawMaterialCostPLN + supportsCostPLN + machineWearCostPLN + energyPostProcessingCostPLN;
    const totalPriceEUR = totalPricePLN / EUR_TO_PLN;

    const r = (v: number) => Math.round(v * 10) / 10;
    const r2 = (v: number) => Math.round(v * 100) / 100;

    return NextResponse.json({
      success: true,
      engine,
      fileName: file.name,
      material,
      quantity,
      scalePercent,
      gramsPerUnit: r(scaledGramsPerUnit),
      totalGrams: r(totalGrams),
      modelGrams: r(totalGrams * 0.9),
      supportsGrams: r(totalGrams * 0.1),
      printTimeMinutes: printTimeMinutes || 35,
      dimensionsFormatted: 'Auto Sliced',
      parcelDimensionsFormatted: 'Standard Box',
      parcelBoxMm: { x: 150, y: 150, z: 150 },
      estimatedPricePLN: r2(totalPricePLN),
      estimatedPriceEUR: r2(totalPriceEUR),
      pricePerGramPLN,
      pricePerGramEUR: r2(pricePerGramEUR),
      fileType: is3MF ? '3MF' : 'STL',
      breakdown: {
        material,
        pricePerGramPLN,
        pricePerGramEUR: r2(pricePerGramEUR),
        rawMaterialCostPLN: r2(rawMaterialCostPLN),
        rawMaterialCostEUR: r2(rawMaterialCostEUR),
        supportsCostPLN: r2(supportsCostPLN),
        supportsCostEUR: r2(supportsCostEUR),
        machineWearCostPLN: r2(machineWearCostPLN),
        machineWearCostEUR: r2(machineWearCostEUR),
        energyPostProcessingCostPLN: r2(energyPostProcessingCostPLN),
        energyPostProcessingCostEUR: r2(energyPostProcessingCostEUR),
        gramsPerUnit: r(scaledGramsPerUnit),
        quantity,
        scalePercent,
        totalGrams: r(totalGrams),
        printTimeMinutes: printTimeMinutes || 35,
        totalPricePLN: r2(totalPricePLN),
        totalPriceEUR: r2(totalPriceEUR),
      },
    });

  } catch (err: any) {
    console.error('[/api/quote] Error during PrusaSlicer CLI execution:', err);
    return NextResponse.json({ error: err.message || 'Slicer execution failed.' }, { status: 500 });
  } finally {
    // Cleanup temporary files
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) await fs.promises.unlink(tempFilePath);
      if (tempGCodePath && fs.existsSync(tempGCodePath)) await fs.promises.unlink(tempGCodePath);
    } catch (_) { /* ignore cleanup error */ }
  }
}
