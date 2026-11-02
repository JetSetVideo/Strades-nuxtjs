/**
 * Bottom navigation — one view model per main panel.
 *
 * Navigation/Bar.vue renders what this returns; the icons under
 * Navigation/Icons/ are presentational and get their data from here. Each
 * panel reads the SAME store field its page shows at the top, so the nav
 * never disagrees with the page it opens:
 *
 *   Prices  assets.liveMarket.history  → today's curve (00:00 GMT → now)
 *   News    news.items[].readByUser    → unread count; clock → noon meridian
 *   Wallet  useOwnBook() (C8)          → the user's OWN paper total (= /wallet KPI "Your paper"),
 *                                         rings = paper wallets vs portfolio + asset-type shares.
 *                                         The sample wallets in stores/wallet never reach the dock.
 *   Lab     strategies.ownStrategies   → one 3-D dot per own strategy (active / paused / stopped);
 *                                         none yet = "—" ("no strategy yet"), never the sample agents
 *   Chat    chat.conversations         → unread in the user's conversations
 *
 * One 30-s clock drives the time-based drawings (globe rotation, end of the
 * prices curve). Live quotes are re-pulled every 5 min while the tab is
 * visible so "today" keeps moving without a reload.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAssetsStore } from '~/stores/assets'
import { useNewsStore } from '~/stores/news'
import { useWalletStore } from '~/stores/wallet'
import { useAgentsStore } from '~/stores/agents'
import { useStrategiesStore } from '~/stores/strategies'
import { useChatStore } from '~/stores/chat'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { useOwnBook, type OwnBookState } from '~/composables/useOwnBook'
import type { OwnBook } from '~/utils/ownBook'
import { assetClassTheme } from '~/utils/assetClass'
import { dockLabel, dockMatch } from '~/utils/routes'
import {
  blendHistory, compactUsd, intradayCurve, signedPct, strategySphere, subsolarLongitude, unreadFor,
  type IntradayCurve, type PanelId, type Share, type SpherePoint,
} from '~/utils/navIcons'

export type { PanelId }

export type Tone = 'up' | 'down' | 'wait' | 'accent' | 'muted'
export interface ValuePart {
  text: string
  tone: Tone
  /** Wider wording shown from 768 px, where a tab has room (e.g. "8 run" instead of "●8"). */
  long?: string
}
export interface ColoredShare extends Share { color: string }

export interface NavPanel {
  id: PanelId
  to: string
  label: string
  /** "r,g,b" — the panel's own accent, used for the active state. */
  accent: string
  /** Route prefixes that belong to this panel (detail pages keep their tab selected). */
  match: readonly string[]
  /** Full sentence for screen readers and the tooltip. */
  summary: string
  value: ValuePart[]
  /** Props for the panel's icon (besides size / active / ready). */
  icon: Record<string, unknown>
}

const CLOCK_MS = 30_000
const QUOTES_MS = 5 * 60_000
const CASH_COLOR = '#8a94a6'
/** Outer wallet ring: the Wallet accent family, alternating strong / pale so neighbours separate. */
const WALLET_TONES = ['#f5a623', '#ff6b9d', '#2dd4bf', '#facc15', '#a3e635']
/** Ring colour for wallet i of n: never the same as its neighbour across the 12 o'clock seam. */
const walletTone = (i: number, n: number) =>
  WALLET_TONES[(i === n - 1 && n > 1 && i % WALLET_TONES.length === 0) ? 2 : i % WALLET_TONES.length]!

/**
 * Wallet dock from the user's OWN paper book (C8 `useOwnBook`): the same total as /wallet's
 * "Your paper" KPI. Pure (tests/nav-dock.test.ts). Anything but a read book shows "—" + why.
 */
export function ownWalletDock(
  state: OwnBookState,
  book: Pick<OwnBook, 'total' | 'byClass' | 'parts' | 'empty'> | null,
  classLabel: (key: string) => string = k => k,
  classColor: (key: string) => string = () => CASH_COLOR,
): { value: ValuePart[], summary: string, wallets: ColoredShare[], classes: ColoredShare[] } {
  const none = (summary: string) => ({ value: [{ text: '—', tone: 'muted' as Tone }], summary, wallets: [], classes: [] })
  if (state === 'signed-out') return none('Wallet — sign in to see your paper wallets')
  if (state === 'error') return none('Wallet — your paper wallets could not be read right now')
  if (state !== 'ready' || !book) return none('Wallet — reading your paper wallets')
  // Read and empty: the page's KPI prints $0.00, so the dock says $0 too (same number), muted.
  if (book.empty || !(book.total > 0)) {
    return { ...none('Wallet — your paper $0: no paper wallet yet, open Wallet to start one'), value: [{ text: compactUsd(0), tone: 'muted' as Tone }] }
  }
  const share = (entries: Array<[string, string, number]>) => {
    const pos = entries.filter(([, , v]) => Number.isFinite(v) && v > 0)
    const sum = pos.reduce((t, [, , v]) => t + v, 0)
    return sum > 0 ? pos.map(([key, label, value]) => ({ key, label, value, share: value / sum })) : []
  }
  const wallets = share([
    ['custody', 'Paper wallets', book.parts.custody],
    ['portfolio', 'Portfolio', book.parts.portfolio],
  ]).map((s, i, all) => ({ ...s, color: walletTone(i, all.length) }))
  const classes = share((Object.keys(book.byClass) as Array<keyof OwnBook['byClass']>).map(k => {
    const key = k === 'fiat' ? 'cash' : k
    return [key, key === 'cash' ? 'Cash' : classLabel(key), book.byClass[k]] as [string, string, number]
  }))
    .sort((a, b) => b.value - a.value)
    .map(s => ({ ...s, color: s.key === 'cash' ? CASH_COLOR : classColor(s.key) }))
  const mix = classes.slice(0, 3).map(c => `${c.label} ${Math.round(c.share * 100)}%`).join(', ')
  return {
    value: [{ text: compactUsd(book.total), tone: 'accent' }],
    summary: `Wallet — your paper ${compactUsd(book.total)}${mix ? `; ${mix}` : ''}`,
    wallets,
    classes,
  }
}

/** Lab dock when the user owns no strategy: no number (the sample agents are not theirs). */
export const LAB_DOCK_EMPTY = {
  points: [] as SpherePoint[],
  running: 0,
  waiting: 0,
  stopped: 0,
  value: [{ text: '—', tone: 'muted' as Tone, long: 'no strategy yet' }] as ValuePart[],
  summary: 'Lab — no strategy of yours yet: open Lab to create one or browse the samples',
}

export function useNavPanels() {
  const assets = useAssetsStore()
  const news = useNewsStore()
  const wallet = useWalletStore()
  const agents = useAgentsStore()
  const strategies = useStrategiesStore()
  const chat = useChatStore()
  const { getUserId } = useCurrentUser()
  const ownBook = useOwnBook()

  // ── Shared clock (client only; SSR renders the icons' static placeholders) ──
  const now = ref(0)
  let clock: ReturnType<typeof setInterval> | undefined
  let quotes: ReturnType<typeof setInterval> | undefined
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
  const tick = () => { now.value = Date.now() }
  const onVisible = () => { if (visible()) tick() }

  onMounted(() => {
    tick()
    clock = setInterval(() => { if (visible()) tick() }, CLOCK_MS)
    // Re-pull live quotes only when nobody else did recently (/prices already pulls every 30 s).
    quotes = setInterval(() => {
      if (visible() && assets.assets.length && Date.now() - quoteAt() > QUOTES_MS - 30_000) assets.mergeLiveQuotes()
    }, QUOTES_MS)
    document.addEventListener('visibilitychange', onVisible)
    // The bar is on every page: never assume the target page has hydrated its store.
    if (!assets.assets.length && !assets.isRefreshing) assets.initializeStore()
    // wallet + agents: no longer drawn by the dock (own book / own strategies), still prefetched
    // because other screens (wallet switcher, search "Agents") read these stores without fetching.
    if (!wallet.hydrated && !wallet.loading) wallet.fetchWallets().catch(() => {})
    if (!agents.hydrated && !agents.loading) agents.fetchAgents().catch(() => {})
    if (!strategies.strategies.length && !strategies.loading) strategies.fetchStrategies().catch(() => {})
    if (!chat.hydrated) chat.initializeStore().catch(() => {})
  })
  onUnmounted(() => {
    clearInterval(clock)
    clearInterval(quotes)
    document.removeEventListener('visibilitychange', onVisible)
  })

  /** When the live quotes were fetched (ms); 0 if never. Their history's last hour is the hour of this time. */
  const quoteAt = () => {
    let t = 0
    for (const a of assets.assets) {
      const at = a.live?.at ? Date.parse(a.live.at) : 0
      if (at > t) t = at
    }
    return t
  }

  // ── Prices: today's cap-weighted live market ──────────────────────────
  const prices = computed(() => {
    const live = assets.liveMarket
    // The tree aggregates history only when every live leaf has one; otherwise blend the ones that do.
    const blended = live?.history ? null : blendHistory(assets.assets.filter(a => a.live).map(a => ({ history: a.return_history, cap: a.market_cap })))
    const history = live?.history ?? blended?.history
    // Align the hours on the quote time, not the clock: the last return is the candle open when quotes were fetched.
    const at = quoteAt()
    const curve: IntradayCurve | null = now.value ? intradayCurve(history, new Date(at || now.value)) : null
    const today = curve ? curve.v[curve.v.length - 1]! : null
    const move = today ?? (live ? live.ret * 100 : null)
    const tone: Tone = move == null ? 'muted' : move > 0.01 ? 'up' : move < -0.01 ? 'down' : 'muted'
    const liveCount = assets.liveCount ?? 0
    return {
      curve,
      tone,
      value: [{ text: move == null ? '—' : signedPct(move), tone }],
      summary: move == null
        ? 'Prices — waiting for live quotes'
        : today != null
          ? `Prices — markets ${signedPct(move)} since ${String(curve!.t[0]).padStart(2, '0')}:00 GMT (${blended ? `${blended.count} of ${liveCount}` : liveCount} live markets with hourly data)`
          : `Prices — live markets ${signedPct(move)} over 24 h, ${liveCount} live quotes`,
    }
  })

  // ── News: unread + the noon meridian ──────────────────────────────────
  const newsPanel = computed(() => {
    const unread = (news.items ?? []).filter(i => !i.readByUser).length
    const lon = now.value ? subsolarLongitude(new Date(now.value)) : 0
    const where = `${Math.abs(Math.round(lon))}°${lon >= 0 ? 'E' : 'W'}`
    return {
      unread,
      value: [{ text: unread ? `${unread} new` : 'all read', tone: (unread ? 'accent' : 'muted') as Tone }],
      summary: `News — ${unread} unread${now.value ? `, noon is now over ${where}` : ''}`,
    }
  })

  // ── Wallet: the user's own paper total (C8) + the two rings ──────────
  const walletPanel = computed(() => ownWalletDock(
    ownBook.state.value,
    ownBook.book.value,
    k => assetClassTheme(k).label,
    k => assetClassTheme(k).color,
  ))

  // ── Lab: the user's own strategies on the globe (samples and catalog agents are not theirs) ──
  const lab = computed(() => {
    const books = strategies.ownStrategies
    if (books.length) {
      const points: SpherePoint[] = strategySphere(books.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        risk_level: s.risk_level,
        returnPct: s.total_return_percentage,
        trades: s.total_trades,
      })))
      const running = books.filter(s => s.status === 'active' || s.status === 'backtesting').length
      const waiting = books.filter(s => s.status === 'paused').length
      const stopped = books.filter(s => s.status !== 'active' && s.status !== 'backtesting' && s.status !== 'paused').length
      const states: ValuePart[] = [
        ...(running ? [{ text: `${running}`, tone: 'up' as Tone, long: `${running} run` }] : []),
        ...(waiting ? [{ text: `${waiting}`, tone: 'wait' as Tone, long: `${waiting} wait` }] : []),
        ...(stopped ? [{ text: `${stopped}`, tone: 'down' as Tone, long: `${stopped} stop` }] : []),
      ]
      const value: ValuePart[] = states.length === 1
        ? [{ text: states[0]!.long || states[0]!.text, tone: states[0]!.tone }]
        : states.map(s => ({ ...s, text: `●${s.text}` }))
      return {
        points,
        running,
        waiting,
        stopped,
        value,
        summary: `Lab — ${running} running, ${waiting} paused, ${stopped} stopped`,
      }
    }
    return LAB_DOCK_EMPTY
  })

  // ── Chat: unread in the user's own conversations ──────────────────────
  const chatPanel = computed(() => {
    const id = getUserId()
    const unread = unreadFor(chat.conversations ?? [], id)
    let urgency = 0
    try { urgency = chat.getEmotionalUrgency(id) ?? 0 } catch { urgency = 0 }
    return {
      unread,
      urgent: unread > 0 && urgency > 0.7,
      // The number lives in the red dot; the line under the label only says what it is.
      value: [{ text: unread ? 'unread' : 'no new', tone: (unread ? 'accent' : 'muted') as Tone }],
      summary: unread ? `Chat — ${unread} unread message${unread > 1 ? 's' : ''}` : 'Chat — no unread messages',
    }
  })

  // Labels and `match` come from utils/routes.ts: the tab name is its area's home
  // page label, and every page of the area keeps the tab lit (no stray /monitor,
  // /summarizer lights Lab, /arena lights Chat — see DESIGN-AUDIT.md §2.2).
  const panels = computed<NavPanel[]>(() => [
    { id: 'prices', to: '/prices', label: dockLabel('prices'), accent: '0,180,255', match: dockMatch('prices'),
      summary: prices.value.summary, value: prices.value.value, icon: { curve: prices.value.curve, tone: prices.value.tone } },
    { id: 'news', to: '/news', label: dockLabel('news'), accent: '0,170,255', match: dockMatch('news'),
      summary: newsPanel.value.summary, value: newsPanel.value.value, icon: { now: now.value, unread: newsPanel.value.unread } },
    { id: 'wallet', to: '/wallet', label: dockLabel('wallet'), accent: '245,166,35', match: dockMatch('wallet'),
      summary: walletPanel.value.summary, value: walletPanel.value.value, icon: { wallets: walletPanel.value.wallets, classes: walletPanel.value.classes } },
    { id: 'lab', to: '/strategies', label: dockLabel('lab'), accent: '0,255,136', match: dockMatch('lab'),
      summary: lab.value.summary, value: lab.value.value, icon: { points: lab.value.points, running: lab.value.running, waiting: lab.value.waiting, stopped: lab.value.stopped } },
    { id: 'chat', to: '/chat', label: dockLabel('chat'), accent: '120,220,180', match: dockMatch('chat'),
      summary: chatPanel.value.summary, value: chatPanel.value.value, icon: { unread: chatPanel.value.unread, urgent: chatPanel.value.urgent } },
  ])

  return { panels }
}
