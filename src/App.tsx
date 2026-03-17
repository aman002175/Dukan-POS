// Dukaan POS - Main App Component
import { useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { ToastContainer } from '@/components/Toast';
import { SmartCalculator } from '@/components/SmartCalculator';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { POSSection } from '@/sections/POSSection';
import { InventorySection } from '@/sections/InventorySection';
import { KhataSection } from '@/sections/KhataSection';
import { ReportsSection } from '@/sections/ReportsSection';
import { SettingsSection } from '@/sections/SettingsSection';
import { Loader2, WifiOff } from 'lucide-react';
import type { TabType } from '@/types';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const { isLoading, isOnline } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏪</span>
          </div>
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">Dukaan POS Load ho raha hai...</p>
          <p className="text-gray-400 text-sm mt-1">Thoda ruko</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSSection />;
      case 'inventory':
        return <InventorySection />;
      case 'khata':
        return <KhataSection />;
      case 'reports':
        return <ReportsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <POSSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gray-800 text-white text-center py-1.5 text-xs flex items-center justify-center gap-1.5">
          <WifiOff className="w-3 h-3" />
          <span>Offline Mode — Aapka Data Local Saved Hai ✓</span>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${!isOnline ? 'pt-7 md:pt-7' : ''}`}>
        {renderContent()}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Smart Calculator */}
      <SmartCalculator cartTotal={activeTab === 'pos' ? 0 : 0} />

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
