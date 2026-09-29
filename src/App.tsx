// Dukaan POS - Main App Component
// Routing: /login (Login page) → /auth/callback (Google OAuth) → / (Dashboard)
import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from '@/context/AppContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { Header } from '@/components/Header';
import { CalculatorPanel } from '@/components/CalculatorPanel';
import { ToastContainer } from '@/components/Toast';
import { PWAInstallBanner } from '@/components/PWAInstallBanner';
import { Loader2, WifiOff } from 'lucide-react';
import { FloatingMic } from '@/components/FloatingMic';
import type { TabType } from '@/types';

// Code-splitting — bhaari sections alag chunks mein, initial bundle chhota (slow network pe white-screen fix)
const POSSection = lazy(() => import('@/sections/POSSection').then(m => ({ default: m.POSSection })));
const InventorySection = lazy(() => import('@/sections/InventorySection').then(m => ({ default: m.InventorySection })));
const KhataSection = lazy(() => import('@/sections/KhataSection').then(m => ({ default: m.KhataSection })));
const CustomersSection = lazy(() => import('@/sections/CustomersSection').then(m => ({ default: m.CustomersSection })));
const ReportsSection = lazy(() => import('@/sections/ReportsSection').then(m => ({ default: m.ReportsSection })));
const SettingsSection = lazy(() => import('@/sections/SettingsSection').then(m => ({ default: m.SettingsSection })));
const AISection = lazy(() => import('@/sections/AISection').then(m => ({ default: m.AISection })));
const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallbackPage').then(m => ({ default: m.AuthCallbackPage })));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/pages/TermsPage').then(m => ({ default: m.TermsPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));

/** App gate — auth loading ke waqt spinner, guest allow */
function AppGate({ children }: { children: React.ReactNode }) {
  const { loading, mode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Account mode mein login page pe kyun rukna — dashboard pe bhejo
    if (!loading && mode === 'account' && location.pathname === '/login') {
      navigate('/', { replace: true });
    }
  }, [loading, mode, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🏪</span>
          </div>
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-700 font-semibold">Dukaan POS</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Dashboard() {
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

function AppRoutes() {
  return (
    <AppGate>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Dukaan load ho raha hai...</p>
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          {/* Legal / info pages — public, auth ki zaroorat nahi */}
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          {/* PKCE/implicit OAuth agar root pe tokens chhod jaye to bhi callback page handle kare */}
          <Route path="/auth/confirm" element={<AuthCallbackPage />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppGate>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
