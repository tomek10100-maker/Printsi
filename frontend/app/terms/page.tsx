import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, FileText, RefreshCw, AlertCircle, Scale, Truck, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
  const sections = [
    {
      id: 'general-terms',
      title: '1. General Provisions & Acceptance',
      icon: <FileText size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <p>
            These Terms of Service govern the use of the Printis platform (printis.store). By registering, placing an order, or offering 3D printing services, you agree to be bound by these terms.
          </p>
          <p>
            Printis provides a global decentralized platform connecting customers requesting 3D prints with verified 3D print operators and designers.
          </p>
        </div>
      )
    },
    {
      id: 'orders-and-pricing',
      title: '2. Orders, Instant Slicing & Pricing',
      icon: <Scale size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <p>
            Quotes generated via our automated 3D slicing engine are calculated based on raw mesh volume, surface shell area, infill density, material rates per gram, printer machine wear/amortization, and post-processing.
          </p>
          <p>
            Final accepted order prices are binding upon order confirmation. All transactions are processed securely through automated escrow.
          </p>
        </div>
      )
    },
    {
      id: 'returns-and-refunds',
      title: '3. Returns, Refunds & Dissatisfaction Policy (Zwroty i Reklamacje)',
      icon: <RefreshCw size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl space-y-3 text-gray-800">
            <div className="flex items-center gap-2 font-black uppercase text-xs text-blue-900 tracking-wider">
              <CheckCircle2 size={16} className="text-blue-600" />
              100% Quality & Satisfaction Money-Back Guarantee
            </div>
            <p className="text-xs font-semibold leading-relaxed text-blue-950">
              In the event of a return, customer dissatisfaction, low print quality, dimensional inaccuracy, or print defect, <strong>100% of the order funds will be refunded directly back to your account balance or original payment method</strong>.
            </p>
            <div className="pt-2 border-t border-blue-200/60 flex items-start gap-2 text-[11px] text-gray-700 font-medium">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p>
                <strong>Shipping Cost Exclusion:</strong> Return shipping costs to the maker or Printis inspection center are non-refundable and must be borne by the returning party (<em>refunds are credited directly to your account, excluding return shipping fees</em>).
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'shipping-and-packaging',
      title: '4. Shipping & Packaging',
      icon: <Truck size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <p>
            3D print makers are required to package items safely in appropriate box sizes adapted to the model dimensions with bubble wrap protection.
          </p>
        </div>
      )
    },
    {
      id: 'escrow-and-disputes',
      title: '5. Escrow Protection & Dispute Resolution',
      icon: <Shield size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <p>
            Funds for orders are held safely in escrow until the customer receives and inspects the 3D printed items. In case of disputes, Printis support acts as an impartial arbitrator.
          </p>
        </div>
      )
    },
    {
      id: 'assembly-hardware',
      title: '6. Assembly, Tools & Non-Printed Hardware Requirements',
      icon: <AlertCircle size={20} />,
      content: (
        <div className="space-y-4 text-gray-600 font-medium leading-relaxed">
          <p>
            For multi-part models or items requiring assembly, sellers must explicitly state any non-3D-printed hardware (e.g. M3/M4 screws, bearings, magnets, adhesives, or electronics) and required assembly tools in the <strong>"Additional Parts & Tools Needed for Assembly"</strong> section of the listing.
          </p>
          <p>
            Buyers are responsible for reviewing assembly requirements prior to purchase. Unless explicitly included in the item listing description, Printis order shipments include only the 3D-printed parts.
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
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400 mb-4">Legal & Policy</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-5">
              Terms of <span className="text-blue-400">Service</span>.
            </h1>
            <p className="text-gray-300 font-medium text-lg leading-relaxed max-w-xl">
              Understand your rights, order guarantees, and refund policy on the Printis ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-10 space-y-12">
            <div className="text-sm text-gray-500 font-medium mb-8 pb-8 border-b border-gray-100 flex items-center justify-between">
              <span>Last updated: {new Date().toLocaleDateString('en-US')}</span>
              <span className="text-xs font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                Official Terms
              </span>
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
      </div>
    </main>
  );
}
