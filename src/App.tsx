// Dukaan POS - Main App Component
import { useState, useEffect } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';
import { CalculatorPanel } from '@/components/CalculatorPanel';
import { ToastContainer } from '@/components/Toast';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { POSSection } from '@/sections/POSSection';
import { InventorySection } from '@/sections/InventorySection';
import { KhataSection } from '@/sections/KhataSection';
import { CustomersSection } from '@/sections/CustomersSection';
import { ReportsSection } from '@/sections/ReportsSection';
import { SettingsSection } from '@/sections/SettingsSection';
import { AISection } from '@/sections/AISection';
import { Loader2, WifiOff } from 'lucide-react';
import { FloatingMic } from '@/components/FloatingMic';
import type { TabType } from '@/types';

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const [showCalculator, setShowCalculator] = useState(false);
  const { isLoading, isOnline } = useApp();

  // AI actions (show_report, show_customer, search_*) se tab switch
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as TabType | undefined;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('ai-switch-tab', handler);
    return () => window.removeEventListener('ai-switch-tab', handler);
  }, []);

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
      case 'pos': return <POSSection />;
      case 'inventory': return <InventorySection />;
      case 'khata': return <KhataSection />;
      case 'customers': return <CustomersSection />;
      case 'reports': return <ReportsSection />;
      case 'settings': return <SettingsSection />;
      case 'ai': return <AISection />;
      default: return <POSSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Top Header */}
      <Header onOpenCalculator={() => setShowCalculator(true)} />

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-[48px] left-0 right-0 z-40 bg-gray-800 text-white text-center py-1 text-[10px] flex items-center justify-center gap-1.5">
          <WifiOff className="w-3 h-3" />
          <span>Offline Mode — Data Local Saved</span>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content — pushed down by header */}
      <main className={`flex-1 overflow-auto pt-[52px] lg:pt-[52px] ${!isOnline ? 'pt-[68px]' : ''}`}>
        {renderContent()}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Calculator Panel (Modal) */}
      <CalculatorPanel isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Floating Mic — Voice from any page */}
      <FloatingMic activeTab={activeTab} />

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
