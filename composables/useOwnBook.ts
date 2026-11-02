/**
 * C8 · The signed-in account's OWN paper book, shared app-wide (swarm 2026-11-02, Wave 2, lane `review`).
 *
 * Exactly what /wallet's KPI "Your paper" shows (= the "Your paper" value tree = /risk Portfolio Value):
 * `loadOwnBook` (utils/ownBook.ts) over the trading API, with the raw rows kept for the value trees
 * (`recordingBookApi`, utils/walletTree.ts). Extracted from pages/wallet.vue `loadOwn` so the dock,
 * /wallet, /risk and the hand-trade form read ONE fetch (PERF-6: /wallet used to read
 * /api/portfolio/ twice per visit).
 *
 *   const { total, cash, loading, error, refresh } = useOwnBook()
 *
 * - `total` / `cash`: USD, or `null` while loading, when signed out or on error (never a fake 0).
 * - Shared state via `useState`; fetched on the client only; concurrent calls share one request.
 * - The first `useOwnBook()` on the client starts a read when nothing was read yet; pages that
 *   want fresh numbers on each visit call `refresh()` on mount (it joins a read already in flight).
 * - After a write (hand trade, new wallet) call `refresh()`.
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import { bookLoadState, loadOwnBook, type OwnBook } from '~/utils/ownBook'
import { recordingBookApi, type OwnBookLoadState, type OwnBookRaw } from '~/utils/walletTree'

export type OwnBookState = 'idle' | OwnBookLoadState

/** Pure: the headline figures the KPI prints. `null` unless the book was read. */
export function ownBookFigures(state: OwnBookState, book: OwnBook | null): { total: number | null; cash: number | null } {
  if (state !== 'ready' || !book) return { total: null, cash: null }
  const total = Number.isFinite(book.total) ? book.total : null
  const cash = Number.isFinite(book.cash) ? book.cash : null
  return { total, cash }
}

/** Pure: the one-line error the UI may show; `null` when loaded, loading or simply signed out. */
export function ownBookErrorText(state: OwnBookState): string | null {
  return state === 'error' ? 'Your paper wallets could not be read right now.' : null
}

export interface UseOwnBook {
  total: ComputedRef<number | null>
  cash: ComputedRef<number | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
  /** Extras for the pages that show the parts (value trees, risk weights, hand-trade holdings). */
  state: Ref<OwnBookState>
  book: Ref<OwnBook | null>
  raw: Ref<OwnBookRaw | null>
}

// One read in flight per client (module scope is per browser tab; never used on the server).
let inflight: Promise<void> | null = null

export function useOwnBook(): UseOwnBook {
  const state = useState<OwnBookState>('ownBook:state', () => 'idle')
  const book = useState<OwnBook | null>('ownBook:book', () => null)
  const raw = useState<OwnBookRaw | null>('ownBook:raw', () => null)
  const loading = useState<boolean>('ownBook:loading', () => false)
  const error = useState<string | null>('ownBook:error', () => null)
  // Capture the Nuxt context before any await.
  const api = useTradingApi()

  async function run() {
    loading.value = true
    if (state.value === 'idle') state.value = 'loading'
    try {
      const rec = recordingBookApi(api)
      const next = await loadOwnBook(rec.api)
      book.value = next
      raw.value = rec.raw
      state.value = 'ready'
      error.value = null
    } catch (e) {
      const s = bookLoadState(e)
      state.value = s
      book.value = null
      raw.value = null
      error.value = ownBookErrorText(s)
    } finally {
      loading.value = false
    }
  }

  function refresh(): Promise<void> {
    if (import.meta.server) return Promise.resolve()
    if (!inflight) inflight = run().finally(() => { inflight = null })
    return inflight
  }

  if (import.meta.client && state.value === 'idle' && !inflight) void refresh()

  const figures = computed(() => ownBookFigures(state.value, book.value))
  return {
    total: computed(() => figures.value.total),
    cash: computed(() => figures.value.cash),
    loading,
    error,
    refresh,
    state,
    book,
    raw,
  }
}
