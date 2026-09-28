/**
 * namespacedStorage.ts
 * ──────────────────────────────────────────────────────────────────
 * 🔐 NAMESPACE PATTERN — localStorage ki har key ek user se baandhi hai.
 *
 * Problem (cross-account data leak): ek global key (`dukaan_pos_data`) thi.
 * User A logout → User B login → localStorage me A ka data abhi bhi pada tha
 * → debounced push usi ko B ki cloud row me likh deta tha. Do dukaan ek jaisi.
 *
 * Is wrapper ke saath key ban jaati hai: `dukaan_pos_data_<userId>`.
 * Ab A logout kare to bhi uska data uski hi key me salamat rehta hai
 * (offline-first nahi toot-ta), aur B ko usse padhne ka koi raasta hi nahi —
 * kyunki B ki keys alag hain.
 *
 * SAFETY RULE: account mode me user id ke bina read/write BAND hai. Bina
 * namespace ke account data padhna hi wo bug hai jo hum theek kar rahe hain.
 *
 * Guest mode alag namespace (`_guest`) me rehta hai — Dukaan POS jaan-boojh
 * kar guest mode support karta hai, isliye use block nahi karte.
 */

// ── Scope (active user ka hisaab) ──
export type StorageScope =
  | { mode: 'account'; userId: string }
  | { mode: 'guest' };

const GUEST_SUFFIX = 'guest';

/**
 * Guest mode default hai taaki app kahin bhi crash na ho. AuthContext
 * sign-in par `setActiveScope({mode:'account', userId})` karta hai aur logout
 * par guest par wapas.
 */
let activeScope: StorageScope = { mode: 'guest' };

export function setActiveScope(scope: StorageScope): void {
  activeScope = scope.mode === 'account' && scope.userId
    ? { mode: 'account', userId: scope.userId }
    : { mode: 'guest' };
}

export function getActiveScope(): StorageScope {
  return activeScope;
}

export function getActiveUserId(): string | null {
  return activeScope.mode === 'account' ? activeScope.userId : null;
}

/** Is device par is user ka data hai? (device storage reclaim karne ke liye) */
export function namespaceExists(userId: string): boolean {
  return Object.keys(localStorage).some((k) => k.endsWith(`_${userId}`));
}

export function allNamespaces(): string[] {
  const ids = new Set<string>();
  for (const k of Object.keys(localStorage)) {
    const i = k.lastIndexOf('_');
    if (i > 0) ids.add(k.slice(i + 1));
  }
  return [...ids];
}

// ── Core ──

/**
 * `data` → `data_<userId>` (account) ya `data_guest` (guest)
 * @returns null agar account mode me user id nahi — caller ko guard karna chahiye
 */
export function resolveKey(base: string): string | null {
  if (activeScope.mode === 'account') {
    return activeScope.userId ? `${base}_${activeScope.userId}` : null;
  }
  return `${base}_${GUEST_SUFFIX}`;
}

function warn(base: string, op: 'read' | 'write'): void {
  console.error(
    `⛔ [storage] ${op} BLOCKED — account mode me user id nahi hai (key: ${base}). ` +
      `Ye cross-account data leak hoga, isliye rok diya gaya.`,
  );
}

export const NamespacedStorage = {
  keyFor(base: string): string | null {
    return resolveKey(base);
  },

  get<T>(base: string, fallback: T): T {
    const key = resolveKey(base);
    if (!key) { warn(base, 'read'); return fallback; }
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch (error) {
      console.error(`[storage] ${base} read fail:`, error);
      return fallback;
    }
  },

  set(base: string, value: unknown): boolean {
    const key = resolveKey(base);
    if (!key) { warn(base, 'write'); return false; }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[storage] ${base} write fail:`, error);
      return false;
    }
  },

  remove(base: string): void {
    const key = resolveKey(base);
    if (!key) { warn(base, 'write'); return; }
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[storage] ${base} remove fail:`, error);
    }
  },

  has(base: string): boolean {
    const key = resolveKey(base);
    if (!key) return false;
    return localStorage.getItem(key) !== null;
  },

  /**
   * Sirf is scope ka data mitao (logout / "is device se data hatao").
   * Doosre users ka data kabhi nahi chhua jaata.
   */
  clearCurrent(): void {
    if (activeScope.mode === 'account' && activeScope.userId) {
      clearUser(activeScope.userId);
    } else {
      clearGuest();
    }
  },
};

// ── Explicit helpers ──

/** Is user ka saara local data hata do (logout pe "forget this device" mode) */
export function clearUser(userId: string): void {
  const suffix = `_${userId}`;
  for (const k of Object.keys(localStorage)) {
    if (k.endsWith(suffix)) localStorage.removeItem(k);
  }
}

export function clearGuest(): void {
  const suffix = `_${GUEST_SUFFIX}`;
  for (const k of Object.keys(localStorage)) {
    if (k.endsWith(suffix)) localStorage.removeItem(k);
  }
}

/** Sirf ek specific key ka data (e.g. state) — test/debug ke liye */
export function clearUserKey(userId: string, base: string): void {
  localStorage.removeItem(`${base}_${userId}`);
}

// ── Legacy migration ──

/** Purani (global, un-namespaced) keys jo pehle se hoti hain */
const LEGACY_OWNER_KEY = 'dukaan_state_owner';

export interface MigrationResult {
  migrated: string[];
  /** Owner mismatch — data kisi AUR user ka tha, isliye jaan-boojh kar nahi uthaya */
  discarded: string[];
}

/**
 * Purani global key → namespaced key. Sirf ek hi baar hota hai.
 *
 * 🔐 Ownership guard: pehle wala fix ek `dukaan_state_owner` key rakhta tha
 * jo batata tha local data kis user ka hai. Agar owner alag hai to legacy data
 * migrate NAHI hota — warna ye migration khud wahi leak phir se khol deti.
 * Owner key hi nahi hai = pehli baar ka guest data → migrate hota hai (feature).
 */
export function migrateLegacyKeys(bases: string[]): MigrationResult {
  const result: MigrationResult = { migrated: [], discarded: [] };
  const owner = (() => {
    try { return localStorage.getItem(LEGACY_OWNER_KEY); } catch { return null; }
  })();
  const activeUserId = getActiveUserId();

  for (const base of bases) {
    let raw: string | null = null;
    try { raw = localStorage.getItem(base); } catch { /* ignore */ }
    if (!raw) continue;

    // Target namespaced key pehle se hai? Legacy duplicate ko chhod do.
    const target = resolveKey(base);
    if (!target) continue;
    if (localStorage.getItem(target) === null) {
      if (owner && activeUserId && owner !== activeUserId) {
        // Pichle user ka data — migrate karna hi leak hai
        result.discarded.push(base);
      } else {
        try {
          localStorage.setItem(target, raw);
          result.migrated.push(base);
        } catch { /* ignore */ }
      }
    }
    try { localStorage.removeItem(base); } catch { /* ignore */ }
  }
  return result;
}
