// Bottom Navigation Component (Mobile)
import { 
  ShoppingCart, 
  Package, 
  BookOpen, 
  Users,
  BarChart3,
  Sparkles
} from 'lucide-react';
import type { TabType } from '@/types';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const menuItems: { id: TabType; label: string; icon: React.ElementType; isAI?: boolean }[] = [
  { id: 'pos', label: 'Bikri', icon: ShoppingCart },
  { id: 'inventory', label: 'Stock', icon: Package },
  { id: 'khata', label: 'Khata', icon: BookOpen },
  { id: 'customers', label: 'Grahak', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'ai', label: 'AI', icon: Sparkles, isAI: true },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 pb-safe">
      <nav className="flex items-center justify-around px-1 py-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`}
            >
              {item.isAI ? (
                // Special AI button — purple gradient pill
                <div className={`px-2 py-1 rounded-xl flex flex-col items-center gap-0.5 transition-all ${
                  isActive
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-purple-200'
                    : 'bg-gradient-to-br from-violet-100 to-purple-100'
                }`}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-500'}`} />
                  <span className={`text-[9px] font-bold leading-tight ${isActive ? 'text-white' : 'text-purple-600'}`}>
                    AI
                  </span>
                </div>
              ) : (
                <>
                  <div className={`p-1.5 rounded-xl ${isActive ? 'bg-orange-100' : ''}`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-gray-500'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold leading-tight ${isActive ? 'text-orange-600' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
