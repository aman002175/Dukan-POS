// Auth Context — Guest mode (localStorage) + Account mode (Supabase)
// Account mode: Google OAuth + Email/Password sign-up/sign-in + cloud sync status
// Guest mode hamesha available — Supabase env vars na hon to account features disabled.
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from '@/lib/supabase';
import { pullCloudState, pushCloudState, getLastSyncAt, clearLastSync } from '@/lib/cloudSync';
import { setActiveScope, migrateLegacyKeys, adoptGuestData, clearUser } from '@/lib/namespacedStorage';

/** Purani (pre-namespace) global keys — migration ke liye */
const LEGACY_STATE_KEY = 'dukaan_pos_data';
const LEGACY_CART_KEY = 'dukaan_pos_cart';

/**
 * AppContext har state change pe 'dukaan-state-changed' dispatch karta hai.
 * AuthProvider usko debounce karke cloud pe push karta hai (neeche wala effect).
 * (Dono providers ek doosre ko directly import nahi kar sakte — isliye event decoupling.)
 */
export type AuthMode = 'guest' | 'account';

export interface SyncStatus {
  /** Push/pull chal raha hai */
  syncing: boolean;
  /** Pichhli successful sync (ms epoch, 0 = kabhi nahi) */
  lastSync: number;
  /** Last sync operation ka error (null = theek) */
  error: string | null;
}

interface AuthContextType {
  /** 'account' = login hua; 'guest' = bina login use kar raha hai */
  mode: AuthMode;
  user: User | null;
  /** true jab backend configured hai (env vars set) */
  cloudReady: boolean;
  loading: boolean;
  /** Cloud sync status (account mode) */
  sync: SyncStatus;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  /** Email sign-up — Supabase email confirmation OFF ho to seedha login, ON ho to verify email bhejega */
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (options?: { forgetOnDevice?: boolean }) => Promise<void>;
  /** Manual "Sync Now" — pull + push */
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_KEY = 'dukaan_guest_id';

/** Stable guest ID — ek hi device/browser mein same rahega */
export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = `guest-${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

/** returnTo path safe rakho — sirf in-app paths allow (open redirect se bachne ke liye) */
export function sanitizeReturnTo(rt: string | null | undefined): string {
  if (!rt) return '/';
  if (!rt.startsWith('/') || rt.startsWith('//')) return '/';
  return rt;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCloudConfigured);
  const [sync, setSync] = useState<SyncStatus>(() => ({
    syncing: false,
    lastSync: isCloudConfigured ? getLastSyncAt() : 0,
    error: null,
  }));
  const prevUserIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cloud sync: pull on login, debounced push on state change ──
  const doSyncNow = useCallback(async (currentSession: Session) => {
    setSync(prev => ({ ...prev, syncing: true, error: null }));
    try {
      // 1. Cloud se latest laao (login pe fresh restore)
      const pulled = await pullCloudState(currentSession);
      if (!pulled.ok) throw new Error(pulled.error || 'Pull fail hua');
      // Pull ne localStorage badla to AppContext ko reload karne ke liye event bhejo
      if (pulled.pulled) window.dispatchEvent(new CustomEvent('dukaan-cloud-pulled'));
      // 2. Local state cloud pe push karo (backup + merge-out)
      const pushed = await pushCloudState(currentSession);
      // local-empty-guard skip hai, error nahi — empty local data cloud pe push nahi hota
      if (!pushed.ok && pushed.error !== 'local-empty-guard') {
        throw new Error(pushed.error || 'Push fail hua');
      }
      setSync({ syncing: false, lastSync: getLastSyncAt(), error: null });
    } catch (err) {
      setSync(prev => ({
        ...prev,
        syncing: false,
        error: err instanceof Error ? err.message : 'Sync fail hua',
      }));
    }
  }, []);

  // Debounced push — AppContext ke state-change events ko debounce karke cloud pe push
  useEffect(() => {
    if (!session) return;
    const handleStateChanged = () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(async () => {
        try {
          const pushed = await pushCloudState(session);
          // local-empty-guard = cookies clear hone pe empty local data ko cloud pe
          // push NA kiya gaya (protection) — ye error nahi, skip hai.
          if (pushed.ok) {
            setSync(prev => ({ ...prev, lastSync: getLastSyncAt(), error: null }));
          } else if (pushed.error === 'local-empty-guard') {
            setSync(prev => ({ ...prev, error: null }));
          } else {
            setSync(prev => ({ ...prev, error: pushed.error || 'Push fail hua' }));
          }
        } catch (err) {
          setSync(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Push fail hua' }));
        }
      }, 3000);
    };
    window.addEventListener('dukaan-state-changed', handleStateChanged);
    return () => window.removeEventListener('dukaan-state-changed', handleStateChanged);
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Initial session check (Google redirect / email link ke baad bhi yahi restore karega)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Login/logout events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      sub.subscription.unsubscribe();
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  // Login detect → cloud pull + initial push; Logout → sync status clear
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (session?.user && userId && userId !== prevId) {
      // 🔐 NAMESPACE SWITCH — hamesha pull se PEHLE. Isse hi localStorage ki
      // keys badalti hain (dukaan_pos_data_<userId>), aur legacy global key
      // migrate hoti hai. Order galat hua to hum pichle user ki namespace se
      // padhkar naye user ki row me likh denge — wahi original leak hai.
      setActiveScope({ mode: 'account', userId });
      // 🎁 GUEST ADOPTION — pehle guest mode me dukaan chalayi, phir account
      // banaya: guest ka data naye account ki khaali namespace me aa jaata hai
      // (sirf tab jab naya account bilkul khaali ho — kisi ki dukaan overwrite nahi).
      const adopted = adoptGuestData([LEGACY_STATE_KEY, LEGACY_CART_KEY]);
      if (adopted.length) {
        console.info('🎁 Guest mode ka data naye account me adopt ho gaya:', adopted);
      }
      const migration = migrateLegacyKeys([LEGACY_STATE_KEY, LEGACY_CART_KEY]);
      if (migration.discarded.length) {
        console.warn(
          '🧹 Pichle user ka local data mila — migrate nahi kiya (cross-account leak protection):',
          migration.discarded,
        );
      }
      // AppContext ko batayein ki namespace badli — wo apni memory reload kare
      window.dispatchEvent(new CustomEvent('dukaan-scope-changed'));
      void doSyncNow(session);
    } else if (!userId && prevId) {
      // ── LOGOUT ──
      // Scope guest par wapas: agla user (ya guest) A ka data dekh hi nahi sakta.
      // A ka namespaced data DELETE nahi hota — offline-first ke liye zaroori hai
      // (wapas login karne par uski dukaan turant milti hai, bina network ke).
      setActiveScope({ mode: 'guest' });
      clearLastSync();
      setSync({ syncing: false, lastSync: 0, error: null });
      window.dispatchEvent(new CustomEvent('dukaan-scope-changed'));
    }
  }, [session, doSyncNow]);

  // State changes → push scheduling AppContext karega (scheduleCloudPush via context value).

  const signInWithGoogle = useCallback(async (returnTo?: string) => {
    if (!supabase) return;
    const target = sanitizeReturnTo(returnTo);
    const redirectTo = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(target)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Backend configured nahi hai');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // email confirmations ON ho to session null aata hai — user ko verify karne bolna padega
    return { needsEmailConfirm: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Backend configured nahi hai');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // session onAuthStateChange se aayega → pull-on-login effect chalega
  }, []);

  /**
   * Logout — session khatam + scope guest par wapas (memory reload hota hai).
   *
   * `forgetOnDevice` = true → is user ka local data bhi mita diya jaata hai.
   * ⚠️ Ye OFFLINE data destroy karta hai: is dukaan ka backup sirf usi device
   * par tha to wapas nahi milega (cloud backup hota to dobara aa jayega, par
   * slow network par dukaandar ka kaam ruk jayega). Default false rakhte hain
   * — shared POS device par bhi koi logout karke dusre dukaan ka data dekh
   * nahi sakta, kyunki namespace alag hai.
   */
  const signOut = useCallback(async (options?: { forgetOnDevice?: boolean }) => {
    if (!supabase) return;
    const userId = session?.user?.id;
    await supabase.auth.signOut();
    setSession(null);
    if (options?.forgetOnDevice && userId) {
      clearUser(userId);
    }
  }, [session]);

  const syncNow = useCallback(async () => {
    if (!session) return;
    await doSyncNow(session);
  }, [session, doSyncNow]);

  const user = session?.user ?? null;

  const value: AuthContextType = {
    mode: user ? 'account' : 'guest',
    user,
    cloudReady: isCloudConfigured,
    loading,
    sync,
    signInWithGoogle,
    signUp,
    signIn,
    signOut,
    syncNow,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { pushCloudState };
