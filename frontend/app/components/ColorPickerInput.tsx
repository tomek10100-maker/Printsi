'use client';

import React, { useState, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';

interface ColorPickerInputProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  className?: string;
  showPresets?: boolean;
  compact?: boolean;
}

const PRESET_FILAMENT_COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#10B981' },
  { name: 'Yellow', hex: '#F59E0B' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Purple', hex: '#8B5CF6' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#18181B' },
  { name: 'Gray', hex: '#6B7280' },
  { name: 'Gold', hex: '#D97706' },
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

export default function ColorPickerInput({
  value,
  onChange,
  label = 'HEX Color',
  className = '',
  showPresets = true,
  compact = false,
}: ColorPickerInputProps) {
  const [inputText, setInputText] = useState(value || '#3B82F6');

  // Keep internal text input in sync with external value prop
  useEffect(() => {
    if (value) {
      const formatted = value.startsWith('#') ? value : `#${value}`;
      setInputText(formatted.toUpperCase());
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    if (raw && !raw.startsWith('#')) {
      raw = '#' + raw;
    }
    setInputText(raw.toUpperCase());

    if (isValidHex(raw)) {
      onChange(normalizeHex(raw).toUpperCase());
    } else if (raw.length === 0) {
      onChange('#3B82F6');
    }
  };

  const handleTextBlur = () => {
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

  const displayHex = isValidHex(inputText) ? normalizeHex(inputText) : (isValidHex(value) ? normalizeHex(value) : '#3B82F6');

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {label}
          </label>
          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
            Click swatch to pick color <Palette size={11} />
          </span>
        </div>
      )}

      {/* Input + Color Swatch Box */}
      <div className="flex items-center gap-2">
        {/* Hex Text Field */}
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            placeholder="#3B82F6"
            maxLength={7}
            className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border-2 border-gray-200 dark:border-slate-700/80 rounded-xl font-mono text-xs font-bold text-gray-900 dark:text-white uppercase outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm"
          />
        </div>

        {/* Color Swatch Button with Hidden Native Color Picker */}
        <div
          className="relative group shrink-0 w-11 h-11 rounded-xl border-2 border-white dark:border-slate-700 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: displayHex }}
          title="Click to open color picker"
        >
          {/* Overlay Native Color Picker Input */}
          <input
            type="color"
            value={displayHex}
            onChange={handleNativeColorPickerChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            title="Click to pick color"
          />
          {/* Hover Palette Icon */}
          <Palette
            size={16}
            className={`drop-shadow opacity-70 group-hover:opacity-100 transition-opacity ${
              isLightColor(displayHex) ? 'text-gray-900' : 'text-white'
            }`}
          />
        </div>
      </div>

      {/* Preset Swatches */}
      {showPresets && (
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_FILAMENT_COLORS.map(preset => {
              const isSelected = displayHex.toUpperCase() === preset.hex.toUpperCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => {
                    setInputText(preset.hex);
                    onChange(preset.hex);
                  }}
                  className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center shadow-sm relative ${
                    isSelected
                      ? 'scale-110 ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 z-10'
                      : 'hover:scale-110 border border-black/10 dark:border-white/10'
                  }`}
                  style={{ backgroundColor: preset.hex }}
                  title={`${preset.name} (${preset.hex})`}
                >
                  {isSelected && (
                    <Check
                      size={12}
                      className={isLightColor(preset.hex) ? 'text-gray-900' : 'text-white'}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
