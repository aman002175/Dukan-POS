// About Us — mission, features, roadmap and contact for Dukaan POS / 29 Devs.
import { Link } from 'react-router-dom';
import { Mail, Instagram, Store, ScanBarcode, Users, BookOpenText, BarChart3, Mic2, CloudUpload, ShieldCheck, Sparkles, MapPin } from 'lucide-react';

const FEATURES = [
  { icon: ScanBarcode, title: 'Fast Billing (POS)', desc: 'Barcode scanning, cart, prints/PDF bills — made for counter speed.' },
  { icon: BookOpenText, title: 'Khata / Udhaar', desc: 'Customer credit ledger with reminders so no due is forgotten.' },
  { icon: Store, title: 'Inventory', desc: 'Stock, low-stock alerts, expiry tracking, purchases and returns.' },
  { icon: Users, title: 'Customers', desc: 'Purchase history, balances and search by name or phone.' },
  { icon: BarChart3, title: 'Reports', desc: 'Daily/monthly sales, profit, dues — plain numbers, no jargon.' },
  { icon: Mic2, title: 'Voice + AI', desc: 'Hindi/English voice commands and an optional AI assistant (fully optional).' },
  { icon: CloudUpload, title: 'Offline-first + Cloud sync', desc: 'Works without internet; account login syncs to cloud backup.' },
  { icon: ShieldCheck, title: 'Private by design', desc: 'Row-level security, OTP-verified signup, zero ads, zero data selling.' },
];

const ROADMAP = [
  'Multi-device login improvements and richer cloud backup controls',
  'Bulk import/export of inventory (CSV/Excel)',
  'GST-ready billing options and more bill templates',
  'Supplier and purchase-order management',
  'More languages beyond Hindi and English',
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">About Dukaan POS</h1>
          <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed max-w-xl mx-auto">
            We build software for the shop your family trusts — the kirana store on the corner.
            Dukaan POS brings modern billing, khata and inventory to every dukaan, online or
            offline, free of ads and data games.
          </p>
        </div>

        {/* Mission */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Our mission</h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Millions of small shops still run on paper registers and memory. Big software ignores
            them because it is complicated, expensive, or needs fast internet. <strong>29 Devs</strong>{' '}
            started Dukaan POS to flip that: a free, offline-first, privacy-first POS that a
            shopkeeper can learn in one evening and trust for years. Your data stays yours, your
            shop runs even when the internet doesn't.
          </p>
          <p className="text-sm leading-relaxed text-gray-600 mt-3">
            Built with care by <strong>29 Devs</strong> — small team, big respect for dukaandars. 🇮🇳
          </p>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5">What's inside</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-xl bg-orange-50/50 border border-orange-100/60">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-white border border-orange-100 flex items-center justify-center shadow-sm">
                  <Icon className="w-4.5 h-4.5 text-orange-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Coming soon</h2>
          <p className="text-xs text-gray-400 mb-4">Roadmap — order and timing may change, honesty first.</p>
          <ul className="space-y-2.5">
            {ROADMAP.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                <Sparkles className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10 mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Talk to us</h2>
          <p className="text-xs text-gray-400 mb-5">Feature ideas, bugs, feedback — sab padha jaata hai.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <a
              href="mailto:29devs@proton.me"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 transition-colors"
            >
              <span className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <Mail className="w-5 h-5 text-gray-700" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900">Email</span>
                <span className="block text-xs text-gray-500">29devs@proton.me</span>
              </span>
            </a>
            <a
              href="https://www.instagram.com/29.devs?stkn=MWF2d3c5OWptdzBoZw=="
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-orange-50 hover:border-orange-200 transition-colors"
            >
              <span className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                <Instagram className="w-5 h-5 text-gray-700" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900">Instagram</span>
                <span className="block text-xs text-gray-500">@29.DEVS</span>
              </span>
            </a>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            Made in India · governing law India (see{' '}
            <Link to="/terms" className="text-orange-600 hover:underline">Terms</Link>)
          </p>
        </div>

        {/* Legal links */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
          <Link to="/privacy" className="text-white/80 hover:text-white font-medium">Privacy Policy</Link>
          <Link to="/terms" className="text-white/80 hover:text-white font-medium">Terms & Conditions</Link>
          <span className="text-white/60">© 2026 29 Devs · Dukaan POS</span>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
