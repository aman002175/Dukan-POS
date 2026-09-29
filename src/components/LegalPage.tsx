// LegalPage — Privacy / Terms / About pages ka shared layout.
// Ek hi jagah styling + brand header + back navigation, taaki teeno pages
// consistent rahen aur naya legal page banane me sirf content likhna pade.
import { Link } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import type { ReactNode } from 'react';

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5 list-disc pl-5 marker:text-orange-400">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

interface LegalPageProps {
  title: string;
  subtitle?: string;
  updated?: string;
  children: ReactNode;
}

export function LegalPage({ title, subtitle, updated = 'September 29, 2026', children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Brand bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => window.history.length > 1 && window.history.back()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-800 hover:text-orange-600 transition-colors"
          >
            <span className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm">
              <Store className="w-4 h-4 text-white" />
            </span>
            Dukaan POS
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
          <p className="mt-1 text-xs text-gray-400">Last updated: {updated}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400">
            Questions about this page?{' '}
            <a href="mailto:29devs@proton.me" className="text-orange-600 hover:underline font-medium">
              29devs@proton.me
            </a>{' '}
            ·{' '}
            <Link to="/about" className="text-orange-600 hover:underline font-medium">
              About us
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/70 mt-6">
          © 2026 29 Devs · Dukaan POS
        </p>
      </div>
    </div>
  );
}
