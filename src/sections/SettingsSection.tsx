// Settings Section - Business Profile, PIN Protection, Data Backup, PDF Download
import { useState, useRef, useEffect } from 'react';
import {
  Store, User, Phone, MapPin, Save, Upload, Download,
  Trash2, AlertTriangle, FileJson, Share2, Smartphone, Check, X,
  Lock, Shield, Eye, EyeOff, KeyRound, FileText, MessageCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useApp } from '@/context/AppContext';
import { exportData, importData } from '@/utils/storage';
import { clearLastSync } from '@/lib/cloudSync';
import { downloadAllBillsHTML, themes } from '@/utils/billPDF';
import type { BillTheme } from '@/utils/billPDF';
import { AI_MODELS, getSelectedModel, setSelectedModel } from '@/utils/aiService';
import { AccountStatusCard } from '@/components/AccountStatusCard';

function JSONBulkImport() {
  const { showToast } = useApp();
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = () => {
    if (!jsonInput.trim()) { showToast('Pehle JSON paste karo!', 'error'); return; }
    setIsImporting(true);
    try {
      const items = JSON.parse(jsonInput);
      if (!Array.isArray(items) || items.length === 0) {
        showToast('JSON array honi chahiye!', 'error');
        setIsImporting(false);
        return;
      }
      window.dispatchEvent(new CustomEvent('ai-bulk-import', { detail: { items } }));
      setJsonInput('');
      showToast(`${items.length} items import ho rahe hain!`, 'success');
    } catch {
      showToast('JSON valid nahi hai! Format check karo.', 'error');
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-2 min-w-0">
      <textarea
        value={jsonInput}
        onChange={e => setJsonInput(e.target.value)}
        placeholder='[{"name":"Maggi","salePrice":12,"stock":50,"unit":"packet","category":"Instant"}]'
        className="w-full h-32 bg-white border border-green-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-300 resize-none break-all"
      />
      <Button onClick={handleImport} disabled={isImporting || !jsonInput.trim()}
        className="w-full rounded-2xl h-11 bg-green-600 hover:bg-green-700">
        <FileJson className="w-5 h-5 mr-2" /> {isImporting ? 'Import ho raha hai...' : 'JSON Import Karo'}
      </Button>
    </div>
  );
}

export function SettingsSection() {
  const {
    state, updateBusinessProfile,
    resetData, showToast, setAppPin, changeAppPin, verifyPin
  } = useApp();

  const [profile, setProfile] = useState(state.businessProfile);
  const [selectedModel, setSelectedModelId] = useState(getSelectedModel());

  // Sync model state when auto model switching occurs
  useEffect(() => {
    const handler = (e: Event) => {
      const modelId = (e as CustomEvent).detail?.modelId;
      if (modelId) setSelectedModelId(modelId);
    };
    window.addEventListener('ai-model-switched', handler);
    return () => window.removeEventListener('ai-model-switched', handler);
  }, []);

  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PIN state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showPinChange, setShowPinChange] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [oldPinInput, setOldPinInput] = useState('');
  const [resetPinVerify, setResetPinVerify] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');

  // PDF state
  const [showAllBillsPDF, setShowAllBillsPDF] = useState(false);
  const [pdfTheme, setPdfTheme] = useState<BillTheme>('modern');

  const handleSaveProfile = () => updateBusinessProfile(profile);

  const handleExportToFile = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dukaan-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup file download ho gaya!', 'success');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (importData(content)) {
        setImportStatus('success');
        // 🔑 Import ke baad lastSync clear karo — warna agle reload pe login-sync
        // cloud ka PURANA data laa kar imported data ko overwrite kar deta tha.
        // Ab local (imported) data authoritative hai → agla sync ise cloud pe push karega.
        clearLastSync();
        showToast('Data import ho gaya! Refresh ho raha hai...', 'success');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setImportStatus('error');
        showToast('Import failed. File check karo.', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── PIN Setup ──
  const handleSetPin = () => {
    setPinError('');
    if (pinInput.length < 4) { setPinError('PIN kam se kam 4 digit ka hona chahiye'); return; }
    if (pinInput !== newPinInput) { setPinError('Dono PIN match nahi kar rahe'); return; }
    setAppPin(pinInput);
    setPinInput(''); setNewPinInput('');
    setShowPinSetup(false);
  };

  const handleChangePin = () => {
    setPinError('');
    if (!verifyPin(oldPinInput)) { setPinError('Purana PIN galat hai'); return; }
    if (newPinInput.length < 4) { setPinError('Naya PIN 4 digit ka hona chahiye'); return; }
    if (newPinInput !== confirmPinInput) { setPinError('Naya PIN match nahi kar raha'); return; }
    const ok = changeAppPin(oldPinInput, newPinInput);
    if (ok) { setOldPinInput(''); setNewPinInput(''); setConfirmPinInput(''); setShowPinChange(false); }
  };

  // ── Reset with PIN ──
  const handleResetAttempt = () => {
    if (state.appPin) {
      setShowResetConfirm(true);
      setResetPinVerify('');
      setPinError('');
    } else {
      setShowResetConfirm(true);
      setResetPinVerify('CONFIRM');
    }
  };

  const handleConfirmReset = () => {
    setPinError('');
    if (state.appPin) {
      if (!verifyPin(resetPinVerify)) { setPinError('PIN galat hai'); return; }
    } else {
      if (resetPinVerify !== 'CONFIRM') { setPinError('"CONFIRM" type karo'); return; }
    }
    resetData();
    setShowResetConfirm(false);
    setResetPinVerify('');
    setProfile({ shopName: 'My Kirana Store', ownerName: '', phone: '', address: '' });
  };

  // ── All Bills PDF ──
  const handleDownloadAllBills = () => {
    if (state.sales.length === 0) { showToast('Koi bill nahi hai', 'error'); return; }
    downloadAllBillsHTML(state.sales, state.customers, state.businessProfile, pdfTheme);
    showToast(`${state.sales.length} bills download ho gaye!`, 'success');
    setShowAllBillsPDF(false);
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {/* ── Account / Cloud Sync Status ── */}
      <AccountStatusCard />

      {/* ── Business Profile ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="w-5 h-5 text-orange-500" /> Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Shop Name', key: 'shopName', icon: Store, placeholder: 'Dukan ka naam' },
              { label: 'Owner Name', key: 'ownerName', icon: User, placeholder: 'Malik ka naam' },
              { label: 'Phone', key: 'phone', icon: Phone, placeholder: 'Mobile number' },
              { label: 'Address', key: 'address', icon: MapPin, placeholder: 'Dukan ka pata' },
              { label: 'GSTIN (optional)', key: 'gstin', icon: FileText, placeholder: 'GST number' },
              { label: 'UPI ID (for QR in bill)', key: 'upiId', icon: KeyRound, placeholder: 'yourname@upi or 9999999999@paytm' },
              { label: 'Bill Footer Message', key: 'festivalMsg', icon: MessageCircle, placeholder: 'e.g. Eid Mubarak! Special 10% off this week' },
            ].map(({ label, key, icon: Icon, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-gray-600 text-sm">{label}</Label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={profile[key as keyof typeof profile] || ''}
                    onChange={e => setProfile({ ...profile, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="pl-10 rounded-2xl h-11"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleSaveProfile}
            className="w-full rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600">
            <Save className="w-5 h-5 mr-2" /> Profile Save Karo
          </Button>
        </CardContent>
      </Card>

      {/* ── AI Model Selection Card ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-purple-600" /> AI Assistant Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Primary model choose karo. Agar daily rate limit (429) hit hogi toh system auto-fallback se alternate models try karega.
          </p>
          <div className="space-y-2">
            {AI_MODELS.map(m => {
              const isSelected = selectedModel === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setSelectedModelId(m.id);
                    showToast(`AI Model set to ${m.name}`, 'success');
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50/70 shadow-sm'
                      : 'border-gray-100 hover:border-purple-200 bg-white'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{m.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                        {m.provider}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{m.description}</p>
                    <code className="text-[10px] text-gray-400 font-mono block mt-1">{m.id}</code>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── All Bills PDF ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-orange-500" /> Sare Bills Download Karo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            {state.sales.length} bills available — theme choose karke ek PDF mein download karo
          </p>
          <Button
            onClick={() => setShowAllBillsPDF(true)}
            disabled={state.sales.length === 0}
            className="w-full rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600"
          >
            <Download className="w-5 h-5 mr-2" /> Download All Bills
          </Button>
        </CardContent>
      </Card>

      {/* ── Security / PIN ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-blue-500" /> App Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  {state.appPin ? '🔒 PIN Laga Hua Hai' : '🔓 Koi PIN Nahi'}
                </p>
                <p className="text-xs text-blue-600">
                  {state.appPin ? 'Data delete ke liye PIN chahiye' : 'Data delete ke liye PIN set karo'}
                </p>
              </div>
            </div>
            {!state.appPin ? (
              <Button size="sm" onClick={() => setShowPinSetup(true)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700">
                Set PIN
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowPinChange(true)}
                className="rounded-xl border-blue-200 text-blue-700">
                Change
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Offline Backup ── */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="w-5 h-5 text-purple-500" /> Offline Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 min-w-0 overflow-hidden">
          <div className="bg-purple-50 rounded-2xl p-4 min-w-0">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 flex-shrink-0" /> Data Export
            </h4>
            <p className="text-sm text-purple-700 mb-3 break-words">
              JSON file download karo — WhatsApp/Bluetooth se share karo. <b>Internet nahi chahiye!</b>
            </p>
            <Button onClick={handleExportToFile} className="w-full rounded-2xl h-11 bg-purple-600 hover:bg-purple-700">
              <FileJson className="w-5 h-5 mr-2" /> Backup File Download Karo
            </Button>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 min-w-0">
            <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 flex-shrink-0" /> Data Import
            </h4>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} variant="outline"
              className="w-full rounded-2xl h-11 border-amber-300 text-amber-700 hover:bg-amber-100">
              <Share2 className="w-5 h-5 mr-2" /> Backup File Select Karo
            </Button>
            {importStatus === 'success' && (
              <div className="mt-2 flex items-center gap-2 text-green-600 text-sm">
                <Check className="w-4 h-4" /> Import ho gaya!
              </div>
            )}
            {importStatus === 'error' && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <X className="w-4 h-4" /> Import failed. File check karo.
              </div>
            )}
          </div>
          <div className="bg-green-50 rounded-2xl p-4 min-w-0 overflow-hidden">
            <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
              <FileJson className="w-4 h-4 flex-shrink-0" /> JSON Bulk Import
            </h4>
            <p className="text-sm text-green-700 mb-3 break-words">
              JSON paste karo aur saare products ek saath add ho jayenge. Format: <code className="bg-green-100 px-1 break-all whitespace-normal inline">[{"{"}name:"Maggi",salePrice:12,stock:50,unit:"packet"{"}"}]</code>
            </p>
            <JSONBulkImport />
          </div>
        </CardContent>
      </Card>

      {/* ── Danger Zone ── */}
      <Card className="rounded-3xl border-0 shadow-lg border border-red-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <AlertTriangle className="w-5 h-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="font-medium text-red-900 mb-1">Sab Data Delete Karo</p>
            <p className="text-sm text-red-700 mb-4">
              Yeh action undo nahi hoga. {state.appPin ? 'Confirm karne ke liye PIN chahiye.' : 'Type "CONFIRM" to proceed.'}
            </p>
            <Button onClick={handleResetAttempt} variant="outline"
              className="w-full rounded-2xl h-11 border-red-300 text-red-600 hover:bg-red-100">
              <Trash2 className="w-5 h-5 mr-2" /> Reset All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── All Bills PDF Theme Dialog ── */}
      <Dialog open={showAllBillsPDF} onOpenChange={setShowAllBillsPDF}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>📄 All Bills Download</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-500">Bill theme choose karo:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(themes) as [BillTheme, typeof themes[BillTheme]][]).map(([key, t]) => (
                <button key={key} onClick={() => setPdfTheme(key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${pdfTheme === key ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <div className="mt-1.5 h-3 rounded-full" style={{ background: t.headerBg }} />
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">
              {state.sales.length} bills download honge
            </p>
            <Button onClick={handleDownloadAllBills}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-orange-500 to-red-600">
              <Download className="w-4 h-4 mr-2" /> Download Karo
            </Button>
            <p className="text-xs text-gray-400 text-center">
              File open karke browser se Print → Save as PDF karo
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PIN Setup Dialog ── */}
      <Dialog open={showPinSetup} onOpenChange={v => { setShowPinSetup(v); setPinError(''); setPinInput(''); setNewPinInput(''); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>🔒 PIN Set Karo</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">Naya PIN (min 4 digits)</Label>
              <div className="relative mt-1">
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  className="rounded-xl h-11 text-center text-xl tracking-widest pr-10"
                />
                <button onClick={() => setShowPin(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-sm">PIN Confirm Karo</Label>
              <Input
                type="password" inputMode="numeric"
                value={newPinInput}
                onChange={e => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="rounded-xl h-11 text-center text-xl tracking-widest mt-1"
              />
            </div>
            {pinError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{pinError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPinSetup(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleSetPin} className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700">
                <Lock className="w-4 h-4 mr-2" /> Set PIN
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PIN Change Dialog ── */}
      <Dialog open={showPinChange} onOpenChange={v => { setShowPinChange(v); setPinError(''); setOldPinInput(''); setNewPinInput(''); setConfirmPinInput(''); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>🔑 PIN Change Karo</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">Purana PIN</Label>
              <Input type="password" inputMode="numeric"
                value={oldPinInput} onChange={e => setOldPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••" className="rounded-xl h-11 text-center text-xl tracking-widest mt-1" />
            </div>
            <div>
              <Label className="text-sm">Naya PIN</Label>
              <Input type="password" inputMode="numeric"
                value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••" className="rounded-xl h-11 text-center text-xl tracking-widest mt-1" />
            </div>
            <div>
              <Label className="text-sm">Naya PIN Confirm</Label>
              <Input type="password" inputMode="numeric"
                value={confirmPinInput} onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••" className="rounded-xl h-11 text-center text-xl tracking-widest mt-1" />
            </div>
            {pinError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{pinError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowPinChange(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleChangePin} className="flex-1 rounded-xl h-11 bg-blue-600 hover:bg-blue-700">
                <KeyRound className="w-4 h-4 mr-2" /> Change PIN
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Confirm Dialog ── */}
      <Dialog open={showResetConfirm} onOpenChange={v => { setShowResetConfirm(v); setResetPinVerify(''); setPinError(''); }}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>⚠️ Sab Data Delete?</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">Yeh action UNDO nahi ho sakti!</p>
              <p>Saare products, customers, sales, khata — sab delete ho jayega.</p>
            </div>
            <div>
              <Label className="text-sm">
                {state.appPin ? '🔒 Apna PIN daalo confirm karne ke liye:' : 'Type "CONFIRM" to proceed:'}
              </Label>
              <Input
                type={state.appPin ? 'password' : 'text'}
                inputMode={state.appPin ? 'numeric' : 'text'}
                value={resetPinVerify}
                onChange={e => setResetPinVerify(state.appPin ? e.target.value.replace(/\D/g, '').slice(0, 8) : e.target.value)}
                placeholder={state.appPin ? '••••' : 'CONFIRM'}
                className="rounded-xl h-11 text-center font-bold mt-1"
                autoFocus
              />
            </div>
            {pinError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{pinError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="flex-1 rounded-xl h-11">Cancel</Button>
              <Button onClick={handleConfirmReset} className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-700">
                <Trash2 className="w-4 h-4 mr-2" /> Haan, Delete Karo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
