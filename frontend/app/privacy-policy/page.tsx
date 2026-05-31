import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, FileText, Database, Eye, Server } from 'lucide-react';

export default function PrivacyPolicyPage() {
    const sections = [
        {
            id: 'postanowienia-ogolne',
            title: '1. Postanowienia ogólne',
            icon: <FileText size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych przekazanych przez Użytkowników w związku z korzystaniem z platformy Printis (printis.store).
                    </p>
                    <p>
                        Szanujemy prawo do prywatności i dbamy o bezpieczeństwo danych. W tym celu używany jest m.in. bezpieczny protokół szyfrowania komunikacji (SSL).
                    </p>
                </div>
            )
        },
        {
            id: 'administrator',
            title: '2. Administrator Danych Osobowych',
            icon: <Shield size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        Administratorem Państwa danych osobowych jest Printis. We wszelkich sprawach związanych z przetwarzaniem danych osobowych można kontaktować się z nami za pośrednictwem adresu e-mail: <strong>kontakt@printis.store</strong>.
                    </p>
                </div>
            )
        },
        {
            id: 'cel-przetwarzania',
            title: '3. Cel i podstawy przetwarzania danych',
            icon: <Database size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>Państwa dane osobowe przetwarzane są w następujących celach:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Świadczenie usług drogą elektroniczną (np. rejestracja konta, obsługa zamówień) – na podstawie art. 6 ust. 1 lit. b RODO.</li>
                        <li>Obsługa komunikacji i zapytań przez czat i formularze kontaktowe – na podstawie art. 6 ust. 1 lit. f RODO.</li>
                        <li>Wypełnienie obowiązków prawnych ciążących na Administratorze (np. księgowych i podatkowych) – na podstawie art. 6 ust. 1 lit. c RODO.</li>
                        <li>Marketingowych i analitycznych (np. newsletter, ulepszanie platformy) – na podstawie art. 6 ust. 1 lit. a i f RODO.</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'odbiorcy-danych',
            title: '4. Odbiorcy danych',
            icon: <Server size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        Dla prawidłowego funkcjonowania platformy Printis, korzystamy z usług podmiotów zewnętrznych, którym mogą zostać przekazane Państwa dane. Należą do nich:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Dostawcy usług płatniczych (obsługa escrow i płatności).</li>
                        <li>Firmy kurierskie i logistyczne (w celu dostarczenia fizycznych zamówień).</li>
                        <li>Dostawcy usług hostingowych i narzędzi analitycznych.</li>
                    </ul>
                    <p>Wszystkie te podmioty przetwarzają dane na podstawie odpowiednich umów powierzenia przetwarzania danych.</p>
                </div>
            )
        },
        {
            id: 'prawa',
            title: '5. Prawa Użytkowników',
            icon: <Eye size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>Zgodnie z przepisami RODO, posiadają Państwo następujące prawa:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Prawo dostępu do swoich danych oraz otrzymania ich kopii.</li>
                        <li>Prawo do sprostowania (poprawiania) swoich danych.</li>
                        <li>Prawo do usunięcia danych ("prawo do bycia zapomnianym").</li>
                        <li>Prawo do ograniczenia przetwarzania danych.</li>
                        <li>Prawo do przenoszenia danych.</li>
                        <li>Prawo do wniesienia sprzeciwu wobec przetwarzania.</li>
                    </ul>
                    <p>Aby skorzystać ze swoich praw, prosimy o kontakt pod adresem e-mail: <strong>kontakt@printis.store</strong>.</p>
                </div>
            )
        },
        {
            id: 'cookies',
            title: '6. Pliki Cookies',
            icon: <Lock size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        Strona korzysta z plików cookies (ciasteczek) w celu prawidłowego działania serwisu, a także w celach analitycznych i marketingowych.
                    </p>
                    <p>
                        Mogą Państwo samodzielnie zarządzać plikami cookies, zmieniając ustawienia swojej przeglądarki internetowej. Ograniczenie stosowania plików cookies może wpłynąć na niektóre funkcjonalności dostępne na stronie.
                    </p>
                </div>
            )
        }
    ];

    return (
        <main className="min-h-screen bg-gray-50 font-sans text-gray-900 pb-20">
            {/* ── HEADER ─────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 font-bold uppercase text-[10px] tracking-widest transition-colors">
                        <ArrowLeft size={14} /> Wróć do strony głównej
                    </Link>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Informacje Prawne</p>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-5">
                            Polityka <span className="text-blue-400">Prywatności</span>.
                        </h1>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed max-w-xl">
                            Twoja prywatność i bezpieczeństwo danych są dla nas priorytetem. Dowiedz się, w jaki sposób chronimy Twoje informacje na platformie Printis.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ────────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-10 space-y-12">
                        
                        <div className="text-sm text-gray-500 font-medium mb-8 pb-8 border-b border-gray-100">
                            Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL')}
                        </div>

                        {sections.map((section) => (
                            <section key={section.id} id={section.id} className="scroll-mt-8">
                                <div className="flex items-center gap-4 mb-5">
                                    <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                                        {section.icon}
                                    </div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">
                                        {section.title}
                                    </h2>
                                </div>
                                <div className="pl-0 sm:pl-14">
                                    {section.content}
                                </div>
                            </section>
                        ))}
                        
                    </div>
                </div>
                
                {/* ── CONTACT CTA ──────────────────────────────────── */}
                <div className="mt-10 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-3xl p-6 sm:p-10 text-center">
                    <h3 className="text-xl font-black uppercase tracking-tight text-gray-900 mb-3">
                        Masz pytania dotyczące prywatności?
                    </h3>
                    <p className="text-gray-600 font-medium mb-6">
                        Jesteśmy do Twojej dyspozycji. Skontaktuj się z nami w każdej chwili.
                    </p>
                    <a href="mailto:kontakt@printis.store" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                        Kontakt z nami
                    </a>
                </div>
            </div>
        </main>
    );
}
