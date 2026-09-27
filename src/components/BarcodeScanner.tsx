/**
 * BarcodeScanner — Camera se packet barcode scan → product dhundho → cart mein add.
 * Native BarcodeDetector API (Chrome/Edge, offline, zero dependency).
 * Unsupported browser → manual barcode entry fallback.
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

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * 'cart' (default): scan → product dhundho → cart mein add.
   * 'capture': scan → onCapture(code) ko code dedo (inventory form jaise), cart touch MAT karo.
   */
  mode?: 'cart' | 'capture';
  onCapture?: (code: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, mode = 'cart', onCapture }: BarcodeScannerProps) {
  const { state, addToCart, showToast } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
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

  const findAndAdd = useCallback((code: string) => {
    const clean = code.trim();
    if (!clean) return false;

    // CAPTURE mode: sirf code wapas do (inventory form), cart touch mat karo
    if (modeRef.current === 'capture') {
      onCaptureRef.current?.(clean);
      return true;
    }

    // Same barcode dobara 2 sec ke andar ignore (duplicate scan guard)
    const now = Date.now();
    if (lastScanRef.current.code === clean && now - lastScanRef.current.at < 2000) return true;
    lastScanRef.current = { code: clean, at: now };

    const product = stateRef.current.products.find(p => (p.barcode || '').trim() === clean);
    if (!product) {
      setUnmatchedCode(clean);
      showToast(`Barcode ${clean} kisi product se match nahi hua`, 'error');
      return false;
    }
    setUnmatchedCode('');
    if (product.stock <= 0) {
      showToast(`"${product.name}" ka stock khatam hai`, 'error');
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

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setError('');
      setManualCode('');
      setStarting(false);
      setUnmatchedCode('');
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
                if (ok) {
                  // Success par dialog band (single-scan flow)
                  onClose();
                  return;
                }
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
    if (findAndAdd(manualCode)) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-orange-600" />
            {mode === 'capture' ? 'Product Barcode Scan Karo' : 'Barcode Scan Karo'}
          </DialogTitle>
        </DialogHeader>

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

          {mode === 'cart' && unmatchedCode && (
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
      </DialogContent>
    </Dialog>
  );
}
