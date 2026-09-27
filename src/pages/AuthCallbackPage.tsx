// OAuth callback page — Google redirect yahan land karta hai
// Supabase client detectSessionInUrl se tokens handle karta hai; yahan sirf status + returnTo redirect.
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
      setErrorMsg('Backend configured nahi hai');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }
    const client = supabase;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (data.session) {
          setStatus('success');
          // AuthContext pull-on-login + cloud sync handle karega; hum sirf navigate karte hain
          setTimeout(() => navigate(returnTo, { replace: true }), 800);
        } else {
          // detectSessionInUrl abhi token process kar raha ho sakta hai — thoda ruk ke dobara
          setTimeout(() => {
            client.auth.getSession().then(({ data: retry }) => {
              if (retry.session) {
                setStatus('success');
                navigate(returnTo, { replace: true });
              } else {
                setStatus('error');
                setErrorMsg('Login session nahi mila — dobara try karo');
                setTimeout(() => navigate('/login', { replace: true }), 1500);
              }
            });
          }, 600);
        }
      })
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      });
  }, [navigate, returnTo]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Login verify ho raha hai...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">Login successful! 🎉</p>
            <p className="text-gray-400 text-sm mt-1">Data sync ho raha hai...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-semibold">Login fail ho gaya</p>
            <p className="text-red-500 text-sm mt-1">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
