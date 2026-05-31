import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, FileText, Database, Eye, Server } from 'lucide-react';

export default function PrivacyPolicyPage() {
    const sections = [
        {
            id: 'general-provisions',
            title: '1. General Provisions',
            icon: <FileText size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        This Privacy Policy sets out the rules for the processing and protection of personal data provided by Users in connection with their use of the Printis platform (printis.store).
                    </p>
                    <p>
                        We respect your right to privacy and care about data security. For this purpose, we use, among other things, a secure communication encryption protocol (SSL).
                    </p>
                </div>
            )
        },
        {
            id: 'data-controller',
            title: '2. Data Controller',
            icon: <Shield size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        The controller of your personal data is Printis. For all matters related to the processing of personal data, you can contact us via email at: <strong>kontakt@printis.store</strong>.
                    </p>
                </div>
            )
        },
        {
            id: 'purpose-and-basis',
            title: '3. Purpose and Basis of Processing',
            icon: <Database size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>Your personal data is processed for the following purposes:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Providing electronic services (e.g., account registration, order processing) – based on Art. 6(1)(b) of the GDPR.</li>
                        <li>Handling communication and inquiries via chat and contact forms – based on Art. 6(1)(f) of the GDPR.</li>
                        <li>Fulfilling the legal obligations incumbent on the Controller (e.g., accounting and tax purposes) – based on Art. 6(1)(c) of the GDPR.</li>
                        <li>Marketing and analytical purposes (e.g., newsletter, platform improvement) – based on Art. 6(1)(a) and (f) of the GDPR.</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'data-recipients',
            title: '4. Data Recipients',
            icon: <Server size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        For the proper functioning of the Printis platform, we use the services of external entities to whom your data may be transferred. These include:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>Payment service providers (handling escrow and payments).</li>
                        <li>Courier and logistics companies (in order to deliver physical orders).</li>
                        <li>Hosting service providers and analytical tools.</li>
                    </ul>
                    <p>All these entities process data on the basis of appropriate data processing agreements.</p>
                </div>
            )
        },
        {
            id: 'user-rights',
            title: '5. User Rights',
            icon: <Eye size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>In accordance with GDPR regulations, you have the following rights:</p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>The right to access your data and receive a copy of it.</li>
                        <li>The right to rectify (correct) your data.</li>
                        <li>The right to erase data (the "right to be forgotten").</li>
                        <li>The right to restrict data processing.</li>
                        <li>The right to data portability.</li>
                        <li>The right to object to processing.</li>
                    </ul>
                    <p>To exercise your rights, please contact us at the following email address: <strong>kontakt@printis.store</strong>.</p>
                </div>
            )
        },
        {
            id: 'cookies',
            title: '6. Cookies',
            icon: <Lock size={20} />,
            content: (
                <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
                    <p>
                        The site uses cookies to ensure the proper functioning of the service, as well as for analytical and marketing purposes.
                    </p>
                    <p>
                        You can manage cookies yourself by changing your web browser settings. Restricting the use of cookies may affect some functionalities available on the site.
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
                        <ArrowLeft size={14} /> Back to Home
                    </Link>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Legal Information</p>
                        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-5">
                            Privacy <span className="text-blue-400">Policy</span>.
                        </h1>
                        <p className="text-gray-300 font-medium text-lg leading-relaxed max-w-xl">
                            Your privacy and data security are our priority. Learn how we protect your information on the Printis platform.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── CONTENT ────────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-10 space-y-12">
                        
                        <div className="text-sm text-gray-500 font-medium mb-8 pb-8 border-b border-gray-100">
                            Last updated: {new Date().toLocaleDateString('en-US')}
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
                        Have questions about privacy?
                    </h3>
                    <p className="text-gray-600 font-medium mb-6">
                        We are at your disposal. Contact us anytime.
                    </p>
                    <a href="mailto:kontakt@printis.store" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
                        Contact Us
                    </a>
                </div>
            </div>
        </main>
    );
}
