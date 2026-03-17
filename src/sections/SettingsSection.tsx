// Settings Section - Business Profile & Data Sync
import { useState, useRef } from 'react';
import { 
  Store, 
  User, 
  Phone, 
  MapPin, 
  Save, 
  Upload, 
  Download, 
  RefreshCw,
  Trash2,
  AlertTriangle,
  FileJson,
  Share2,
  Smartphone,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { exportData, importData } from '@/utils/storage';

export function SettingsSection() {
  const { state, updateBusinessProfile, uploadData, downloadData, resetData, showToast } = useApp();
  const [profile, setProfile] = useState(state.businessProfile);
  const [syncCode, setSyncCode] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = () => {
    updateBusinessProfile(profile);
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const code = await uploadData();
      setGeneratedCode(code);
    } catch (error) {
      console.error('Upload failed:', error);
    }
    setIsUploading(false);
  };

  const handleDownload = async () => {
    if (!syncCode || syncCode.length !== 6) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadData(syncCode);
      setSyncCode('');
    } catch (error) {
      console.error('Download failed:', error);
    }
    setIsDownloading(false);
  };

  // Export data to file
  const handleExportToFile = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `dukaan-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Backup file downloaded! Share it via WhatsApp/Bluetooth', 'success');
  };

  // Import data from file
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = importData(content);
        if (success) {
          setImportStatus('success');
          showToast('Data imported successfully! Refreshing...', 'success');
          // Reload page after 2 seconds to reflect imported data
          setTimeout(() => window.location.reload(), 2000);
        } else {
          setImportStatus('error');
          showToast('Failed to import data. Invalid file format.', 'error');
        }
      } catch (error) {
        setImportStatus('error');
        showToast('Error reading file', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    resetData();
    setShowResetDialog(false);
    setProfile({
      shopName: 'My Kirana Store',
      ownerName: '',
      phone: '',
      address: '',
    });
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Business Profile */}
      <Card className="rounded-3xl border-0 shadow-lg mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="w-5 h-5 text-orange-500" />
            Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-600">Shop Name</Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={profile.shopName}
                  onChange={(e) => setProfile({ ...profile, shopName: e.target.value })}
                  placeholder="Enter shop name"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Owner Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={profile.ownerName}
                  onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                  placeholder="Enter owner name"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="Enter phone number"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-600">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Enter shop address"
                  className="pl-10 rounded-2xl h-12"
                />
              </div>
            </div>
          </div>
          <Button
            onClick={handleSaveProfile}
            className="w-full rounded-2xl h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          >
            <Save className="w-5 h-5 mr-2" />
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Offline File Backup - NEW SECTION */}
      <Card className="rounded-3xl border-0 shadow-lg mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="w-5 h-5 text-purple-500" />
            Offline File Backup (No Internet Needed!)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export to File */}
          <div className="bg-purple-50 rounded-2xl p-4">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Data to File
            </h4>
            <p className="text-sm text-purple-700 mb-4">
              Download a backup file and share it via WhatsApp, Bluetooth, ShareIt, or any file sharing app. 
              <strong> No internet required!</strong>
            </p>
            <Button
              onClick={handleExportToFile}
              className="w-full rounded-2xl h-12 bg-purple-600 hover:bg-purple-700"
            >
              <FileJson className="w-5 h-5 mr-2" />
              Download Backup File
            </Button>
            <p className="text-xs text-purple-600 mt-2 text-center">
              File will be saved as: dukaan-backup-YYYY-MM-DD.json
            </p>
          </div>

          {/* Import from File */}
          <div className="bg-amber-50 rounded-2xl p-4">
            <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Data from File
            </h4>
            <p className="text-sm text-amber-700 mb-4">
              Receive a backup file from another phone? Upload it here to restore all data.
            </p>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json"
              className="hidden"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full rounded-2xl h-12 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Select Backup File
            </Button>

            {importStatus === 'success' && (
              <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                <span>Data imported successfully! Refreshing...</span>
              </div>
            )}
            {importStatus === 'error' && (
              <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                <X className="w-4 h-4" />
                <span>Failed to import. Please check the file.</span>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <h4 className="font-medium text-gray-700 mb-3">How it works:</h4>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Export karein - ek .json file download hogi</li>
              <li>Us file ko WhatsApp/Bluetooth/ShareIt se dusre phone bhejein</li>
              <li>Dusre phone mein yahi app kholein</li>
              <li>&quot;Select Backup File&quot; par click karein aur file choose karein</li>
              <li>Sara data automatically sync ho jayega!</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Sync */}
      <Card className="rounded-3xl border-0 shadow-lg mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            Cloud Sync (Internet Required)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload */}
          <div className="bg-blue-50 rounded-2xl p-4">
            <h4 className="font-medium text-blue-900 mb-2">Upload Data to Cloud</h4>
            <p className="text-sm text-blue-700 mb-4">
              Generate a 6-digit code to access your data on another device.
            </p>
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full rounded-2xl h-12 bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-5 h-5 mr-2" />
              {isUploading ? 'Uploading...' : 'Generate Sync Code'}
            </Button>
            {generatedCode && (
              <div className="mt-4 bg-white rounded-2xl p-4 text-center">
                <p className="text-sm text-gray-500 mb-1">Your Sync Code</p>
                <p className="text-4xl font-bold text-blue-600 tracking-wider">{generatedCode}</p>
                <p className="text-xs text-gray-400 mt-2">Valid for 30 minutes</p>
              </div>
            )}
          </div>

          {/* Download */}
          <div className="bg-green-50 rounded-2xl p-4">
            <h4 className="font-medium text-green-900 mb-2">Download Data from Cloud</h4>
            <p className="text-sm text-green-700 mb-4">
              Enter the 6-digit code to sync data to this device.
            </p>
            <div className="flex gap-3">
              <Input
                value={syncCode}
                onChange={(e) => setSyncCode(e.target.value.slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="flex-1 rounded-2xl h-12 text-center text-2xl tracking-wider font-mono"
                maxLength={6}
              />
              <Button
                onClick={handleDownload}
                disabled={isDownloading || syncCode.length !== 6}
                className="rounded-2xl h-12 px-6 bg-green-600 hover:bg-green-700"
              >
                <Download className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 rounded-2xl p-4">
            <h4 className="font-medium text-red-900 mb-2">Reset All Data</h4>
            <p className="text-sm text-red-700 mb-4">
              This will permanently delete all products, customers, sales, and settings. This action cannot be undone.
            </p>
            <Button
              onClick={() => setShowResetDialog(true)}
              variant="outline"
              className="w-full rounded-2xl h-12 border-red-300 text-red-600 hover:bg-red-100"
            >
              <Trash2 className="w-5 h-5 mr-2" />
              Reset All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Reset All Data?"
        description="This will permanently delete all your data including products, customers, sales history, and settings. This action cannot be undone."
        confirmText="Yes, Reset Everything"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
