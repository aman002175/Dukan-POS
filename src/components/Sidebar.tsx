// Sidebar Component (Desktop)
import { 
  ShoppingCart, 
  Package, 
  BookOpen, 
  BarChart3, 
  Settings,
  Store,
  Wifi,
  WifiOff,
  Users,
  Sparkles
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { TabType } from '@/types';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const menuItems: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'pos', label: 'Bikri (POS)', icon: ShoppingCart },
  { id: 'inventory', label: 'Stock', icon: Package },
  { id: 'khata', label: 'Khata Book', icon: BookOpen },
  { id: 'customers', label: 'Grahak', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { state, isOnline } = useApp();

  return (
    <div className="hidden lg:flex flex-col w-72 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900">Dukaan POS</h1>
            <p className="text-xs text-gray-500">Kiryana Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}

          {/* AI Features — coming soon */}
          <button
            onClick={() => onTabChange('ai')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-200'
                : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <Sparkles className={`w-5 h-5 ${activeTab === 'ai' ? 'text-white' : 'text-purple-500'}`} />
            <div className="text-left">
              <span className={`font-semibold text-sm ${activeTab === 'ai' ? 'text-white' : 'text-purple-700'}`}>
                AI Assistant
              </span>
              <span className={`block text-[10px] ${activeTab === 'ai' ? 'text-purple-200' : 'text-purple-400'}`}>
                Groq — Coming Soon
              </span>
            </div>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 truncate">
              {state.businessProfile.shopName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <span>Offline Mode</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
