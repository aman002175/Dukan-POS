// PWA Install Prompt Component
import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(iOS);

    // Dismiss check
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return; // Dismissed within 7 days
    }

    // Android/Desktop: Listen for install event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // iOS: Show banner after 3 seconds
    if (iOS) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    
    if (choice.outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', Date.now().toString());
  };

  if (isInstalled || !showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div className="fixed bottom-20 md:bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
        <div className="bg-white border-2 border-orange-500 rounded-xl shadow-2xl p-4 pwa-install-banner">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">App Install Karo! 📱</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Phone pe install karo — bina internet ke bhi kaam karega!
              </p>
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
                  onClick={handleInstall}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Install Karo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 px-2 text-gray-500"
                  onClick={handleDismiss}
                >
                  Baad mein
                </Button>
              </div>
            </div>
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900">iPhone/iPad pe Install Karo</h3>
              <button onClick={() => setShowIOSInstructions(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex items-start gap-2">
                <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <p>Neeche Safari ka <strong>Share</strong> button (box with arrow ↑) dabao</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <p><strong>"Add to Home Screen"</strong> (Home Screen pe Add karo) select karo</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <p>Upar <strong>"Add"</strong> dabao — App install ho jayegi! ✅</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
              onClick={() => { setShowIOSInstructions(false); setShowBanner(false); }}
            >
              Samajh gaya! 👍
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
