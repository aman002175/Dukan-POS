// Top Header Bar — "Dukaan POS" fancy branding + calculator + mic
import { useState, useEffect } from 'react';
import { Store, Calculator, Mic, MicOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface HeaderProps {
  onOpenCalculator: () => void;
}

export function Header({ onOpenCalculator }: HeaderProps) {
  const { isOnline } = useApp();
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'processing'>('idle');

  // Listen for mic status changes from FloatingMic
  useEffect(() => {
    const handler = (e: Event) => {
      const status = (e as CustomEvent).detail?.status;
      if (status) setMicStatus(status);
    };
    window.addEventListener('mic-status-changed', handler);
    return () => window.removeEventListener('mic-status-changed', handler);
  }, []);

  const toggleMic = () => {
    window.dispatchEvent(new CustomEvent('toggle-mic'));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 shadow-lg">
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Logo + Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-inner">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-black text-lg leading-none tracking-tight"
                style={{ fontFamily: "'Segoe UI', 'Poppins', sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              Dukaan POS
            </h1>
            <p className="text-white/70 text-[9px] font-medium tracking-wider uppercase">Kirana Smart Billing</p>
          </div>
        </div>

        {/* Right side — Status + Calculator + Mic */}
        <div className="flex items-center gap-2">
          {/* Online status */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
            isOnline ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'
          }`}>
            {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Calculator button */}
          <button
            onClick={onOpenCalculator}
            className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/40 transition-all shadow-md"
            title="Calculator"
          >
            <Calculator className="w-5 h-5" />
          </button>

          {/* Mic button — WHITE */}
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md ${
              micStatus === 'listening'
                ? 'bg-red-500 text-white animate-pulse'
                : micStatus === 'processing'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-orange-600 hover:bg-white/90'
            }`}
            title="Voice Assistant"
          >
            {micStatus === 'listening' ? <MicOff className="w-5 h-5" />
             : micStatus === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" />
             : <Mic className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
