'use client';

import { useEffect, useState } from 'react';
import { Cookie, ChevronDown, ChevronUp, Shield, BarChart2, Settings, Megaphone, X, Check } from 'lucide-react';

type CookiePreferences = {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
};

const COOKIE_KEY = 'printsi_cookie_consent';

function loadPreferences(): CookiePreferences | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(COOKIE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function savePreferences(prefs: CookiePreferences) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
}

export default function CookieConsent() {
    const [visible, setVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [prefs, setPrefs] = useState<CookiePreferences>({
        necessary: true,
        analytics: false,
        marketing: false,
        preferences: false,
    });

    useEffect(() => {
        const saved = loadPreferences();
        if (!saved) {
            setVisible(true);
        }
    }, []);

    if (!visible) return null;

    const handleAcceptAll = () => {
        const all: CookiePreferences = { necessary: true, analytics: true, marketing: true, preferences: true };
        savePreferences(all);
        setVisible(false);
    };

    const handleRejectAll = () => {
        const minimal: CookiePreferences = { necessary: true, analytics: false, marketing: false, preferences: false };
        savePreferences(minimal);
        setVisible(false);
    };

    const handleSaveSelection = () => {
        savePreferences({ ...prefs, necessary: true });
        setVisible(false);
    };

    const toggle = (key: keyof CookiePreferences) => {
        if (key === 'necessary') return;
        setPrefs(p => ({ ...p, [key]: !p[key] }));
    };

    const categories = [
        {
            key: 'necessary' as const,
            label: 'Strictly Necessary',
            desc: 'Required for the site to function. Cannot be disabled. They handle authentication, security, and session management.',
            icon: <Shield size={16} className="text-blue-600" />,
            alwaysOn: true,
        },
        {
            key: 'analytics' as const,
            label: 'Analytics',
            desc: 'Help us understand how visitors interact with the site so we can improve user experience.',
            icon: <BarChart2 size={16} className="text-purple-500" />,
            alwaysOn: false,
        },
        {
            key: 'preferences' as const,
            label: 'Preferences',
            desc: 'Allow the site to remember your settings such as language, currency, and display options.',
            icon: <Settings size={16} className="text-amber-500" />,
            alwaysOn: false,
        },
        {
            key: 'marketing' as const,
            label: 'Marketing',
            desc: 'Used to show you relevant ads and offers based on your browsing behavior.',
            icon: <Megaphone size={16} className="text-rose-500" />,
            alwaysOn: false,
        },
    ];

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center items-end sm:items-end p-3 sm:p-5 pointer-events-none"
            aria-live="polite"
        >
            <div
                className="pointer-events-auto w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
                style={{ animation: 'slideUpFadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <Cookie size={16} className="text-blue-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400">Privacy</p>
                            <p className="text-sm font-bold text-white leading-none">Cookie Preferences</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRejectAll}
                        title="Decline all & close"
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">
                        We use cookies to enhance your browsing experience, analyze site traffic, and personalize content.
                        By clicking <span className="font-black text-gray-900">"Accept All"</span> you consent to our use of cookies.
                        You can also manage your preferences or{' '}
                        <a href="/privacy-policy" className="text-blue-600 font-bold hover:underline">read our Privacy Policy</a>.
                    </p>

                    {/* Details panel */}
                    {showDetails && (
                        <div className="mt-4 space-y-2 border border-gray-100 rounded-xl overflow-hidden">
                            {categories.map(cat => (
                                <div key={cat.key} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
                                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                        {cat.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-black text-gray-800">{cat.label}</p>
                                            {cat.alwaysOn ? (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">Always On</span>
                                            ) : (
                                                <button
                                                    onClick={() => toggle(cat.key)}
                                                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${prefs[cat.key] ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                    aria-checked={prefs[cat.key]}
                                                    role="switch"
                                                    aria-label={`Toggle ${cat.label}`}
                                                >
                                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${prefs[cat.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-500 font-medium leading-snug mt-0.5">{cat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Toggle details */}
                    <button
                        onClick={() => setShowDetails(v => !v)}
                        className="mt-3 flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {showDetails ? 'Hide details' : 'Manage cookie settings'}
                    </button>
                </div>

                {/* Footer buttons */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2 items-center justify-end">
                    <button
                        onClick={handleRejectAll}
                        className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-100 transition-all"
                    >
                        Reject All
                    </button>
                    {showDetails && (
                        <button
                            onClick={handleSaveSelection}
                            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-all flex items-center gap-1.5"
                        >
                            <Check size={12} /> Save Selection
                        </button>
                    )}
                    <button
                        onClick={handleAcceptAll}
                        className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all shadow-md shadow-blue-600/25 flex items-center gap-1.5"
                    >
                        <Cookie size={12} /> Accept All
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUpFadeIn {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
