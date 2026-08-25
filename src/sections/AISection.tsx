// AI Assistant Section — Placeholder for Groq API integration
import { Sparkles, Mic, BarChart3, MessageCircle, Package, Users, Zap, Brain, TrendingUp, ShoppingCart, Bell, Globe } from 'lucide-react';

interface Feature {
  icon: React.ElementType;
  title: string;
  titleHi: string;
  desc: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  impact: number; // 1-3
  color: string;
  bg: string;
}

const features: Feature[] = [
  { icon: Mic, title: 'Smart Voice 2.0', titleHi: 'स्मार्ट आवाज़', desc: 'Ek baar mein multiple items, natural baat — "bhai do kilo aashirvaad aata aur ek coke dena"', difficulty: 'Medium', impact: 3, color: 'text-violet-600', bg: 'bg-violet-50' },
  { icon: MessageCircle, title: 'Bill Summarizer', titleHi: 'बिल समरी', desc: 'Bill ke baad WhatsApp-ready ek line summary auto-generate kare — customer ko bhejna asaan', difficulty: 'Easy', impact: 2, color: 'text-green-600', bg: 'bg-green-50' },
  { icon: BarChart3, title: 'AI Sales Insights', titleHi: 'AI सेल्स इनसाइट्स', desc: '"Is hafte kya bika?" — Hindi mein poochho, data analyst jaisi advice pao', difficulty: 'Medium', impact: 3, color: 'text-blue-600', bg: 'bg-blue-50' },
  { icon: Package, title: 'Smart Reorder', titleHi: 'स्मार्ट रीऑर्डर', desc: 'Stock dekhke AI bolta hai ki kya aur kitna order karo — overstock + out-of-stock dono se bachao', difficulty: 'Medium', impact: 3, color: 'text-orange-600', bg: 'bg-orange-50' },
  { icon: Users, title: 'Customer Behavior', titleHi: 'ग्राहक विश्लेषण', desc: '"Raju ke baare mein batao" — buying pattern, udhaar history, loyalty suggestion', difficulty: 'Medium', impact: 2, color: 'text-pink-600', bg: 'bg-pink-50' },
  { icon: Bell, title: 'WhatsApp Generator', titleHi: 'WhatsApp जनरेटर', desc: 'Udhaar reminder, festival offer, birthday wish — perfect message ek click mein ready', difficulty: 'Easy', impact: 3, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: ShoppingCart, title: 'Product Auto-Fill', titleHi: 'प्रोडक्ट ऑटो-फिल', desc: 'Naam type karo — Groq category, price, unit sab suggest kar dega instantly', difficulty: 'Easy', impact: 2, color: 'text-amber-600', bg: 'bg-amber-50' },
  { icon: TrendingUp, title: 'Sales Forecasting', titleHi: 'सेल्स फोरकास्टिंग', desc: 'Agle 7 din ki expected sales, seasonal demand, stock planning — AI-powered', difficulty: 'Hard', impact: 3, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: Brain, title: 'Udhaar Assistant', titleHi: 'उधार असिस्टेंट', desc: 'Recovery priority list, smart reminder tone, credit limit per customer', difficulty: 'Medium', impact: 3, color: 'text-red-600', bg: 'bg-red-50' },
  { icon: Mic, title: 'Voice Reports', titleHi: 'वॉयस रिपोर्ट्स', desc: '"Aaj kitna kama liya?" — bolkar report nikalo, driving mein bhi update lo', difficulty: 'Medium', impact: 2, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  { icon: Zap, title: 'Discount Engine', titleHi: 'डिस्काउंट इंजन', desc: 'Intelligent discounting — loyal customer, perishable item, slow hour pe smart offer', difficulty: 'Medium', impact: 2, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { icon: Globe, title: 'Multi-Language', titleHi: 'मल्टी-लैंग्वेज', desc: 'Bill aur message — Tamil, Bangla, Gujarati mein bhi. Language barrier khatam', difficulty: 'Easy', impact: 2, color: 'text-teal-600', bg: 'bg-teal-50' },
];

const diffColor = { Easy: 'bg-green-100 text-green-700', Medium: 'bg-yellow-100 text-yellow-700', Hard: 'bg-red-100 text-red-700' };

export function AISection() {
  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 rounded-3xl p-6 mb-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black">AI Assistant</h2>
              <p className="text-purple-200 text-sm">Powered by Groq LPU</p>
            </div>
          </div>
          <p className="text-purple-100 text-sm leading-relaxed mb-4">
            Groq = world's fastest LLM inference. Free mein 14,400 requests/day. Aapki dukaan ka AI assistant — Hindi mein baat karo, seconds mein jawab pao.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-semibold">⚡ ~500 tokens/sec</span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-semibold">🆓 14,400 req/day free</span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-semibold">🇮🇳 Hindi support</span>
          </div>
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="font-bold text-amber-800 text-sm">Jald Aa Raha Hai! 🚀</p>
          <p className="text-amber-600 text-xs mt-0.5">
            Niche diye gaye sab features implement ho rahe hain. Groq API key Settings mein add karo aur AI powers unlock karo!
          </p>
        </div>
      </div>

      {/* Setup Hint */}
      <div className="bg-gray-900 rounded-2xl p-4 mb-6">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🔑 API Key Setup</p>
        <p className="text-green-400 font-mono text-xs mb-1"># Settings → API Keys → Groq API Key paste karo</p>
        <p className="text-gray-500 text-xs">console.groq.com pe free account banao → API key copy karo → Settings mein save karo</p>
      </div>

      {/* Features Grid */}
      <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
        <Brain className="w-5 h-5 text-purple-500" />
        12 AI Features — Aane Wale Hain
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{f.title}</p>
                      <p className="text-xs text-gray-400">{f.titleHi}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${diffColor[f.difficulty]}`}>
                        {f.difficulty}
                      </span>
                      <span className="text-orange-500 text-xs">{'🔥'.repeat(f.impact)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Groq Free Tier — Reality Check
          </h4>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            ['Free requests/day', '14,400'],
            ['Speed', '~500 tokens/sec (fastest LLM)'],
            ['Best model', 'llama-3.3-70b-versatile'],
            ['Monthly cost (paid)', '~₹0–400 for small dukaan'],
            ['Offline fallback', 'Har feature mein possible ✅'],
          ].map(([label, val], i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-bold text-gray-900">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
