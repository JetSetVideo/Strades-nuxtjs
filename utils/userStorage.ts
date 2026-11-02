/**
 * Per-user browser storage (board-security S13).
 *
 * Eleven stores kept their data in localStorage under fixed keys, so two accounts on one browser
 * shared (and overwrote) each other's paper ledger, predictions, notes, avatar…, and sign-out
 * left all of it behind. Now:
 *
 *  - The signed-in user's id is remembered in `strades_storage_uid` (not a secret: an id only).
 *  - `userGet/userSet(base)` read and write `<base>::u:<id>` while someone is signed in, and the
 *    plain `<base>` key while nobody is (sample-data browsing keeps working exactly as before).
 *  - `setStorageUser(id)` (sign-in, profile load) moves the old unscoped data of every key in
 *    USER_SCOPED_KEYS into that user's namespace ONCE, unless the namespace already has data.
 *  - `clearUserStorage()` (sign-out, account switch) forgets the current user id and removes the
 *    unscoped copies. With `{ forgetDevice: true }` it also removes every user's namespaced data.
 *
 * Everything takes an optional Storage so it is testable in node (tests/userStorage.test.ts).
 */

/** The unscoped keys of the eleven per-user stores (board-security S13). Appearance is NOT here. */
export const USER_SCOPED_KEYS = [
  'strades_paper_ledger_v1',      // stores/paper.ts
  'strades:predictions',          // stores/predictions.ts
  'strades_activity_log_v1',      // stores/activityLog.ts
  'strades_opinion_profiles_v1',  // stores/opinionProfile.ts
  'strades.assetAnnotations.v1',  // stores/assetAnnotations.ts
  'strades_credits_v1',           // stores/credits.ts
  'strades_arena_v1',             // stores/dataBets.ts
  'strades_news_workspace_v2',    // stores/news.ts
  'strades_profile_face_v1',      // stores/profileFace.ts
  'strades_trading_prefs_v1',     // stores/tradingPrefs.ts
  'strades_feed_prefs_v1',        // stores/feedPrefs.ts
] as const

export const STORAGE_UID_KEY = 'strades_storage_uid'
const NS = '::u:'

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function defaultStorage(): KV | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null                                   // private mode / blocked storage
  }
}

/** `<base>::u:<id>` — the key a user's copy lives under. */
export function scopedKey(base: string, uid: string): string {
  return `${base}${NS}${uid}`
}

/** The user whose namespace is active on this device, or null (signed out). */
export function storageUserId(s: KV | null = defaultStorage()): string | null {
  try { return s?.getItem(STORAGE_UID_KEY) || null } catch { return null }
}

/** The key to use for `base` right now. */
export function userKey(base: string, s: KV | null = defaultStorage()): string {
  const uid = storageUserId(s)
  return uid ? scopedKey(base, uid) : base
}

/** Read `base` for the current user (lazily adopting an unscoped copy left from before S13). */
export function userGet(base: string, s: KV | null = defaultStorage()): string | null {
  if (!s) return null
  try {
    const uid = storageUserId(s)
    if (!uid) return s.getItem(base)
    const own = s.getItem(scopedKey(base, uid))
    if (own !== null) return own
    const legacy = s.getItem(base)
    if (legacy !== null) {
      s.setItem(scopedKey(base, uid), legacy)
      s.removeItem(base)
    }
    return legacy
  } catch {
    return null
  }
}

/** Write `base` for the current user. Throws like localStorage.setItem (quota) so callers keep their fallbacks. */
export function userSet(base: string, value: string, s: KV | null = defaultStorage()): void {
  if (!s) return
  s.setItem(userKey(base, s), value)
}

export function userRemove(base: string, s: KV | null = defaultStorage()): void {
  try { s?.removeItem(userKey(base, s)) } catch { /* ignore */ }
}

/** Move every unscoped per-user key into `uid`'s namespace (once; never overwrites). Returns keys moved. */
export function migrateLegacyKeys(uid: string, s: KV | null = defaultStorage()): number {
  if (!s || !uid) return 0
  let moved = 0
  for (const base of USER_SCOPED_KEYS) {
    try {
      const legacy = s.getItem(base)
      if (legacy === null) continue
      if (s.getItem(scopedKey(base, uid)) === null) {
        s.setItem(scopedKey(base, uid), legacy)
        moved++
      }
      s.removeItem(base)
    } catch { /* quota: leave the unscoped copy, userGet adopts it later */ }
  }
  return moved
}

/**
 * Remove local per-user data.
 *  - default: forget which user is active and drop the unscoped copies (sign-out, account switch);
 *    each user's namespaced data stays, readable only once that user signs in again.
 *  - forgetDevice: also every user's namespaced data ("Forget this device").
 * Never touches appearance, the demo id or anything outside USER_SCOPED_KEYS.
 */
export function clearUserStorage(opts: { forgetDevice?: boolean } = {}, s: KV | null = defaultStorage()): number {
  if (!s) return 0
  const drop = new Set<string>([STORAGE_UID_KEY, ...USER_SCOPED_KEYS])
  if (opts.forgetDevice) {
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)
        if (k && USER_SCOPED_KEYS.some(base => k.startsWith(base + NS))) drop.add(k)
      }
    } catch { /* ignore */ }
  }
  let removed = 0
  for (const k of drop) {
    try {
      if (s.getItem(k) !== null) { s.removeItem(k); removed++ }
    } catch { /* ignore */ }
  }
  return removed
}

/**
 * Make `uid` the active namespace. On an account switch (another user was active) the previous
 * session's unscoped leftovers are cleared first, so nothing written while signed out under the
 * old user is adopted by the new one. Returns whether the active user changed from another user.
 */
export function setStorageUser(uid: string | number | null | undefined, s: KV | null = defaultStorage()): boolean {
  if (!s || uid === null || uid === undefined || uid === '') return false
  const id = String(uid)
  const previous = storageUserId(s)
  const switched = !!previous && previous !== id
  if (switched) clearUserStorage({}, s)
  try { s.setItem(STORAGE_UID_KEY, id) } catch { return switched }
  migrateLegacyKeys(id, s)
  return switched
}
