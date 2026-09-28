// Login Page — Dukaan POS branded
// Tabs: Sign In | Sign Up (email/password) + Google OAuth + Guest mode
// returnTo param support: ?returnTo=/koi-path → login ke baad wahi page
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, Loader2, ArrowRight, Mail, Lock, User as UserIcon, ShieldCheck, Cloud, CloudOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, sanitizeReturnTo } from '@/context/AuthContext';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type Tab = 'signin' | 'signup';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithGoogle, signIn, signUp, cloudReady } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle(returnTo);
      // OAuth redirect ho jayega — yahan code nahi pahunchega
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google login fail ho gaya');
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password) {
      setError('Email aur password dono daalo');
      return;
    }
    if (tab === 'signup') {
      // 🛡️ Password policy (pentest R4-A2: "123456" signup ho jaata tha).
      // Server pe bhi Supabase Auth settings se enforce hoga — ye user ko
      // pehle hi bata deta hai, taaki signup fail na ho.
      if (password.length < 8) {
        setError('Password kam se kam 8 characters ka hona chahiye');
        return;
      }
      if (!/\d/.test(password)) {
        setError('Password me kam se kam 1 number daalo');
        return;
      }
      if (password !== confirmPassword) {
        setError('Password aur Confirm Password match nahi kar rahe');
        return;
      }
    }

    setEmailLoading(true);
    try {
      if (tab === 'signup') {
        const { needsEmailConfirm } = await signUp(email.trim(), password);
        if (needsEmailConfirm) {
          setInfo(`✅ Account ban gaya! ${email.trim()} pe bheji gayi email verify karo, phir sign in karo.`);
          setTab('signin');
        } else {
          // Auto-logged-in (email confirmation OFF) — onAuthStateChange → sync → dashboard
          navigate(returnTo, { replace: true });
        }
      } else {
        await signIn(email.trim(), password);
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kuch galat ho gaya';
      // Common Supabase errors ko friendly banao
      if (msg.includes('Invalid login credentials')) setError('Email ya password galat hai');
      // 🔐 Email enumeration rok: "ye email registered hai" bolna attacker ko
      // batata hai ki kaun sa email tumhare dukaan ka hai (phir brute-force/OTP abuse).
      // Sign Up + Sign In dono ke liye SAME generic message — UI bhi hint na de.
      else if (msg.includes('already registered')) setError('Email ya password galat hai — ya ye email pehle se registered hai, Sign In try karo');
      else      if (msg.includes('Email not confirmed')) setError('Pehle email verify karo (inbox check karo), phir sign in');
      // Supabase leaked-password protection (HaveIBeenPwned) ka error
      else if (msg.includes('weak_password') || msg.toLowerCase().includes('password should be')) {
        setError('Ye password bahut kamzor hai (ya pehle leak ho chuka hai) — naya strong password daalo');
      }
      else if (msg.includes('rate limit')) setError('Bahut zyada tries — thodi der baad koshish karo');
      else setError(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGuest = () => {
    // Guest mode — seedha dashboard, data localStorage mein
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="pt-10 pb-6 px-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-200">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dukaan POS</h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">
              Kirana dukandaron ka smart billing + khata app
            </p>
          </div>

          {/* Tabs — Sign In / Sign Up */}
          {cloudReady && (
            <div className="mx-8 mb-4 grid grid-cols-2 gap-1 bg-gray-100 rounded-2xl p-1">
              <button
                onClick={() => { setTab('signin'); setError(''); setInfo(''); }}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tab === 'signin' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setTab('signup'); setError(''); setInfo(''); }}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                  tab === 'signup' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="px-8 pb-8 space-y-3">
            {/* Google Sign-In */}
            <Button
              onClick={handleGoogle}
              disabled={googleLoading || !cloudReady}
              className="w-full h-12 rounded-2xl bg-white text-gray-800 border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 font-semibold text-base shadow-sm disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
              ) : (
                <span className="mr-3"><GoogleIcon /></span>
              )}
              Continue with Google
              {!cloudReady && <CloudOff className="w-4 h-4 ml-2 text-gray-400" />}
              {cloudReady && <Cloud className="w-4 h-4 ml-2 text-green-500" />}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">ya email se</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email/Password Form */}
            {cloudReady ? (
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {tab === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs text-gray-500 font-semibold">Dukaan Malik ka Naam (optional)</Label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ramesh Kumar"
                        className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-gray-500 font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dukandar@example.com"
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs text-gray-500 font-semibold">Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tab === 'signup' ? '8+ characters, me 1 number' : 'Aapka password'}
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                      autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                      required
                    />
                  </div>
                  {tab === 'signup' && (
                    <p className="text-xs text-gray-400">Password: 8+ characters aur kam se kam 1 number.</p>
                  )}
                </div>
                {tab === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs text-gray-500 font-semibold">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Password dobara likho"
                        className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg shadow-orange-200"
                >
                  {emailLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : null}
                  {tab === 'signup' ? 'Account Banao' : 'Sign In Karo'}
                </Button>
              </form>
            ) : (
              /* Backend not configured — coming soon placeholder */
              <div className="relative">
                <button
                  disabled
                  className="w-full h-12 rounded-2xl bg-gray-100 text-gray-400 font-semibold text-base flex items-center justify-center cursor-not-allowed select-none"
                >
                  <Mail className="w-5 h-5 mr-3" />
                  Email / Password se Sign Up
                </button>
                <span className="absolute -top-2.5 right-4 bg-amber-400 text-amber-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  BACKEND SETUP PENDING
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">ya</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Guest Mode */}
            <Button
              onClick={handleGuest}
              className="w-full h-12 rounded-2xl bg-gray-800 hover:bg-gray-900 text-white font-bold text-base shadow-lg"
            >
              Continue without login
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
              Guest mode mein saara data <strong className="text-gray-500">is device</strong> pe safe rahega.
              <br />Baad mein account bana ke cloud backup on kar sakte ho.
            </p>
          </div>

          {/* Info (email confirmation sent etc.) */}
          {info && (
            <div className="mx-8 mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-700">{info}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-8 mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-white/80 text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span>Data sirf aapka — koi third-party share nahi hota</span>
        </div>
      </div>
    </div>
  );
}
