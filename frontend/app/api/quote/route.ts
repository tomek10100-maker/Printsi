import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { calculate3DModelQuoteFromBuffer } from '../../upload/stlQuote';

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
    await fs.promises.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    const prusaExe = findPrusaSlicerExecutable();
    const profilePath = path.join(process.cwd(), 'prusa_profile.ini');

    let gramsPerUnit = 0;
    let printTimeMinutes = 0;
    if (prusaExe) {
      // Execute PrusaSlicer CLI Headless
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
        quantity,
        scalePercent,
        ...geomQuote
      });
    }

    // Apply scale multiplier if scale !== 100
    const scaleFactor = scalePercent / 100.0;
    const scaledGramsPerUnit = gramsPerUnit > 0 
      ? gramsPerUnit * Math.pow(scaleFactor, 3) 
      : 18.0 * Math.pow(scaleFactor, 3);

    const totalGrams = scaledGramsPerUnit * quantity;
    const density = MATERIAL_DENSITY[material] ?? DEFAULT_DENSITY;
    const pricePerKgPLN = FILAMENT_PRICE_PLN_PER_KG[material] ?? DEFAULT_FILAMENT_PLN_PER_KG;
    const pricePerKgEUR = pricePerKgPLN / EUR_TO_PLN;

    const totalPricePLN = (totalGrams / 1000.0) * pricePerKgPLN;
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
      printTimeMinutes: printTimeMinutes || 35,
      estimatedPricePLN: r2(totalPricePLN),
      estimatedPriceEUR: r2(totalPriceEUR),
      filamentPricePerKgPLN: pricePerKgPLN,
      filamentPricePerKgEUR: r2(pricePerKgEUR),
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
