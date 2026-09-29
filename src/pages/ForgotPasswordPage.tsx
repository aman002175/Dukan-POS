// Forgot Password — standalone page (/forgot-password)
// Flow: email YA mobile → OTP bhejo → naya password + OTP → server-side reset
// 📱 Mobile path: number recovery_phone se linked account dhundhta hai; server
// masked email (duk***@gmail.com) lautaata hai taaki user confirm kar sake —
// full email kabhi expose nahi hoti. OTP row hamesha email se hi bind hoti hai.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Mail, Lock, ShieldCheck, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, KeyRound, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendOtp, resetPasswordWithOtp, isOtpEnabled } from '@/utils/otpService';
import { sanitizeEmail, normalizePhone } from '@/utils/passwordStrength';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';

type Step = 'email' | 'otp' | 'done';
type Identifier = 'email' | 'phone';

// Password policy signup jaisi hi: 8+ chars, 1 number
const PASSWORD_OK = (p: string) => p.length >= 8 && /\d/.test(p);

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  // ── Step state ──
  const [step, setStep] = useState<Step>('email');
  // 📱 Identifier: email ya mobile — user jo yaad ho wahi daale
  const [idKind, setIdKind] = useState<Identifier>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Server se mila masked email (mobile path) — "ye number is email se linked hai"
  const [linkedMaskedEmail, setLinkedMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── UI state ──
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Step 1: identifier daalo, OTP trigger karo (email ya mobile)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    if (idKind === 'email') {
      // 📧 Sanitized email hi server jata hai — whitespace/unicode tricks band
      const cleanEmail = sanitizeEmail(email);
      if (!cleanEmail) {
        setBusy(false);
        setError('Sahi email address daalo');
        return;
      }
      const res = await sendOtp(cleanEmail, 'reset');
      setBusy(false);
      if (!res.ok) { setError(res.message); return; }
      setEmail(cleanEmail);
      setInfo(res.message);
    } else {
      // 📱 Mobile → server recovery_phone se account dhundhta hai, masked email lautaata hai
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone) {
        setBusy(false);
        setError('Sahi 10-digit mobile number daalo');
        return;
      }
      const res = await sendOtp({ phone: cleanPhone }, 'reset');
      setBusy(false);
      if (!res.ok) { setError(res.message); return; }
      setLinkedMaskedEmail(res.maskedEmail ?? '');
      setInfo(res.message);
    }
    setStep('otp');
  };

  // OTP step: OTP + naya password → server reset
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail && idKind === 'email') {
      setError('Email dobara daalo — wapas step 1 pe jao');
      setStep('email');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('6 digit ka OTP daalo (email me aaya hai)');
      return;
    }
    if (!PASSWORD_OK(newPassword)) {
      setError('Naya password 8+ characters + kam se kam 1 number ka hona chahiye');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Password aur Confirm Password match nahi kar rahe');
      return;
    }
    setBusy(true);
    // 📱 Mobile path: phone dobara bhejta hai — server wahi account resolve karta hai
    let target: string | { phone: string };
    if (idKind === 'email') {
      if (!cleanEmail) { setBusy(false); setError('Email dobara daalo — wapas step 1 pe jao'); setStep('email'); return; }
      target = cleanEmail;
    } else {
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone) { setBusy(false); setError('Mobile dobara daalo — wapas step 1 pe jao'); setStep('email'); return; }
      target = { phone: cleanPhone };
    }
    const res = await resetPasswordWithOtp(target, otp.trim(), newPassword);
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    setStep('done');
  };

  // OTP dobara bhejo (usi identifier se, 'reset' purpose)
  const handleResend = async () => {
    setError('');
    setInfo('');
    setResendBusy(true);
    let res;
    if (idKind === 'email') {
      const cleanEmail = sanitizeEmail(email);
      if (!cleanEmail) { setResendBusy(false); setError('Email dobara daalo'); setStep('email'); return; }
      res = await sendOtp(cleanEmail, 'reset');
    } else {
      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone) { setResendBusy(false); setError('Mobile dobara daalo'); setStep('email'); return; }
      res = await sendOtp({ phone: cleanPhone }, 'reset');
    }
    setResendBusy(false);
    if (!res.ok) { setError(res.message); return; }
    setInfo(res.message);
  };

  // Step 3: success — login pe bhejo (saare sessions revoke ho chuke)
  const handleDone = () => {
    navigate('/login', { replace: true });
  };

  if (!isOtpEnabled()) {
    // Backend env missing — app waise bhi is state me login disable dikhata hai
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="pt-10 pb-6 px-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-200">
                <KeyRound className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900">Password Reset</h1>
              <p className="text-gray-500 mt-2 text-sm">Reset service abhi setup nahi hui hai. Thodi der baad try karo.</p>
            </div>
            <div className="px-8 pb-8">
              <Link to="/login">
                <Button className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Login pe wapas jao
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="pt-10 pb-6 px-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-200">
              <Store className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              {step === 'done' ? 'Password Badal Gaya! ✅' : 'Password Bhool Gaye?'}
            </h1>
            <p className="text-gray-500 mt-2 text-sm font-medium">
              {step === 'email' && (idKind === 'email' ? 'Registered email daalo — OTP wahi bheja jayega' : 'Registered mobile daalo — OTP linked email pe jayega')}
              {step === 'otp' && (idKind === 'email' ? `Code bheja gaya: ${email}` : linkedMaskedEmail ? `OTP gaya: ${linkedMaskedEmail}` : 'OTP aapke linked email pe bheja gaya')}
              {step === 'done' && 'Ab naye password se login karo'}
            </p>
          </div>

          {/* Steps indicator */}
          {step !== 'done' && (
            <div className="px-8 flex items-center gap-2 mb-2">
              {(['email', 'otp'] as const).map((s, i) => (
                <div key={s} className="flex-1 flex items-center gap-2">
                  <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === s || (s === 'email' && step === 'otp') ? 'bg-orange-500' : 'bg-gray-200'}`} />
                  {i === 0 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                </div>
              ))}
            </div>
          )}

          <div className="px-8 pb-8 space-y-4">
            {/* ── Step 1: Email YA Mobile ── */}
            {step === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {/* 📱 Identifier chooser — dono options user ko dikhte hain */}
                <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => { setIdKind('email'); setError(''); setInfo(''); }}
                    className={`py-2 rounded-xl text-sm font-bold transition-all ${
                      idKind === 'email' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    📧 Email se
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIdKind('phone'); setError(''); setInfo(''); }}
                    className={`py-2 rounded-xl text-sm font-bold transition-all ${
                      idKind === 'phone' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    📱 Mobile se
                  </button>
                </div>

                {idKind === 'email' && (
                <div className="space-y-1.5">
                  <Label htmlFor="fp-email" className="text-xs text-gray-500 font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dukandar@example.com"
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                )}

                {idKind === 'phone' && (
                <div className="space-y-1.5">
                  <Label htmlFor="fp-phone" className="text-xs text-gray-500 font-semibold">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 14))}
                      placeholder="98765 43210"
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                      autoComplete="tel-national"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">Signup ke waqt joda gaya number — usi email pe OTP jayega.</p>
                </div>
                )}

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg shadow-orange-200"
                >
                  {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
                  OTP Bhejo
                </Button>
              </form>
            )}

            {/* ── Step 2: OTP + naya password ── */}
            {step === 'otp' && (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fp-otp" className="text-xs text-gray-500 font-semibold">6 Digit OTP</Label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-otp"
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="______"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200 tracking-[0.4em] font-bold"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fp-new" className="text-xs text-gray-500 font-semibold">Naya Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-new"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="8+ characters, 1 number"
                      className="h-12 rounded-2xl pl-10 bg-gray-50 border-gray-200"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  {/* 🔐 Live strength meter */}
                  <PasswordStrengthMeter password={newPassword} className="mt-1.5" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fp-confirm" className="text-xs text-gray-500 font-semibold">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="fp-confirm"
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
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg shadow-orange-200"
                >
                  {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <KeyRound className="w-5 h-5 mr-2" />}
                  Password Badlo
                </Button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendBusy}
                    className="text-xs text-gray-500 hover:text-orange-600 font-semibold"
                  >
                    {resendBusy ? 'Bhej rahe hain…' : 'OTP Dobara Bhejo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtp(''); setNewPassword(''); setConfirmPassword(''); setInfo(''); setError(''); }}
                    className="text-xs text-gray-500 hover:text-orange-600 font-semibold"
                  >
                    Email badalna hai?
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 3: Success ── */}
            {step === 'done' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-700">
                    Password successfully badal diya gaya. Security ke liye aapke saare devices se
                    purane sessions logout kar diye gaye hain.
                  </p>
                </div>
                <Button
                  onClick={handleDone}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base shadow-lg shadow-orange-200"
                >
                  Login Karo <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* Back to login */}
            {step !== 'done' && (
              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 font-semibold pt-1"
              >
                <ArrowLeft className="w-4 h-4" /> Login pe wapas jao
              </Link>
            )}

            {/* Info message */}
            {info && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-700">{info}</p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer note — login page jaisa */}
        <div className="mt-6 flex flex-col items-center gap-2 text-white/80 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Data sirf aapka — koi third-party share nahi hota</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-white underline-offset-2 hover:underline">Privacy Policy</Link>
            <span className="text-white/40">·</span>
            <Link to="/terms" className="hover:text-white underline-offset-2 hover:underline">Terms</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
