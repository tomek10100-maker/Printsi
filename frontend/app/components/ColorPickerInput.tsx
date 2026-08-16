'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Palette, Check, ChevronDown, X } from 'lucide-react';

interface SellerColor {
  id: string;
  color_name: string;
  color_hex: string;
  plastic_type?: string;
}

interface ColorPickerInputProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  className?: string;
  showPresets?: boolean;
  compact?: boolean;
  sellerColors?: SellerColor[];
}

// Named CSS colors → hex lookup
const COLOR_NAME_MAP: Record<string, string> = {
  red: '#EF4444', crimson: '#DC143C', rose: '#F43F5E', coral: '#FF6347',
  salmon: '#FA8072', tomato: '#FF6347', firebrick: '#B22222',
  orange: '#F97316', amber: '#F59E0B', gold: '#EAB308', yellow: '#FDE047',
  lime: '#84CC16', green: '#22C55E', emerald: '#10B981', teal: '#14B8A6',
  cyan: '#06B6D4', sky: '#0EA5E9', blue: '#3B82F6', indigo: '#6366F1',
  violet: '#7C3AED', purple: '#A855F7', fuchsia: '#D946EF', pink: '#EC4899',
  magenta: '#D946EF', lavender: '#E9D5FF', lilac: '#C084FC',
  white: '#FFFFFF', snow: '#FFFAFA', ivory: '#FFFFF0', cream: '#FFFDD0',
  beige: '#F5F5DC', sand: '#F4A460', tan: '#D2B48C', khaki: '#C3B091',
  brown: '#92400E', chocolate: '#7B3F00', maroon: '#800000',
  black: '#18181B', charcoal: '#374151', gray: '#6B7280', grey: '#6B7280',
  silver: '#9CA3AF', slate: '#64748B', navy: '#1E3A5F', midnight: '#191970',
  'ocean blue': '#006994', 'sky blue': '#87CEEB', 'royal blue': '#4169E1',
  'hot pink': '#FF69B4', 'deep red': '#8B0000', 'dark green': '#006400',
  'light blue': '#ADD8E6', 'light green': '#90EE90', 'light gray': '#D1D5DB',
  'dark gray': '#374151', 'dark blue': '#1E3A8A', 'olive green': '#6B7C32',
  transparent: '#CCCCCC',
};

const SPECTRUM_SWATCHES = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Silver', hex: '#9CA3AF' },
  { name: 'Black', hex: '#18181B' },
  { name: 'Charcoal', hex: '#374151' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Crimson', hex: '#DC143C' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Fuchsia', hex: '#D946EF' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Violet', hex: '#7C3AED' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Sky', hex: '#0EA5E9' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Lime', hex: '#84CC16' },
  { name: 'Yellow', hex: '#FDE047' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Gold', hex: '#D97706' },
  { name: 'Brown', hex: '#92400E' },
];

export function normalizeHex(raw: string): string {
  if (!raw) return '#3B82F6';
  let cleaned = raw.trim();
  if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
  if (/^#([0-9A-Fa-f]{3})$/.test(cleaned)) {
    const chars = cleaned.slice(1).split('');
    cleaned = '#' + chars.map(c => c + c).join('');
  }
  return cleaned;
}

export function isValidHex(raw: string): boolean {
  if (!raw) return false;
  let cleaned = raw.trim();
  if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
  return /^#([0-9A-Fa-f]{6})$/.test(cleaned);
}

function resolveColorNameToHex(name: string): string | null {
  if (!name) return null;
  const lower = name.trim().toLowerCase();
  if (COLOR_NAME_MAP[lower]) return COLOR_NAME_MAP[lower];
  // Try partial match
  for (const [key, hex] of Object.entries(COLOR_NAME_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return hex;
  }
  return null;
}

function isLightColor(hex: string): boolean {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6;
  } catch {
    return false;
  }
}

export default function ColorPickerInput({
  value,
  onChange,
  label = 'Color',
  className = '',
  showPresets = true,
  compact = false,
  sellerColors = [],
}: ColorPickerInputProps) {
  const [inputText, setInputText] = useState(value || '#3B82F6');
  const [showPalette, setShowPalette] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'seller' | 'spectrum' | 'custom'>('seller');
  const paletteRef = useRef<HTMLDivElement>(null);

  // Determine display hex
  const displayHex = isValidHex(inputText)
    ? normalizeHex(inputText)
    : (isValidHex(value) ? normalizeHex(value) : '#3B82F6');

  // Keep in sync with external value prop
  useEffect(() => {
    if (value) {
      const formatted = value.startsWith('#') ? value : `#${value}`;
      setInputText(formatted.toUpperCase());
    }
  }, [value]);

  // Close palette on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowPalette(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-detect initial tab
  useEffect(() => {
    if (sellerColors.length > 0) setSelectedMode('seller');
    else setSelectedMode('spectrum');
  }, [sellerColors.length]);

  const applyColor = (hex: string, name?: string) => {
    const norm = normalizeHex(hex).toUpperCase();
    setInputText(norm);
    onChange(norm);
    setShowPalette(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // If it looks like a hex code, enforce # prefix
    if (/^[0-9A-Fa-f]/.test(raw) && !raw.startsWith('#')) {
      raw = '#' + raw;
    }

    setInputText(raw);

    // Try direct hex
    if (isValidHex(raw)) {
      onChange(normalizeHex(raw).toUpperCase());
      return;
    }

    // Try as color name
    const resolvedHex = resolveColorNameToHex(raw);
    if (resolvedHex) {
      onChange(resolvedHex.toUpperCase());
    } else if (raw.length === 0) {
      onChange('#3B82F6');
    }
  };

  const handleTextBlur = () => {
    // Try to resolve as color name first
    const resolvedHex = resolveColorNameToHex(inputText);
    if (resolvedHex) {
      const upper = resolvedHex.toUpperCase();
      setInputText(upper);
      onChange(upper);
      return;
    }

    if (isValidHex(inputText)) {
      const norm = normalizeHex(inputText).toUpperCase();
      setInputText(norm);
      onChange(norm);
    } else if (inputText.trim() === '' || inputText === '#') {
      setInputText('#3B82F6');
      onChange('#3B82F6');
    } else {
      const norm = normalizeHex(value || '#3B82F6').toUpperCase();
      setInputText(norm);
    }
  };

  const handleNativeColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value.toUpperCase();
    setInputText(newHex);
    onChange(newHex);
  };

  const tabs = [
    ...(sellerColors.length > 0 ? [{ id: 'seller', label: 'Seller Colors' }] : []),
    { id: 'spectrum', label: 'Colors' },
    { id: 'custom', label: 'Custom' },
  ] as { id: typeof selectedMode; label: string }[];

  return (
    <div className={`space-y-2 ${className}`} ref={paletteRef}>
      {label && (
        <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
          {label}
        </label>
      )}

      {/* Color swatch + text input row */}
      <div className="flex items-center gap-2">
        {/* Native color picker swatch */}
        <div
          className="relative group shrink-0 w-11 h-11 rounded-xl border-2 border-white dark:border-slate-700 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: displayHex }}
          title="Click to open color picker"
        >
          <input
            type="color"
            value={displayHex}
            onChange={handleNativeColorPickerChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Palette
            size={16}
            className={`drop-shadow opacity-60 group-hover:opacity-100 transition-opacity ${isLightColor(displayHex) ? 'text-gray-900' : 'text-white'}`}
          />
        </div>

        {/* Text input — accepts name or HEX */}
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            placeholder="Color name or HEX..."
            maxLength={30}
            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border-2 border-gray-200 dark:border-slate-700/80 rounded-xl font-mono text-xs font-bold text-gray-900 dark:text-white uppercase outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm pr-9"
          />
          {/* Preview swatch inside input */}
          {isValidHex(displayHex) && (
            <div
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-gray-200 dark:border-slate-600 shadow-sm"
              style={{ backgroundColor: displayHex }}
            />
          )}
        </div>

        {/* Toggle palette button */}
        <button
          type="button"
          onClick={() => setShowPalette(p => !p)}
          className={`shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl border-2 text-xs font-black uppercase tracking-wide transition-all ${
            showPalette
              ? 'border-blue-500 bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:border-blue-300 hover:text-blue-600'
          }`}
          title="Open color palette"
        >
          <Palette size={13} />
          <ChevronDown size={11} className={`transition-transform ${showPalette ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expandable palette */}
      {showPalette && (
        <div className="border-2 border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 bg-white dark:bg-slate-900">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-slate-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedMode(tab.id)}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                  selectedMode === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Seller Colors tab */}
          {selectedMode === 'seller' && sellerColors.length > 0 && (
            <div className="p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Available from seller
              </div>
              <div className="flex flex-wrap gap-2">
                {sellerColors.map(sc => {
                  const isSelected = displayHex.toUpperCase() === (sc.color_hex || '').toUpperCase();
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => applyColor(sc.color_hex, sc.color_name)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 transition-all text-left group ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-sm'
                          : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 hover:shadow-sm bg-white dark:bg-slate-800'
                      }`}
                      title={`${sc.color_name} (${sc.color_hex})`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 shadow-sm flex-shrink-0 transition-transform ${isSelected ? 'border-blue-400 scale-110' : 'border-white group-hover:scale-105'}`}
                        style={{ backgroundColor: sc.color_hex }}
                      />
                      <span className={`text-[10px] font-black leading-tight whitespace-nowrap ${isSelected ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}>
                        {sc.color_name}
                      </span>
                      {isSelected && <Check size={9} className="text-blue-600 flex-shrink-0" />}
                    </button>
                  );
                })}
                {/* Other option */}
                <button
                  type="button"
                  onClick={() => { setSelectedMode('spectrum'); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 hover:border-blue-300 text-gray-400 hover:text-blue-500 transition-all text-[10px] font-black"
                >
                  <Palette size={12} />
                  Other...
                </button>
              </div>
            </div>
          )}

          {/* Spectrum tab */}
          {selectedMode === 'spectrum' && (
            <div className="p-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">
                Color spectrum
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SPECTRUM_SWATCHES.map(swatch => {
                  const isSelected = displayHex.toUpperCase() === swatch.hex.toUpperCase();
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => applyColor(swatch.hex, swatch.name)}
                      className={`relative w-8 h-8 rounded-xl border-2 transition-all flex items-center justify-center shadow-sm ${
                        isSelected
                          ? 'scale-125 border-blue-500 ring-2 ring-blue-400/50 ring-offset-1 z-10'
                          : 'border-transparent hover:scale-110 hover:border-gray-200'
                      } ${swatch.hex === '#FFFFFF' ? 'border-gray-200' : ''}`}
                      style={{ backgroundColor: swatch.hex }}
                      title={`${swatch.name} (${swatch.hex})`}
                    >
                      {isSelected && (
                        <Check size={12} className={isLightColor(swatch.hex) ? 'text-gray-900' : 'text-white'} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom tab */}
          {selectedMode === 'custom' && (
            <div className="p-3 space-y-3">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                Type a color name or HEX code
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                Examples: <span className="font-black text-gray-700 dark:text-gray-300">red, ocean blue, #FF5733, F43F5E</span>
              </div>
              {/* Native full color picker */}
              <div className="flex items-center gap-3">
                <div
                  className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-slate-600 shadow-md cursor-pointer hover:scale-105 transition-all"
                  style={{ backgroundColor: displayHex }}
                  title="Click to pick any color"
                >
                  <input
                    type="color"
                    value={displayHex}
                    onChange={handleNativeColorPickerChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">Current color:</div>
                  <div className="font-mono text-sm font-black text-gray-900 dark:text-white">{displayHex}</div>
                  <div className="text-[10px] text-gray-400">Click swatch to open OS color picker</div>
                </div>
              </div>
            </div>
          )}

          {/* Close bar */}
          <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-700 flex justify-end">
            <button
              type="button"
              onClick={() => setShowPalette(false)}
              className="text-[9px] font-black uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
            >
              <X size={10} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
