// Account Status Card — Settings mein guest/account status + cloud sync status dikhata hai
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2, LogIn, LogOut, Cloud, CloudOff, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';

function formatLastSync(ts: number): string {
  if (!ts) return 'Kabhi nahi';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Abhi abhi';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min pehle`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ghante pehle`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function AccountStatusCard() {
  const { mode, user, cloudReady, signOut, loading, sync, syncNow } = useAuth();
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  // "X min pehle" fresh rakhne ke liye har 30s re-render
  useEffect(() => {
    if (mode !== 'account') return;
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, [mode]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  if (loading) {
    return (
      <Card className="rounded-3xl border-0 shadow-lg">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {mode === 'account' ? (
            <Cloud className="w-5 h-5 text-green-600" />
          ) : (
            <CloudOff className="w-5 h-5 text-gray-400" />
          )}
          Account & Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mode === 'account' ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-2xl">
              <UserCircle2 className="w-10 h-10 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Account'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>

            {/* Sync status */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-2xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {sync.syncing ? 'Sync ho raha hai...' : '☁️ Cloud sync active'}
                </p>
                <p className="text-xs text-gray-500">
                  Last backup: {formatLastSync(sync.lastSync)}
                </p>
              </div>
              <Button
                onClick={syncNow}
                disabled={sync.syncing}
                variant="outline"
                size="sm"
                className="rounded-xl h-9 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                {sync.syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Sync
              </Button>
            </div>

            {sync.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-600">{sync.error}</p>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Saara data aapke account se linked hai — naye device pe login karte hi pura data wapas milega.
            </p>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full rounded-2xl h-11 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
              <UserCircle2 className="w-10 h-10 text-gray-400 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Guest Mode</p>
                <p className="text-xs text-gray-500">Data sirf is device pe save hai</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {cloudReady
                ? 'Account banao to data cloud mein backup hoga aur naye device pe bhi milega. Login karte hi is device ka data aapke account se sync ho jayega.'
                : '🔒 Account login jald aa raha hai! Backend connect hone ke baad cloud backup + multi-device sync on ho jayega.'}
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="w-full rounded-2xl h-11 bg-gradient-to-r from-orange-500 to-red-600"
            >
              <LogIn className="w-4 h-4 mr-2" /> Account Banao / Login Karo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
