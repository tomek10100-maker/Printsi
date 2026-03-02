'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'white' | 'black' | 'midnight';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'white',
    setTheme: () => { }
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>('white');

    useEffect(() => {
        const saved = localStorage.getItem('printsi-theme') as Theme;
        if (saved && ['white', 'black', 'midnight'].includes(saved)) {
            setThemeState(saved);
            document.documentElement.setAttribute('data-theme', saved);
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('printsi-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
            <style suppressHydrationWarning>{`
        /* BLACK THEME (High Contrast) */
        html[data-theme='black'] body { background-color: #000000 !important; color: #f3f4f6 !important; }
        html[data-theme='black'] .bg-white { background-color: #111111 !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; color: #ffffff !important; }
        html[data-theme='black'] .bg-gray-50 { background-color: #1a1a1a !important; border: 1px solid rgba(255, 255, 255, 0.12) !important; color: #f9fafb !important; }
        html[data-theme='black'] .bg-gray-100 { background-color: #27272a !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; color: #f9fafb !important; }
        html[data-theme='black'] .bg-gray-200 { background-color: #3f3f46 !important; border: 1px solid rgba(255, 255, 255, 0.2) !important; color: #ffffff !important; }
        html[data-theme='black'] .bg-gray-900 { background-color: #f3f4f6 !important; border: 1px solid #ffffff !important; color: #000000 !important; }
        html[data-theme='black'] .text-gray-900, html[data-theme='black'] .text-gray-800 { color: #ffffff !important; }
        html[data-theme='black'] .text-gray-700 { color: #f3f4f6 !important; }
        html[data-theme='black'] .text-gray-600 { color: #d1d5db !important; }
        html[data-theme='black'] .text-gray-500 { color: #9ca3af !important; }
        html[data-theme='black'] .text-gray-400 { color: #6b7280 !important; }
        html[data-theme='black'] .border-gray-100 { border-color: #27272a !important; }
        html[data-theme='black'] .border-gray-200 { border-color: #3f3f46 !important; }
        html[data-theme='black'] .border-gray-300 { border-color: #52525b !important; }
        html[data-theme='black'] .shadow-sm, html[data-theme='black'] .shadow-md, html[data-theme='black'] .shadow-lg, html[data-theme='black'] .shadow-xl, html[data-theme='black'] .shadow-2xl { box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8) !important; }
        html[data-theme='black'] .bg-white\\/80, html[data-theme='black'] .bg-white\\/90 { background-color: rgba(17, 17, 17, 0.75) !important; backdrop-filter: blur(24px) saturate(150%); border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; }

        /* MIDNIGHT THEME */
        html[data-theme='midnight'] body { background-color: #020617 !important; color: #f8fafc !important; }
        html[data-theme='midnight'] .bg-white, html[data-theme='midnight'] .bg-gray-50, html[data-theme='midnight'] .bg-gray-100, html[data-theme='midnight'] .bg-gray-200 { background-color: #0f172a !important; border-color: #1e293b !important; color: #f1f5f9 !important; }
        html[data-theme='midnight'] .text-gray-900, html[data-theme='midnight'] .text-gray-800, html[data-theme='midnight'] .text-gray-700 { color: #f8fafc !important; }
        html[data-theme='midnight'] .text-gray-600, html[data-theme='midnight'] .text-gray-500, html[data-theme='midnight'] .text-gray-400 { color: #94a3b8 !important; }
        html[data-theme='midnight'] .border-gray-100, html[data-theme='midnight'] .border-gray-200, html[data-theme='midnight'] .border-gray-300 { border-color: #1e293b !important; }
        html[data-theme='midnight'] .shadow-sm, html[data-theme='midnight'] .shadow-md, html[data-theme='midnight'] .shadow-lg, html[data-theme='midnight'] .shadow-xl, html[data-theme='midnight'] .shadow-2xl { box-shadow: 0 8px 32px rgba(56, 189, 248, 0.15) !important; }
        html[data-theme='midnight'] .bg-white\\/80, html[data-theme='midnight'] .bg-white\\/90 { background-color: rgba(15, 23, 42, 0.85) !important; backdrop-filter: blur(16px); }
        html[data-theme='midnight'] .text-blue-600 { color: #38bdf8 !important; }
        html[data-theme='midnight'] a.hover\\:text-blue-600:hover { color: #7dd3fc !important; }
        html[data-theme='midnight'] .bg-gray-900 { background-color: #1e293b !important; box-shadow: 0 0 15px rgba(56,189,248,0.3) !important; border-color: #38bdf8 !important;}
        
        /* TRANSITIONS for smooth fading */
        body, .bg-white, .bg-gray-50, .bg-gray-100, .text-gray-900, .text-gray-600 {
          transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
        }
      `}</style>
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
