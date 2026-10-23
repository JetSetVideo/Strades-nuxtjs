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
 *   Wallet  wallet.wallets             → total (= switcher TOTAL BALANCE),
 *                                         wallet shares + asset-type shares
 *   Lab     agents.byId                → one 3-D dot per agent, run/wait
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
import { useChatStore } from '~/stores/chat'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { assetClassTheme, resolveAssetClass } from '~/utils/assetClass'
import {
  agentSphere, blendHistory, compactUsd, intradayCurve, signedPct, subsolarLongitude, unreadFor, walletRings,
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

export function useNavPanels() {
  const assets = useAssetsStore()
  const news = useNewsStore()
  const wallet = useWalletStore()
  const agents = useAgentsStore()
  const chat = useChatStore()
  const { getUserId } = useCurrentUser()

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
    if (!wallet.hydrated && !wallet.loading) wallet.fetchWallets().catch(() => {})
    if (!agents.hydrated && !agents.loading) agents.fetchAgents().catch(() => {})
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

  // ── Wallet: total + the two rings ─────────────────────────────────────
  const walletPanel = computed(() => {
    const classOf = (a: { asset_id?: string; symbol: string }) =>
      resolveAssetClass((a.asset_id && assets.getAssetById(a.asset_id)) || { symbol: a.symbol })
    const label = (k: string) => (k === 'cash' ? 'Cash' : assetClassTheme(k).label)
    const rings = walletRings(wallet.wallets ?? [], classOf, label)
    const walletsColored: ColoredShare[] = rings.wallets.map((s, i) => ({ ...s, color: walletTone(i, rings.wallets.length) }))
    const classesColored: ColoredShare[] = rings.classes.map(s => ({ ...s, color: s.key === 'cash' ? CASH_COLOR : assetClassTheme(s.key).color }))
    const mix = classesColored.slice(0, 3).map(c => `${c.label} ${Math.round(c.share * 100)}%`).join(', ')
    return {
      wallets: walletsColored,
      classes: classesColored,
      value: [{ text: rings.total > 0 ? compactUsd(rings.total) : '—', tone: (rings.total > 0 ? 'accent' : 'muted') as Tone }],
      summary: rings.total > 0
        ? `Wallet — ${compactUsd(rings.total)} across ${rings.wallets.length} wallets; ${mix}`
        : 'Wallet — no wallet loaded yet',
    }
  })

  // ── Lab: every agent on the globe ─────────────────────────────────────
  const lab = computed(() => {
    const list = agents.ids.map(id => agents.byId[id]).filter(Boolean)
    const points: SpherePoint[] = agentSphere(list.map(a => ({
      id: a!.id,
      name: a!.name,
      status: a!.training_state?.status,
      risk: a!.personality_matrix?.risk,
      patience: a!.personality_matrix?.patience,
      contrarian: a!.personality_matrix?.contrarian,
      trades: a!.performance?.trades_total,
    })))
    const running = points.filter(p => p.state === 'running').length
    const waiting = points.filter(p => p.state === 'waiting').length
    const errors = points.length - running - waiting
    // One word fits a 75 px tab; with several states show coloured counts (the link's label spells them out).
    const states: ValuePart[] = [
      { text: `${running}`, tone: 'up', long: `${running} run` },
      ...(waiting ? [{ text: `${waiting}`, tone: 'wait' as Tone, long: `${waiting} wait` }] : []),
      ...(errors ? [{ text: `${errors}`, tone: 'down' as Tone, long: `${errors} error` }] : []),
    ]
    const value: ValuePart[] = !points.length
      ? [{ text: '—', tone: 'muted' }]
      : states.length === 1
        ? [{ text: `${running} run`, tone: running ? 'up' : 'muted' }]
        : states.map(s => ({ ...s, text: `●${s.text}` }))
    return {
      points,
      running,
      waiting,
      value,
      summary: points.length
        ? `Lab — ${points.length} agents: ${running} running, ${waiting} waiting${errors ? `, ${errors} in error` : ''}`
        : 'Lab — no agents loaded yet',
    }
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

  const panels = computed<NavPanel[]>(() => [
    { id: 'prices', to: '/prices', label: 'Prices', accent: '0,180,255', match: ['/prices', '/assets', '/predict', '/deals'],
      summary: prices.value.summary, value: prices.value.value, icon: { curve: prices.value.curve, tone: prices.value.tone } },
    { id: 'news', to: '/news', label: 'News', accent: '0,170,255', match: ['/news', '/articles', '/summarizer'],
      summary: newsPanel.value.summary, value: newsPanel.value.value, icon: { now: now.value, unread: newsPanel.value.unread } },
    { id: 'wallet', to: '/wallet', label: 'Wallet', accent: '245,166,35', match: ['/wallet', '/trade', '/risk'],
      summary: walletPanel.value.summary, value: walletPanel.value.value, icon: { wallets: walletPanel.value.wallets, classes: walletPanel.value.classes } },
    { id: 'lab', to: '/strategies', label: 'Lab', accent: '0,255,136', match: ['/strategies', '/strategy', '/agents', '/bots', '/creator', '/monitor', '/arena'],
      summary: lab.value.summary, value: lab.value.value, icon: { points: lab.value.points, running: lab.value.running, waiting: lab.value.waiting } },
    { id: 'chat', to: '/chat', label: 'Chat', accent: '120,220,180', match: ['/chat', '/conversations'],
      summary: chatPanel.value.summary, value: chatPanel.value.value, icon: { unread: chatPanel.value.unread, urgent: chatPanel.value.urgent } },
  ])

  return { panels }
}
