/**
 * BarcodeScanner — Camera se packet barcode scan → product dhundho → cart mein add.
 * Native BarcodeDetector API (Chrome/Edge, offline, zero dependency).
 * Unsupported browser → manual barcode entry fallback.
 *
 * FULL-SCREEN CONTINUOUS SCAN:
 * - Scanner poori screen le leta hai (fullscreen overlay) — dekhne mein aasan.
 * - Ek baar kholo → camera khula rehta hai. Product saamne lao → cart mein add.
 * - Ek baar laaya = 1 add, do baar laaya = 2 add (thoda door hatao, phir wapas lao).
 * - Upar X button se band karo; wapas scan icon se khol sakte ho.
 * - 'capture' mode (inventory form): scan hone par code wapas deta hai (puraani tarah).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanBarcode, X, Keyboard, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';

// Native Shape Detection API (TS lib mein nahi hai — minimal declare)
interface NativeBarcode {
  rawValue: string;
  format: string;
}
interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<NativeBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector || null;
}

export function isBarcodeSupported(): boolean {
  return getDetectorCtor() !== null
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Ek hi scan nateeja ko dobara count hone se bachane ke liye chhota memory */
interface RecentScan {
  code: string;
  at: number;
}

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * 'cart' (default): scan → product dhundho → cart mein add (CONTINUOUS — band nahi hota).
   * 'capture': scan → onCapture(code) ko code dedo (inventory form jaise), cart touch MAT karo.
   */
  mode?: 'cart' | 'capture';
  onCapture?: (code: string) => void;
}

/** Cart-mode ke liye same barcode dobara kitni der mein ignore karna hai (ms) */
const DUPLICATE_SCAN_WINDOW_MS = 1200;

export function BarcodeScanner({ isOpen, onClose, mode = 'cart', onCapture }: BarcodeScannerProps) {
  const { state, addToCart, showToast } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // Continuous mode: pichhle kai scans ki memory (per-code cooldown)
  const recentScansRef = useRef<RecentScan[]>([]);
  const lastFeedbackRef = useRef<{ msg: string; at: number }>({ msg: '', at: 0 });
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [starting, setStarting] = useState(false);
  const [unmatchedCode, setUnmatchedCode] = useState('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const onCaptureRef = useRef(onCapture);
  onCaptureRef.current = onCapture;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const openAddProduct = useCallback((code: string) => {
    // Inventory tab kholo + add-form barcode ke saath prefill karo
    window.dispatchEvent(new CustomEvent('ai-switch-tab', { detail: { tab: 'inventory' } }));
    window.dispatchEvent(new CustomEvent('prefill-add-product', { detail: { barcode: code } }));
    onClose();
  }, [onClose]);

  const findAndAdd = useCallback((code: string): boolean => {
    const clean = code.trim();
    if (!clean) return false;

    // CAPTURE mode: sirf code wapas do (inventory form), cart touch mat karo — single-scan flow
    if (modeRef.current === 'capture') {
      onCaptureRef.current?.(clean);
      return true;
    }

    // CONTINUOUS CART MODE — per-code cooldown:
    // same packet ko 1.2s ke andar dobara gina nahi jaata (STT-style de-dup),
    // par packet hatao aur thodi der baad wapas lao = naya scan = dobara add.
    const now = Date.now();
    recentScansRef.current = recentScansRef.current.filter(r => now - r.at < 4000);
    const last = recentScansRef.current.find(r => r.code === clean);
    if (last && now - last.at < DUPLICATE_SCAN_WINDOW_MS) return true;
    // Naya scan record karo
    recentScansRef.current.push({ code: clean, at: now });
    if (recentScansRef.current.length > 10) recentScansRef.current.shift();

    const product = stateRef.current.products.find(p => (p.barcode || '').trim() === clean);
    if (!product) {
      // Unmatched code toast spam na kare — 1.5s ke andar same message dobara na bhejo
      const fb = `Barcode ${clean} kisi product se match nahi hua`;
      if (lastFeedbackRef.current.msg === fb && now - lastFeedbackRef.current.at < 1500) return false;
      lastFeedbackRef.current = { msg: fb, at: now };
      setUnmatchedCode(clean);
      showToast(fb, 'error');
      return false;
    }
    setUnmatchedCode('');
    if (product.stock <= 0) {
      const fb = `"${product.name}" ka stock khatam hai`;
      if (lastFeedbackRef.current.msg === fb && now - lastFeedbackRef.current.at < 1500) return false;
      lastFeedbackRef.current = { msg: fb, at: now };
      showToast(fb, 'error');
      return false;
    }
    addToCart(product, 1);
    showToast(`"${product.name}" cart mein add ho gaya!`, 'success');
    return true;
  }, [addToCart, showToast]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* noop */ } });
    streamRef.current = null;
  }, []);

  // Reset helper — open state effect aur close par halke se use hota hai
  const resetTransient = useCallback(() => {
    setError('');
    setManualCode('');
    setStarting(false);
    setUnmatchedCode('');
    recentScansRef.current = [];
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetTransient();
      return;
    }
    const Ctor = getDetectorCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setError('NO_DETECTOR');
      return;
    }
    let cancelled = false;
    setStarting(true);
    setError('');
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => { try { t.stop(); } catch { /* noop */ } });
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const detector = new Ctor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        setStarting(false);
        const loop = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0 && codes[0].rawValue) {
                const ok = findAndAdd(codes[0].rawValue);
                // ⚠️ CONTINUOUS MODE: ok hone par dialog BAND NAHI karte —
                // scanner khula rehta hai, agla packet saamne lao to add ho jayega.
                // (capture mode ke andar findAndAdd onCapture ko fire kar deta hai.)
                if (modeRef.current === 'capture' && ok) {
                  onClose();
                  return;
                }
                void ok;
              }
            }
          } catch { /* detect fail — agle frame par retry */ }
          rafRef.current = requestAnimationFrame(() => { window.setTimeout(loop, 400); });
        };
        loop();
      } catch {
        if (!cancelled) {
          setError('Camera nahi khula — permission do ya manual entry use karo.');
          setStarting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleManual = () => {
    if (!manualCode.trim()) return;
    if (findAndAdd(manualCode)) {
      // Continuous mode: manual add ke baad bhi scanner khula rehta hai
      if (modeRef.current === 'capture') onClose();
      else setManualCode('');
    }
  };

  // ── CAPTURE mode: chhota centered dialog (form ke liye — purani tarah) ──
  if (mode === 'capture') {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanBarcode className="w-5 h-5 text-orange-600" />
              Product Barcode Scan Karo
            </DialogTitle>
          </DialogHeader>
          {renderScannerBody()}
        </DialogContent>
      </Dialog>
    );
  }

  // ── CART mode: FULL-SCREEN scanner — camera poora screen le leta hai ──
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-label="Barcode Scan Karo"
        className="fixed inset-0 z-[70] translate-x-0 translate-y-0 top-0 left-0 max-w-none w-screen h-screen h-[100dvh] w-[100vw] rounded-none border-0 p-0 bg-black overflow-hidden gap-0 sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
      >
        {/* ── Top bar: title + X close button ── */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-2 text-white">
            <ScanBarcode className="w-5 h-5" />
            <div>
              <p className="text-sm font-bold leading-tight">Barcode Scan</p>
              <p className="text-[11px] text-white/70 leading-tight">Product packet saamne lao — cart mein add hota jayega</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Scanner band karo"
            className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ── Camera: poora screen ── */}
        <div className="absolute inset-0">
          {error === 'NO_DETECTOR' ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-sm text-amber-800 max-w-sm">
                📷 Is browser mein camera-scan supported nahi hai (Chrome use karo). Neeche barcode number type karo:
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {/* Scan frame overlay — center scan zone */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-[82%] max-w-md aspect-[3/2]">
                  {/* Corner brackets — kaante ka nishaan */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-green-400 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-green-400 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-green-400 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-green-400 rounded-br-2xl" />
                  {/* Scanning laser line */}
                  <div className="absolute inset-x-6 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-green-400/80 to-transparent animate-pulse" />
                </div>
              </div>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-green-400 animate-spin" />
                    <p className="text-white text-sm font-semibold">Camera khul raha hai...</p>
                  </div>
                </div>
              )}
              {error && error !== 'NO_DETECTOR' && (
                <div className="absolute inset-x-0 bottom-24 bg-red-600/90 p-3">
                  <p className="text-white text-xs text-center">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Bottom panel: unmatched product CTA + manual entry ── */}
        <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent space-y-3">
          {unmatchedCode && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2">
              <p className="text-xs text-amber-800 font-semibold">
                Barcode <span className="font-mono">{unmatchedCode}</span> stock mein nahi hai.
              </p>
              <Button
                onClick={() => openAddProduct(unmatchedCode)}
                className="w-full rounded-xl h-11 bg-gradient-to-r from-orange-500 to-red-600 text-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> Is Barcode Se Naya Product Banao
              </Button>
            </div>
          )}

          {/* Manual entry — collapse-able row */}
          <details className="group">
            <summary className="flex items-center justify-center gap-1.5 text-white/70 text-xs font-medium cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
              <Keyboard className="w-3.5 h-3.5" />
              Barcode number type karna hai?
            </summary>
            <div className="mt-2 bg-white/10 backdrop-blur-sm rounded-2xl p-3 space-y-2">
              <Label className="text-xs text-white/80 flex items-center gap-1">
                <Keyboard className="w-3.5 h-3.5" /> Barcode number
              </Label>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleManual(); }}
                  placeholder="8901234567890"
                  inputMode="numeric"
                  className="rounded-xl h-11 bg-white/90 border-white/20 font-mono"
                />
                <Button onClick={handleManual} disabled={!manualCode.trim()} className="rounded-xl h-11 px-5">
                  Add
                </Button>
              </div>
            </div>
          </details>

          <p className="text-center text-[11px] text-white/50">
            🔍 Ek baar scan — packet hatao, dobara lao = dobara add
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Shared scanner body (capture mode ke dialog ke andar) ──
  function renderScannerBody() {
    return (
      <div className="space-y-3 mt-2">
        {error === 'NO_DETECTOR' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            📷 Is browser mein camera-scan supported nahi hai (Chrome use karo). Neeche barcode number type karo:
          </div>
        ) : (
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {/* Scan frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/3 border-2 border-dashed border-green-400 rounded-xl" />
            </div>
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white text-sm font-semibold">Camera khul raha hai...</p>
              </div>
            )}
            {error && error !== 'NO_DETECTOR' && (
              <div className="absolute inset-x-0 bottom-0 bg-red-600/90 p-2">
                <p className="text-white text-xs text-center">{error}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
          <Label className="text-xs flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5" /> Barcode number type karo
          </Label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleManual(); }}
              placeholder="8901234567890"
              inputMode="numeric"
              className="rounded-xl h-11 bg-white font-mono"
            />
            <Button onClick={handleManual} disabled={!manualCode.trim()} className="rounded-xl h-11 px-5">
              Add
            </Button>
          </div>
        </div>

        <Button variant="outline" onClick={onClose} className="w-full rounded-2xl h-11">
          <X className="w-4 h-4 mr-2" /> Band Karo
        </Button>
      </div>
    );
  }
}
