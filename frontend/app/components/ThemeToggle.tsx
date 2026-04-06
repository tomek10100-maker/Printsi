'use client';

import React, { useState } from 'react';
import { useTheme, Theme } from '../../context/ThemeContext';
import { Sun, Moon, CloudMoon } from 'lucide-react';

export default function ThemeToggle({ isHoveredExternal = false }: { isHoveredExternal?: boolean }) {
    const { theme, setTheme } = useTheme();
    const [isSpinning, setIsSpinning] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const effectiveHover = isHovered || isHoveredExternal;

    const handleSelect = (newTheme: Theme) => {
        if (newTheme === theme) return;
        setTheme(newTheme);
        setIsSpinning(true);
        setTimeout(() => setIsSpinning(false), 1200);
    };

    const options: { id: Theme; icon: any; color: string; label: string }[] = [
        { id: 'white', icon: Sun, color: 'text-amber-500 hover:bg-amber-100/50', label: 'Day' },
        { id: 'black', icon: Moon, color: 'text-zinc-300 hover:bg-zinc-800/60', label: 'Night' },
        { id: 'midnight', icon: CloudMoon, color: 'text-blue-400 hover:bg-blue-900/40', label: 'Midnight' },
    ];

    return (
        <div 
            className={`
                relative flex items-center justify-end h-16 select-none transition-all ease-[cubic-bezier(0.25,1,0.5,1)]
                rounded-full p-2 border-2
                ${effectiveHover 
                    ? 'w-[210px] bg-white/90 dark:bg-zinc-900/90 border-gray-200 dark:border-zinc-800 shadow-2xl pl-3' 
                    : 'w-16 bg-transparent border-transparent'}
            `}
            style={{ transitionDuration: '1.5s' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            
            {/* UNIFIED CONTAINER FOR ALL OPTIONS (SMALLER GAP) */}
            <div className={`flex items-center gap-2 overflow-hidden transition-all ease-[cubic-bezier(0.25,1,0.5,1)] ${effectiveHover ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
                 style={{ transitionDuration: '1.5s' }}>
                {options.map((opt) => {
                    const isActive = theme === opt.id;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => handleSelect(opt.id)}
                            className={`
                                flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                                transition-all duration-700 border
                                ${opt.color} 
                                ${isActive 
                                    ? 'bg-amber-50 dark:bg-zinc-800 shadow-md scale-105 border-amber-200 dark:border-zinc-700' 
                                    : 'scale-90 opacity-60 border-transparent'}
                                hover:scale-105 hover:opacity-100 active:scale-95
                            `}
                        >
                            <opt.icon size={20} strokeWidth={2.4} />
                        </button>
                    );
                })}
            </div>

            {/* MAIN CENTRAL ICON (FADES MORE SUBTLY) */}
            <div
                className={`
                    relative flex-shrink-0 w-12 h-12 flex items-center justify-center 
                    rounded-full z-10 transition-all
                    cursor-pointer
                    ${theme === 'white' ? 'text-amber-500' : theme === 'black' ? 'text-zinc-200' : 'text-blue-400'}
                    ${isSpinning ? 'animate-theme-spin' : ''}
                `}
                style={{ transitionDuration: '1.5s', opacity: effectiveHover ? 0.2 : 1 }}
            >
                <div className="absolute flex items-center justify-center">
                    {theme === 'white' && <Sun size={28} strokeWidth={2.8} className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                    {theme === 'black' && <Moon size={28} strokeWidth={2.8} className="drop-shadow-[0_0_8px_rgba(161,161,170,0.5)]" />}
                    {theme === 'midnight' && <CloudMoon size={28} strokeWidth={2.8} className="drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />}
                </div>
            </div>




            <style jsx>{`
                @keyframes theme-spin {
                    0% { transform: rotate(0deg) scale(1.1); }
                    50% { transform: rotate(180deg) scale(1.4); }
                    100% { transform: rotate(360deg) scale(1.1); }
                }
                .animate-theme-spin {
                    animation: theme-spin 1.2s cubic-bezier(0.25, 1, 0.5, 1);
                }
            `}</style>
        </div>
    );
}







