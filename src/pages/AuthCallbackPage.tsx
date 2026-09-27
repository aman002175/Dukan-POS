// OAuth callback page — Google redirect yahan land karta hai
// Robust: token process fail ho ya delay ho, kabhi stuck/white-screen nahi hoga —
// 5s ke andar ya to dashboard pe le jaayega ya error dikhayega.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sanitizeReturnTo } from '@/context/AuthContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    if (!supabase) {
      setStatus('error');
      setErrorMsg('Backend configured nahi hai — Vercel env vars check karo');
      setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }

    let cancelled = false;
    const client = supabase;

    const go = (path: string) => {
      if (!cancelled) navigate(path, { replace: true });
    };

    const check = async () => {
      try {
        // detectSessionInUrl fragment (access_token) process karke session banata hai
        const { data, error } = await client.auth.getSession();
        if (!cancelled && !error && data.session) {
          setStatus('success');
          // AuthContext pull-on-login + cloud sync khud handle karega
          setTimeout(() => go(returnTo), 700);
          return;
        }

        // Thoda ruk ke dobara — token processing abhi chal raha ho sakta hai
        await new Promise(r => setTimeout(r, 900));
        const retry = await client.auth.getSession();
        if (!cancelled && !retry.error && retry.data.session) {
          setStatus('success');
          go(returnTo);
          return;
        }

        // OAuth error URL params (?error=...) — user-friendly message
        const oauthError = searchParams.get('error_description') || searchParams.get('error');
        setStatus('error');
        setErrorMsg(oauthError || 'Login session nahi mila — dobara try karo');
        setTimeout(() => go('/login'), 2500);
      } catch (err) {
        console.error('Auth callback error:', err);
        // Hard fail pe bhi home pe chalo — AuthProvider apne aap session restore karega
        go(returnTo);
      }
    };

    void check();

    // Absolute safety — 6s ke baad bhi yahan ho to home bhejo (white screen kabhi nahi)
    const safety = setTimeout(() => go(returnTo), 6000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [navigate, returnTo, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Login verify ho raha hai...</p>
            <p className="text-gray-400 text-sm mt-1">Google se sign-in ho chuka — session ban raha hai</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">Login successful! 🎉</p>
            <p className="text-gray-400 text-sm mt-1">Dukaan khul raha hai...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">Login complete nahi hua</p>
            <p className="text-red-500 text-sm mt-1 max-w-xs">{errorMsg}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-4 text-sm font-semibold text-orange-600 underline"
            >
              Login page pe wapas jao
            </button>
          </>
        )}
      </div>
    </div>
  );
}
