// Supabase Client — OPTIONAL init
// Jab tak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set nahi hain,
// app pure guest mode (localStorage) mein chalega — koi error nahi.
// Env vars set hote hi account features (Google login, cloud sync) auto-enable ho jayenge.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True jab backend (Supabase) configure ho chuka hai */
export const isCloudConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,      // session localStorage mein — refresh pe login rahe
        autoRefreshToken: true,
        detectSessionInUrl: true,  // Google OAuth redirect handle
      },
    })
  : null;
