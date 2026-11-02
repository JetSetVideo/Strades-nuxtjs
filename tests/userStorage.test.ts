import { describe, it, expect, beforeEach } from 'vitest'
import {
  USER_SCOPED_KEYS, STORAGE_UID_KEY, scopedKey, storageUserId, userKey, userGet, userSet, userRemove,
  migrateLegacyKeys, clearUserStorage, setStorageUser,
} from '../utils/userStorage'

/** Minimal in-memory Storage (vitest runs in node: no localStorage). */
class MemStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  keys() { return [...this.m.keys()].sort() }
}

const PAPER = 'strades_paper_ledger_v1'
const PREFS = 'strades_trading_prefs_v1'
let s: MemStorage

beforeEach(() => { s = new MemStorage() })

describe('userStorage — keys', () => {
  it('lists the eleven per-user stores of board-security S13, not appearance', () => {
    expect(USER_SCOPED_KEYS).toHaveLength(11)
    expect(new Set(USER_SCOPED_KEYS).size).toBe(11)
    expect(USER_SCOPED_KEYS.some(k => /appearance/i.test(k))).toBe(false)
  })

  it('uses the plain key while signed out and a per-user key while signed in', () => {
    expect(storageUserId(s)).toBeNull()
    expect(userKey(PAPER, s)).toBe(PAPER)
    s.setItem(STORAGE_UID_KEY, '42')
    expect(userKey(PAPER, s)).toBe(scopedKey(PAPER, '42'))
    expect(scopedKey(PAPER, '42')).toBe('strades_paper_ledger_v1::u:42')
  })

  it('works (no throw, null) without any storage', () => {
    expect(userGet(PAPER, null)).toBeNull()
    expect(() => userSet(PAPER, 'x', null)).not.toThrow()
    expect(clearUserStorage({}, null)).toBe(0)
    expect(setStorageUser('1', null)).toBe(false)
  })
})

describe('userStorage — two accounts on one browser', () => {
  it('keeps each user’s data apart', () => {
    setStorageUser('alice', s)
    userSet(PAPER, '{"trades":["a"]}', s)
    clearUserStorage({}, s)                 // alice signs out
    setStorageUser('bob', s)
    expect(userGet(PAPER, s)).toBeNull()    // bob does not see alice's ledger
    userSet(PAPER, '{"trades":["b"]}', s)
    clearUserStorage({}, s)
    setStorageUser('alice', s)
    expect(userGet(PAPER, s)).toBe('{"trades":["a"]}')
  })

  it('migrates the old unscoped data once into the first user who signs in, never overwriting', () => {
    s.setItem(PAPER, 'legacy-ledger')
    s.setItem(PREFS, 'legacy-prefs')
    s.setItem(scopedKey(PREFS, 'alice'), 'alice-prefs')
    expect(setStorageUser('alice', s)).toBe(false)
    expect(s.getItem(scopedKey(PAPER, 'alice'))).toBe('legacy-ledger')
    expect(s.getItem(scopedKey(PREFS, 'alice'))).toBe('alice-prefs')        // own data wins
    expect(s.getItem(PAPER)).toBeNull()
    expect(s.getItem(PREFS)).toBeNull()
    expect(migrateLegacyKeys('alice', s)).toBe(0)                           // once
  })

  it('adopts an unscoped copy lazily on read (store hydrating before the sign-in migration)', () => {
    s.setItem(STORAGE_UID_KEY, 'carol')
    s.setItem(PAPER, 'old')
    expect(userGet(PAPER, s)).toBe('old')
    expect(s.getItem(scopedKey(PAPER, 'carol'))).toBe('old')
    expect(s.getItem(PAPER)).toBeNull()
  })

  it('reports an account switch and drops what was written while signed out', () => {
    setStorageUser('alice', s)
    s.setItem(PAPER, 'anon-leftover')
    expect(setStorageUser('alice', s)).toBe(false)     // same user again: not a switch
    s.setItem(PAPER, 'anon-leftover')
    expect(setStorageUser('bob', s)).toBe(true)
    expect(storageUserId(s)).toBe('bob')
    expect(s.getItem(scopedKey(PAPER, 'bob'))).toBeNull()   // not adopted by bob
    expect(s.getItem(PAPER)).toBeNull()
  })

  it('ignores empty ids', () => {
    expect(setStorageUser('', s)).toBe(false)
    expect(setStorageUser(undefined, s)).toBe(false)
    expect(storageUserId(s)).toBeNull()
  })

  it('removes the current user’s copy with userRemove', () => {
    setStorageUser(7, s)
    userSet(PREFS, 'x', s)
    userRemove(PREFS, s)
    expect(s.getItem(scopedKey(PREFS, '7'))).toBeNull()
  })
})

describe('userStorage — sign-out', () => {
  beforeEach(() => {
    s.setItem('strades_appearance_v1', 'dark')
    s.setItem('strades_demo_code', 'STRD-AAAA')
    s.setItem('strades:notifications:v2:alice', '{}')
    setStorageUser('alice', s)
    userSet(PAPER, 'alice-ledger', s)
    s.setItem(scopedKey(PREFS, 'bob'), 'bob-prefs')
  })

  it('default: forgets the active user, keeps namespaced data, never touches other keys', () => {
    s.setItem(PREFS, 'anon')
    clearUserStorage({}, s)
    expect(storageUserId(s)).toBeNull()
    expect(s.getItem(PREFS)).toBeNull()
    expect(s.getItem(scopedKey(PAPER, 'alice'))).toBe('alice-ledger')
    expect(userGet(PAPER, s)).toBeNull()                 // signed out: nothing visible
    expect(s.getItem('strades_appearance_v1')).toBe('dark')
    expect(s.getItem('strades_demo_code')).toBe('STRD-AAAA')
    expect(s.getItem('strades:notifications:v2:alice')).toBe('{}')
  })

  it('forgetDevice: removes every account’s per-user data, still not appearance or the demo id', () => {
    const removed = clearUserStorage({ forgetDevice: true }, s)
    expect(removed).toBe(3)                               // uid pointer + alice ledger + bob prefs
    expect(s.keys()).toEqual(['strades:notifications:v2:alice', 'strades_appearance_v1', 'strades_demo_code'])
  })
})
