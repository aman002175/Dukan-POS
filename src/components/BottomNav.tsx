// Bottom Navigation Component (Mobile)
import { 
  ShoppingCart, 
  Package, 
  BookOpen, 
  Users,
  BarChart3,
  Settings,
  Sparkles,
  MoreHorizontal
} from 'lucide-react';
import { useState } from 'react';
import type { TabType } from '@/types';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

// Main 5 tabs — always visible
const mainItems: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'pos',       label: 'Bikri',   icon: ShoppingCart },
  { id: 'inventory', label: 'Stock',   icon: Package },
  { id: 'khata',     label: 'Khata',   icon: BookOpen },
  { id: 'customers', label: 'Grahak',  icon: Users },
  { id: 'reports',   label: 'Reports', icon: BarChart3 },
];

// "More" menu items
const moreItems: { id: TabType; label: string; icon: React.ElementType; isAI?: boolean }[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'ai',       label: 'AI',       icon: Sparkles, isAI: true },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [showMore, setShowMore] = useState(false);

  // Check if any "more" item is active
  const isMoreActive = moreItems.some(item => item.id === activeTab);

  const handleMoreItemClick = (tab: TabType) => {
    onTabChange(tab);
    setShowMore(false);
  };

  return (
    <>
      {/* Backdrop for "More" popup */}
      {showMore && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* "More" popup menu — pops UP from the More button */}
      {showMore && (
        <div className="lg:hidden fixed bottom-16 right-2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[160px]">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMoreItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
                  item.isAI
                    ? isActive
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                      : 'text-purple-700 hover:bg-purple-50'
                    : isActive
                      ? 'bg-orange-50 text-orange-600'
                      : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${
                  item.isAI
                    ? isActive ? 'text-white' : 'text-purple-500'
                    : isActive ? 'text-orange-600' : 'text-gray-500'
                }`} />
                <span className="text-sm font-semibold">{item.label}</span>
                {item.isAI && !isActive && (
                  <span className="ml-auto text-[9px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-bold">
                    SOON
                  </span>
                )}
                {isActive && (
                  <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.isAI ? 'bg-white' : 'bg-orange-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe">
        <nav className="flex items-center justify-around px-1 py-1">

          {/* Main 5 tabs */}
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onTabChange(item.id); setShowMore(false); }}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                  isActive ? 'text-orange-600' : 'text-gray-500'
                }`}
              >
                <div className={`p-1.5 rounded-xl ${isActive ? 'bg-orange-100' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-gray-500'}`} />
                </div>
                <span className={`text-[10px] font-semibold leading-tight ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" button (Settings + AI) */}
          <button
            onClick={() => setShowMore(prev => !prev)}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
              isMoreActive || showMore ? 'text-orange-600' : 'text-gray-500'
            }`}
          >
            <div className={`p-1.5 rounded-xl relative ${isMoreActive || showMore ? 'bg-orange-100' : ''}`}>
              <MoreHorizontal className={`w-5 h-5 ${isMoreActive || showMore ? 'text-orange-600' : 'text-gray-500'}`} />
              {/* Dot indicator if a "more" tab is active */}
              {isMoreActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full border border-white" />
              )}
            </div>
            <span className={`text-[10px] font-semibold leading-tight ${isMoreActive || showMore ? 'text-orange-600' : 'text-gray-500'}`}>
              {isMoreActive
                ? moreItems.find(i => i.id === activeTab)?.label ?? 'More'
                : 'More'}
            </span>
          </button>

        </nav>
      </div>
    </>
  );
}
