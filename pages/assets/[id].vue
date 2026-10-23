<script setup lang="ts">
/**
 * Asset detail page — one layout, adapted to the asset type.
 *
 *  header   name · type · friends (top right) / logo + ticker · price · move
 *  chart    the prediction chart (PredictPanel): past + future, tap to call
 *  facts    the key facts for this type (company, crypto, forex, commodity, bet, index)
 *  type     the block only that type has (bet order book, supply, supply chain…)
 *  alerts   price alerts chart · paper trade · related assets
 *  data     everything else the backend / bundled data knows, nothing left out
 *
 * Every chart follows the one Line / Candles switch at the top.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Asset } from '~/types/asset'
import { useAssetsStore } from '~/stores/assets'
import { usePredictionsStore } from '~/stores/predictions'
import { useFriendPredictions, friendProfile, targetTsOf } from '~/composables/useFriendPredictions'
import { useAgentTracker } from '~/composables/useAgentTracker'
import { publicAssetUrl } from '~/composables/useLocalJson'
import PredictPanel from '~/components/Asset/PredictPanel.vue'
import AssetBotChip from '~/components/Asset/BotChip.vue'
import PriceChart from '~/components/Asset/PriceChart.vue'
import ChartStyleToggle from '~/components/Asset/ChartStyleToggle.vue'
import AssetDataTree from '~/components/Asset/DataTree.vue'
import SupplyTree from '~/components/Asset/SupplyTree.vue'
import WorldMap from '~/components/Asset/WorldMap.vue'
import AssetCommodityPipeline from '~/components/Asset/CommodityPipeline.vue'
import AssetQuickPaperBet from '~/components/Asset/QuickPaperBet.vue'
import { isBetAsset, BET_COLOR, betSourceLabel } from '~/utils/betAssets'
import { priceKindOf, fmtPrice, fmtPct, volIndexOf, fmtAxisPrice, TYPE_LABEL, TYPE_COLOR, type MapPoint } from '~/utils/assetChart'

const route = useRoute()
const routeId = computed(() => String(route.params.id ?? ''))

const assetsStore = useAssetsStore()
const predStore = usePredictionsStore()
const loading = ref(true)
/** The asset list lives in the browser (cache + API): render after mount so hydration matches. */
const mounted = ref(false)
const detail = ref<Record<string, any> | null>(null)
const company = ref<Record<string, any> | null>(null)

const asset = computed<Asset | null>(() => {
  const id = routeId.value.toLowerCase()
  return assetsStore.assets.find(a => String(a.id).toLowerCase() === id || String(a.symbol).toLowerCase() === id) ?? null
})

/** Live store values win for prices; the detail endpoint adds the nested data. */
const merged = computed<Record<string, any>>(() => ({ ...(detail.value ?? {}), ...(asset.value ?? {}) }))

const COMPANY_FILES: Record<string, string> = { AAPL: 'apple', AMZN: 'amazon', TSLA: 'tesla' }

async function loadDetail(sym: string) {
  detail.value = null
  company.value = null
  try {
    const { $api } = useNuxtApp()
    detail.value = await ($api as (u: string) => Promise<Record<string, any>>)(`/api/assets/${encodeURIComponent(sym)}/detail/`)
  } catch { /* backend down: the store data still renders */ }
  const file = COMPANY_FILES[sym.toUpperCase()]
  if (file) company.value = await $fetch<Record<string, any>>(publicAssetUrl(`/data/companies/${file}.json`)).catch(() => null)
}

onMounted(async () => {
  predStore.init()
  mounted.value = true
  if (!assetsStore.assets.length) await assetsStore.initializeStore()
  loading.value = false
})
watch(() => asset.value?.symbol, (s) => { if (s && import.meta.client) loadDetail(s) }, { immediate: true })

// ── Identity ────────────────────────────────────────────────────────────────
const type = computed(() => String(asset.value?.type ?? 'other'))
const typeLabel = computed(() => TYPE_LABEL[type.value] ?? type.value.replace(/_/g, ' '))
const typeColor = computed(() => TYPE_COLOR[type.value] ?? '#607d8b')
const isBet = computed(() => isBetAsset(asset.value))
const kind = computed(() => priceKindOf(asset.value))
const currency = computed(() => String(asset.value?.currency || 'USD'))
const iconFailed = ref(false)
const change = computed(() => typeof asset.value?.change_24h_pct === 'number' ? asset.value.change_24h_pct : null)
const descOpen = ref(false)

const friends = useFriendPredictions(asset)

useHead(() => ({ title: asset.value ? `${asset.value.name} (${asset.value.symbol}) · Strades` : 'Asset · Strades' }))

// ── Key facts per type ──────────────────────────────────────────────────────
type Fact = { label: string; value: string; href?: string; tone?: 'up' | 'down' }
const used = new Set<string>()

function num(v: unknown): number | null {
  const n = Number(v)
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n
}
function big(v: unknown, money = true): string | null {
  const n = num(v)
  if (n === null) return null
  const a = Math.abs(n)
  const s = a >= 1e12 ? `${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return money ? `$${s}` : s
}
function pctVal(v: unknown): string | null {
  const n = num(v)
  return n === null ? null : `${n.toFixed(2)}%`
}
function date(v: unknown): string | null {
  const t = Date.parse(String(v ?? ''))
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}
function list(v: unknown): string | null {
  return Array.isArray(v) && v.length ? v.map(String).join(', ') : (typeof v === 'string' && v ? v : null)
}
function link(v: unknown): Fact['href'] {
  return typeof v === 'string' && /^https?:\/\//.test(v) ? v : undefined
}
function short(url: string) { return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') }
function word(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).replace(/[_-]+/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const facts = computed<Fact[]>(() => {
  const a = merged.value
  const out: (Fact | null)[] = []
  const add = (label: string, value: string | null | undefined, extra: Partial<Fact> = {}, keys: string[] = []) => {
    keys.forEach(k => used.add(k))
    out.push(value ? { label, value, ...extra } : null)
  }
  const sd = a.stock_detail ?? {}
  const cd = a.crypto_detail ?? {}
  const fd = a.forex_detail ?? {}
  const md = a.commodity_detail ?? {}
  const bd = a.bet_detail ?? {}
  const co = company.value?.company_details ?? {}
  const pp = a.psychology_profile ?? {}

  switch (type.value) {
    case 'stock':
    case 'company':
      add('Market cap', big(a.market_cap), {}, ['market_cap'])
      add('Exchange', sd.exchange); add('Sector', word(sd.sector || a.category), {}, ['category'])
      add('Industry', a.industry, {}, ['industry'])
      add('CEO', sd.ceo || a.ceo || co.ceo, {}, ['ceo'])
      add('Founders', list(sd.founders?.length ? sd.founders : a.founders ?? co.founders), {}, ['founders'])
      add('Headquarters', sd.headquarter || a.headquarter || co.headquarter || a.location, {}, ['headquarter', 'location'])
      add('Founded', date(sd.founded) || date(co.founded) || (a.yearOfCreation ? String(a.yearOfCreation) : null), {}, ['yearOfCreation'])
      add('Employees', big(sd.employees ?? co.employees, false))
      add('Revenue (TTM)', big(sd.revenue_ttm ?? co.revenue_2023))
      add('Net income (TTM)', big(sd.net_income_ttm ?? co.net_income_2023))
      add('P/E', num(sd.pe_ratio)?.toFixed(1)); add('P/B', num(sd.pb_ratio)?.toFixed(1))
      add('Dividend yield', pctVal(sd.dividend_yield)); add('Beta', num(sd.beta)?.toFixed(2))
      add('Shares out', big(sd.shares_outstanding, false))
      add('Stock price', a.stock_price_usd ? fmtPrice(Number(a.stock_price_usd)) : null, {}, ['stock_price_usd'])
      break
    case 'cryptocurrency':
      add('Market cap', big(a.market_cap), {}, ['market_cap'])
      add('Circulating', big(cd.circulating_supply, false)); add('Max supply', big(cd.max_supply, false)); add('Total supply', big(cd.total_supply, false))
      add('Consensus', cd.consensus_mechanism); add('Blockchain', cd.blockchain_name || a.industry, {}, ['industry'])
      add('Layer', cd.layer ? `L${cd.layer}` : (a.category ? String(a.category).replace(/layer(\d)/i, 'Layer $1') : null), {}, ['category'])
      add('Block time', cd.block_time_seconds ? `${cd.block_time_seconds} s` : null); add('Speed', cd.transaction_speed_tps ? `${cd.transaction_speed_tps} TPS` : null)
      add('Smart contracts', cd.has_smart_contracts === undefined ? null : cd.has_smart_contracts ? 'Yes' : 'No')
      add('Launched', cd.launch_year ? String(cd.launch_year) : date(a.launch_date), {}, ['launch_date'])
      add('Founders', list(cd.founders))
      add('Network', a.location, {}, ['location'])
      break
    case 'fiat_currency': {
      const quote = fd.quote_currency || a.currency || 'USD'
      const base = fd.base_currency || a.symbol
      const p = num(a.current_price)
      add('Pair', `${base}/${quote}`)
      add(`1 ${base}`, p ? `${p.toFixed(p < 0.1 ? 6 : 4)} ${quote}` : null)
      add(`1 ${quote}`, p ? `${(1 / p).toFixed(p < 0.1 ? 2 : 4)} ${base}` : null)
      add('Region', fd.country_or_region || a.location, {}, ['location'])
      add('Central bank', fd.central_bank); add('Pair type', word(fd.currency_pair_type || a.category), {}, ['category'])
      add('Interest rate', pctVal(fd.interest_rate)); add('Inflation', pctVal(fd.inflation_rate))
      add('GDP', big(fd.gdp_usd)); add('GDP growth', pctVal(fd.gdp_growth_rate)); add('Unemployment', pctVal(fd.unemployment_rate))
      add('Trade balance', num(fd.trade_balance_bn) !== null ? `$${fd.trade_balance_bn}B` : null); add('Debt / GDP', pctVal(fd.debt_to_gdp))
      add('Market', a.industry, {}, ['industry'])
      break
    }
    case 'commodity':
      add('Unit', word(md.unit)); add('Kind', word(md.commodity_type || a.category), {}, ['category'])
      add('Traded as', word(md.storage_type)); add('Industry', a.industry, {}, ['industry'])
      add('Producers', list(md.major_producers)); add('Consumers', list(md.major_consumers))
      add('Annual supply', big(md.supply_annual, false)); add('Annual demand', big(md.demand_annual, false))
      add('Inventory', big(md.inventory_level, false)); add('Production cost', md.production_cost_usd ? fmtPrice(Number(md.production_cost_usd)) : null)
      add('Market', a.location, {}, ['location'])
      break
    case 'bet': {
      const closes = bd.closes_at || a.expires_at
      const left = closes ? Date.parse(closes) - Date.now() : NaN
      add('Chance (yes)', fmtPrice(Number(a.current_price), 'probability'), {}, ['current_price'])
      add('Venue', betSourceLabel(bd.venue || a.source) || bd.venue, {}, ['source'])
      add('Outcome', bd.outcome ? String(bd.outcome).toUpperCase() : null)
      add('Yes bid / ask', num(bd.yes_bid_usd) !== null ? `${Math.round(bd.yes_bid_usd * 100)}¢ / ${Math.round(bd.yes_ask_usd * 100)}¢` : null)
      add('No bid / ask', num(bd.no_bid_usd) !== null ? `${Math.round(bd.no_bid_usd * 100)}¢ / ${Math.round(bd.no_ask_usd * 100)}¢` : null)
      add('Volume (contracts)', big(bd.volume, false)); add('24h volume', big(bd.volume_24h, false)); add('Open interest', big(bd.open_interest, false))
      add('Resolves', date(closes), {}, ['expires_at'])
      add('Time left', Number.isFinite(left) ? (left > 0 ? (left > 864e5 * 365 ? `${(left / (864e5 * 365)).toFixed(1)} years` : `${Math.ceil(left / 864e5)} days`) : 'closed') : null)
      add('Tradeable', bd.is_tradeable === undefined ? null : bd.is_tradeable ? 'Yes' : `No${bd.tradeable_reason ? ` (${bd.tradeable_reason})` : ''}`)
      add('About', a.subject, {}, ['subject'])
      add('Category', a.category, {}, ['category'])
      add('Market page', bd.url ? short(bd.url) : null, { href: link(bd.url) })
      break
    }
    default:
      add('Market cap', big(a.market_cap), {}, ['market_cap'])
      add('Category', word(a.category), {}, ['category']); add('Industry', a.industry, {}, ['industry']); add('Location', a.location, {}, ['location'])
  }
  // common to every type
  add('24h move', change.value === null ? null : fmtPct(change.value, 2), { tone: (change.value ?? 0) >= 0 ? 'up' : 'down' }, ['change_24h_pct', 'price_change_24h'])
  add('Risk', word(pp.risk ?? pp.risk_tolerance))
  add('Sentiment', word(pp.sentiment ?? pp.market_sentiment), { tone: (pp.sentiment ?? pp.market_sentiment) === 'bullish' ? 'up' : (pp.sentiment ?? pp.market_sentiment) === 'bearish' ? 'down' : undefined })
  add('Investor confidence', num(pp.investor_confidence) !== null ? `${Math.round(pp.investor_confidence * 100)}%` : null)
  add('Volatility index', num(a.volatility_index ?? pp.volatility_index) !== null ? `${Math.round(volIndexOf(a) * 100)} / 100` : null, {}, ['volatility_index'])
  add('Quoted in', currency.value, {}, ['currency'])
  add('Website', a.website ? short(a.website) : null, { href: link(a.website) }, ['website'])
  add('Price source', a.live
    ? (a.live.pair === 'strades-api' ? 'Strades backend quote (no history: chart simulated)' : a.live.proxy ? `Binance ${a.live.pair} (proxy: ${a.live.proxy})` : `Binance ${a.live.pair}`)
    : 'no live feed (simulated chart)', {}, ['live', 'quote_updated_at'])
  add('Price updated', date(a.quote_updated_at || a.updated_at))
  used.add('psychology_profile')
  return out.filter(Boolean) as Fact[]
})

// ── Type-only blocks ────────────────────────────────────────────────────────
const bet = computed(() => {
  const bd = merged.value.bet_detail
  if (!isBet.value) return null
  const p = Number(asset.value?.current_price) || 0
  return {
    yes: p, no: 1 - p, question: bd?.question || merged.value.question || asset.value?.name,
    bidAsk: bd && num(bd.yes_bid_usd) !== null
      ? { yb: bd.yes_bid_usd, ya: bd.yes_ask_usd, nb: bd.no_bid_usd, na: bd.no_ask_usd } : null,
  }
})
const supply = computed(() => {
  const cd = merged.value.crypto_detail
  if (!cd?.circulating_supply || !cd?.max_supply) return null
  return Math.min(100, (cd.circulating_supply / cd.max_supply) * 100)
})
const cryptoLinks = computed(() => {
  const cd = merged.value.crypto_detail ?? {}
  return [['Whitepaper', cd.whitepaper_url], ['GitHub', cd.github_url], ['Explorer', cd.explorer_url]].filter(([, u]) => !!u) as [string, string][]
})

// ── Related assets, each with the strength of its link to this one ─────────
const DEP_LEVEL: Record<string, number> = { critical: 95, high: 82, medium: 61, low: 38 }
interface RelatedRow {
  asset: Asset
  score: number
  kind: string
  relation: string
}
const related = computed<RelatedRow[]>(() => {
  const a = asset.value
  if (!a) return []
  const rows = new Map<string, RelatedRow>()
  const put = (sym: string, score: number, kind: string, relation: string) => {
    const o = bySymbol(sym)
    if (!o || o.id === a.id) return
    const prev = rows.get(o.id)
    const next = Math.max(0, Math.min(100, Math.round(score)))
    if (!prev || next > prev.score) rows.set(o.id, { asset: o, score: next, kind, relation })
  }
  for (const raw of (detail.value?.similar_assets ?? []) as any[]) {
    if (!raw) continue
    if (typeof raw === 'string') { put(raw, 58, 'similar', 'Similar market'); continue }
    const sym = String(raw.related_asset?.symbol ?? raw.symbol ?? '')
    const rel = String(raw.relationship_type ?? 'similar').replace(/_/g, ' ')
    const strength = Number(raw.strength)
    const corr = Number(raw.correlation_coefficient)
    let score = Number.isFinite(strength) ? (Math.abs(strength) <= 1 ? Math.abs(strength) * 100 : Math.abs(strength)) : 60
    if (Number.isFinite(corr)) score = Math.max(score, Math.abs(corr) * 100)
    const kind = /depend/.test(rel) ? 'dependency' : rel
    put(sym, score, kind, raw.description || rel)
  }
  for (const s of a.depends_on ?? []) put(String(s), 80, 'dependency', 'This asset depends on it')
  for (const s of a.similar_assets ?? []) put(String(s), 56, 'similar', 'Moves with this asset')
  const symU = a.symbol.toUpperCase()
  for (const o of assetsStore.assets) {
    if (o.depends_on?.some(s => String(s).toUpperCase() === symU)) put(o.symbol, 76, 'dependency', 'Depends on this asset')
    if (o.similar_assets?.some(s => String(s).toUpperCase() === symU)) put(o.symbol, 54, 'similar', 'Moves with this asset')
  }
  const cid = COMPANY_IDS[a.symbol.toUpperCase()]
  if (cid) {
    for (const r of relations.value) {
      const src = String(r.source_company ?? '')
      const tgt = String(r.target_company ?? '')
      if (src !== cid && tgt !== cid) continue
      const other = src === cid ? tgt : src
      const level = String(r.dependency_level ?? '').toLowerCase()
      const fromStrength = Number(r.strength)
      const score = DEP_LEVEL[level] ?? (Number.isFinite(fromStrength) ? Math.abs(fromStrength) * 100 : 50)
      const rel = String(r.relationship_type ?? 'linked').replace(/_/g, ' ')
      const named = byName(other.replace(/^\w/, (c: string) => c.toUpperCase())) ?? bySymbol(other)
      if (named) put(named.symbol, score, 'dependency', level ? `${rel} · ${level} dependency` : rel)
    }
  }
  if (rows.size < 3) {
    for (const o of assetsStore.assets) {
      if (rows.size >= 6) break
      if (o.type === a.type && o.id !== a.id) put(o.symbol, 32, 'same market', 'Same market, weaker link')
    }
  }
  return [...rows.values()].sort((x, y) => y.score - x.score).slice(0, 8)
})


// ── Profile, supply chain, people, calendar, map, tags ───────────────────────
interface Profile {
  tags?: string[]; people?: { name: string; role: string }[]; institutions?: { name: string; role: string }[]
  linked?: { name: string; symbol?: string; relation: string }[]
  suppliers?: { name: string; product?: string }[]; clients?: { name: string; product?: string }[]
  places?: { name: string; lat: number; lng: number; kind: MapPoint['kind'] }[]
  calendar?: { when: string; event: string; type: string }[]
}
const SUPPLY_FILES = new Set(['aapl', 'amzn', 'btc', 'cny', 'eth', 'eur', 'sol', 'tsla', 'usd'])
const COMPANY_IDS: Record<string, string> = { AAPL: 'apple', AMZN: 'amazon', GOOGL: 'google', MSFT: 'microsoft', TSLA: 'tesla' }
const profiles = ref<{ assets: Record<string, Profile>; bets: Record<string, Profile> } | null>(null)
const chain = ref<Record<string, any> | null>(null)
const relations = ref<any[]>([])
const influencers = ref<any[]>([])

async function loadExtras(sym: string, id: string) {
  chain.value = null
  const get = <T,>(p: string) => $fetch<T>(publicAssetUrl(p)).catch(() => null)
  const [pr, sc, rel, inf] = await Promise.all([
    profiles.value ? Promise.resolve(profiles.value) : get<any>('/data/asset_profiles.json'),
    SUPPLY_FILES.has(id.toLowerCase()) ? get<any>(`/data/supply_chain/${id.toLowerCase()}.json`) : Promise.resolve(null),
    relations.value.length ? Promise.resolve(relations.value) : get<any[]>('/data/relationships/company_relationships.json'),
    influencers.value.length ? Promise.resolve(influencers.value) : get<any[]>('/data/core/influencers.json'),
  ])
  profiles.value = pr
  chain.value = sc
  relations.value = rel ?? []
  influencers.value = inf ?? []
}
watch(() => asset.value?.symbol, (s) => { if (s && import.meta.client) loadExtras(s, String(asset.value!.id)) }, { immediate: true })

const profile = computed<Profile>(() => {
  const sym = String(asset.value?.symbol ?? '').toUpperCase()
  const p = profiles.value
  if (!p || !sym) return {}
  if (p.assets[sym]) return p.assets[sym]!
  const key = Object.keys(p.bets).filter(k => sym.startsWith(k)).sort((a, b) => b.length - a.length)[0]
  return key ? p.bets[key]! : {}
})

const bySymbol = (s?: string) => s ? assetsStore.assets.find(a => a.symbol.toUpperCase() === s.toUpperCase()) : undefined
const byName = (n: string) => assetsStore.assets.find(a => a.type !== 'bet' && (a.name.toLowerCase() === n.toLowerCase() || a.name.toLowerCase().startsWith(n.toLowerCase().split(' ')[0] + ' ')))

// Suppliers / clients: shares and nominal values from the supply-chain data; names only from the profile otherwise.
const treeSuppliers = computed(() => {
  const s = chain.value?.suppliers as any[] | undefined
  if (s?.length) return s.map(n => ({ name: n.name, sub: n.product, share_pct: n.share_pct, value_usd: n.value_usd, flag: n.country_flag, assetId: byName(n.name)?.id }))
  return (profile.value.suppliers ?? []).map(n => ({ name: n.name, sub: n.product, assetId: byName(n.name)?.id }))
})
const treeClients = computed(() => {
  const s = chain.value?.customers as any[] | undefined
  if (s?.length) return s.map(n => ({ name: n.name, sub: n.product, share_pct: n.share_pct, value_usd: n.value_usd, flag: n.country_flag, assetId: byName(n.name)?.id }))
  return (profile.value.clients ?? []).map(n => ({ name: n.name, sub: n.product, assetId: byName(n.name)?.id }))
})
const treeSimilar = computed(() => (asset.value?.similar_assets ?? []).map(s => bySymbol(s)).filter(Boolean).slice(0, 4)
  .map(a => ({ name: a!.symbol, sub: fmtPrice(Number(a!.current_price), priceKindOf(a!), a!.currency || 'USD'), assetId: a!.id })))
const treeLabels = computed(() => ({
  suppliers: chain.value?.label_overrides?.suppliers ?? (type.value === 'cryptocurrency' ? 'Producers' : type.value === 'commodity' ? 'Producers' : 'Suppliers'),
  clients: chain.value?.label_overrides?.customers ?? (type.value === 'commodity' ? 'Demand' : 'Main clients'),
}))

// Map
const mapPoints = computed<MapPoint[]>(() => {
  const out: MapPoint[] = []
  const sc = chain.value
  if (sc?.headquarters?.lat !== undefined) out.push({ name: sc.headquarters.name, lat: sc.headquarters.lat, lng: sc.headquarters.lng, kind: 'hq', sub: sc.headquarters.city })
  for (const f of sc?.facilities ?? []) if (!out.some(o => o.lat === f.lat && o.lng === f.lng)) out.push({ name: f.name, lat: f.lat, lng: f.lng, kind: 'facility', sub: f.type })
  for (const s of sc?.suppliers ?? []) out.push({ name: s.name, lat: s.lat, lng: s.lng, kind: 'supplier', sub: s.product })
  for (const c of sc?.customers ?? []) out.push({ name: c.name, lat: c.lat, lng: c.lng, kind: 'client', sub: c.product })
  for (const p of profile.value.places ?? []) if (!out.some(o => o.name === p.name)) out.push({ ...p })
  return out
})

// People & institutions
const people = computed(() => {
  const list: { name: string; role: string }[] = [...(profile.value.people ?? [])]
  const sd = merged.value.stock_detail ?? {}
  const co = company.value?.company_details ?? {}
  const ceo = sd.ceo || merged.value.ceo || co.ceo
  if (ceo) list.push({ name: ceo, role: 'CEO' })
  for (const f of (sd.founders?.length ? sd.founders : merged.value.founders ?? co.founders ?? []) as string[]) list.push({ name: f, role: 'Founder' })
  if (isBet.value) {
    const q = String(merged.value.bet_detail?.question || asset.value?.name || '')
    const m = q.match(/^Will\s+(.+?)\s+(?:be|become|visit)\s/i)
    if (m && m[1] && !/^(the|humans|a)\b/i.test(m[1])) list.unshift({ name: m[1], role: 'Subject of the bet' })
  }
  const seen = new Set<string>()
  return list.filter(p => !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
})
const institutions = computed(() => {
  const list = [...(profile.value.institutions ?? [])]
  for (const r of (company.value?.regulatory_matters ?? []) as any[]) list.push({ name: r.issue, role: `${r.status}${r.timeline ? ` · ${r.timeline}` : ''}` })
  return list
})
const CLASS_OF: Record<string, string[]> = { cryptocurrency: ['crypto'], fiat_currency: ['fiat', 'forex'], commodity: ['commodities'], stock: ['equities', 'stocks'] }
const watchers = computed(() => {
  const sym = String(asset.value?.symbol ?? '').toUpperCase()
  const cls = CLASS_OF[type.value] ?? []
  return influencers.value
    .filter(i => String(i.latest_signal?.asset ?? '').toUpperCase().includes(sym) || (i.specialization ?? []).some((s: string) => cls.includes(s)))
    .slice(0, 6)
    .map(i => ({ ...i, about: String(i.latest_signal?.asset ?? '').toUpperCase().includes(sym) }))
})

// Linked companies
const linked = computed(() => {
  const list: { name: string; relation: string; id?: string }[] = []
  for (const l of profile.value.linked ?? []) list.push({ name: l.name, relation: l.relation, id: bySymbol(l.symbol)?.id ?? byName(l.name)?.id })
  const cid = COMPANY_IDS[String(asset.value?.symbol ?? '').toUpperCase()]
  for (const r of relations.value.filter(r => r.source_company === cid)) {
    const name = String(r.target_company).replace(/^\w/, (c: string) => c.toUpperCase())
    list.push({ name, relation: `${String(r.relationship_type).replace(/_/g, ' ')} · ${r.dependency_level ?? ''} dependency`, id: byName(name)?.id })
  }
  for (const c of (company.value?.competitors ?? []) as any[]) list.push({ name: c.name, relation: `competitor · ${c.market_share_overlap ?? ''} overlap`, id: bySymbol(c.symbol)?.id })
  const seen = new Set<string>()
  return list.filter(l => !seen.has(l.name.toLowerCase()) && seen.add(l.name.toLowerCase()))
})

// Calendar: dated items (bet resolution, company events, your and friends' calls) + recurring ones
const calendar = computed(() => {
  const dated: { t: number; title: string; type: string; mine?: boolean }[] = []
  const a = merged.value
  const closes = a.bet_detail?.closes_at || a.expires_at
  if (closes) dated.push({ t: Date.parse(closes), title: 'Market resolves', type: 'resolution' })
  for (const e of [...((company.value?.upcoming_events ?? []) as any[]), ...((a.calendar_events ?? []) as any[])]) {
    const t = Date.parse(e.date)
    if (Number.isFinite(t)) dated.push({ t, title: e.event ?? e.title ?? 'Event', type: String(e.type ?? 'event').replace(/_/g, ' ') })
  }
  for (const p of predStore.predictions.filter(p => p.assetId === asset.value?.symbol && p.status === 'pending')) {
    const mine = p.userId === 'current_user'
    if (!mine && !friends.isRevealed.value) continue
    if (!mine && !friends.predictions.value.some(f => f.id === p.id)) continue
    dated.push({ t: targetTsOf(p), title: `${mine ? 'Your' : `${friendProfile(p.userId).name}'s`} ${p.timeframe} call: ${fmtAxisPrice(p.predictedPrice, kind.value)} (${fmtPct(p.predictedChangePct)})`, type: mine ? 'your call' : 'friend call', mine })
  }
  const now = Date.now()
  const upcoming = dated.filter(d => Number.isFinite(d.t) && d.t >= now - 864e5).sort((x, y) => x.t - y.t)
  const past = dated.filter(d => Number.isFinite(d.t) && d.t < now - 864e5).sort((x, y) => y.t - x.t).slice(0, 4)
  return { upcoming, past, recurring: profile.value.calendar ?? [] }
})
function calDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

// Tags: the asset's own, the profile's, derived ones and the user's own (saved, and a training signal)
const tracker = useAgentTracker()
const userTags = ref<string[]>([])
const tagInput = ref('')
const tagsOpen = ref(false)
const TAG_KEY = 'strades:asset-tags'
function readTags(): Record<string, string[]> { try { return JSON.parse(localStorage.getItem(TAG_KEY) || '{}') } catch { return {} } }
watch(() => asset.value?.symbol, (s) => { if (s && import.meta.client) userTags.value = readTags()[s] ?? [] }, { immediate: true })
function addTag() {
  const t = tagInput.value.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 32)
  const sym = asset.value?.symbol
  tagInput.value = ''
  if (!t || !sym || userTags.value.includes(t)) return
  userTags.value = [...userTags.value, t]
  const all = readTags(); all[sym] = userTags.value; localStorage.setItem(TAG_KEY, JSON.stringify(all))
  tracker.track('asset_tag', { component: 'AssetPage', asset_id: asset.value!.id, symbol: sym, tag: t })
}
function removeTag(t: string) {
  const sym = asset.value?.symbol
  if (!sym) return
  userTags.value = userTags.value.filter(x => x !== t)
  const all = readTags(); all[sym] = userTags.value; localStorage.setItem(TAG_KEY, JSON.stringify(all))
}
const allTags = computed(() => {
  const a = merged.value
  const out: { tag: string; kind: 'asset' | 'profile' | 'derived' }[] = []
  const push = (tag: unknown, kind: 'asset' | 'profile' | 'derived') => {
    if (!tag) return
    const t = String(tag).toLowerCase().replace(/[_\s]+/g, '-')
    if (!out.some(o => o.tag === t)) out.push({ tag: t, kind })
  }
  for (const t of a.tags ?? []) push(t, 'asset')
  for (const t of profile.value.tags ?? []) push(t, 'profile')
  push(typeLabel.value, 'derived'); push(a.category, 'derived'); push(a.industry, 'derived')
  if (a.location && !/global|decentrali/i.test(a.location)) push(a.location, 'derived')
  const v = volIndexOf(a)
  push(v >= 0.5 ? 'high-volatility' : v >= 0.2 ? 'medium-volatility' : 'low-volatility', 'derived')
  const cap = Number(a.market_cap) || 0
  if (cap) push(cap >= 2e11 ? 'mega-cap' : cap >= 1e10 ? 'large-cap' : cap >= 2e9 ? 'mid-cap' : 'small-cap', 'derived')
  const pp = a.psychology_profile ?? {}
  if (pp.risk) push(`${pp.risk}-risk`, 'derived')
  if (pp.sentiment) push(pp.sentiment, 'derived')
  push(a.live ? 'live-price' : 'simulated-price', 'derived')
  if (isBet.value) {
    const closes = Date.parse(a.bet_detail?.closes_at || a.expires_at || '')
    if (Number.isFinite(closes)) push(closes - Date.now() > 365 * 864e5 ? 'resolves-after-1y' : 'resolves-within-1y', 'derived')
  }
  return out
})

// Section jump bar (only sections that render)
const jumps = computed(() => [
  { id: 'sec-chart', label: 'Chart', on: true },
  { id: 'sec-facts', label: 'Facts', on: true },
  { id: 'sec-supply', label: 'Supply chain', on: treeSuppliers.value.length + treeClients.value.length + treeSimilar.value.length > 0 },
  { id: 'sec-map', label: 'Map', on: mapPoints.value.length > 0 },
  { id: 'sec-people', label: 'People', on: people.value.length + institutions.value.length > 0 },
  { id: 'sec-linked', label: 'Linked', on: linked.value.length > 0 },
  { id: 'sec-calendar', label: 'Calendar', on: calendar.value.upcoming.length + calendar.value.recurring.length > 0 },
  { id: 'sec-market', label: 'Market', on: !!bet.value },
  { id: 'sec-alerts', label: 'Alerts', on: true },
  { id: 'sec-trade', label: 'Paper trade', on: true },
  { id: 'sec-related', label: 'Related', on: related.value.length > 0 },
  { id: 'sec-data', label: 'All data', on: true },
].filter(j => j.on))
function jump(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (el instanceof HTMLDetailsElement) el.open = true
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ── Everything else ─────────────────────────────────────────────────────────
const CURATED: Record<string, Set<string>> = {
  bet_detail: new Set(['venue', 'question', 'outcome', 'yes_bid_usd', 'yes_ask_usd', 'no_bid_usd', 'no_ask_usd', 'last_price_usd', 'volume', 'volume_24h', 'open_interest', 'is_tradeable', 'tradeable_reason', 'closes_at', 'url']),
  stock_detail: new Set(['exchange', 'sector', 'ceo', 'founders', 'headquarter', 'founded', 'employees', 'revenue_ttm', 'net_income_ttm', 'pe_ratio', 'pb_ratio', 'dividend_yield', 'beta', 'shares_outstanding']),
  crypto_detail: new Set(['circulating_supply', 'max_supply', 'total_supply', 'consensus_mechanism', 'blockchain_name', 'layer', 'block_time_seconds', 'transaction_speed_tps', 'has_smart_contracts', 'launch_year', 'founders', 'whitepaper_url', 'github_url', 'explorer_url', 'use_cases']),
  forex_detail: new Set(['base_currency', 'quote_currency', 'country_or_region', 'central_bank', 'currency_pair_type', 'interest_rate', 'inflation_rate', 'gdp_usd', 'gdp_growth_rate', 'unemployment_rate', 'trade_balance_bn', 'debt_to_gdp']),
  commodity_detail: new Set(['unit', 'commodity_type', 'storage_type', 'major_producers', 'major_consumers', 'supply_annual', 'demand_annual', 'inventory_level', 'production_cost_usd']),
}
const HEADER_KEYS = new Set(['id', 'symbol', 'name', 'type', 'description', 'icon_url', 'current_price', 'tags', 'is_active',
  'created_at', 'updated_at', 'return_history', 'similar_assets', 'depends_on', 'liquidity_depth', 'fluctuation_velocity'])
const rest = computed(() => {
  void facts.value
  const a = merged.value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(a)) {
    if (HEADER_KEYS.has(k) || used.has(k)) continue
    if (['stock_detail', 'crypto_detail', 'forex_detail', 'commodity_detail', 'bet_detail'].includes(k)) {
      if (v && typeof v === 'object') {
        // fields already shown in the facts above are not repeated
        const skip = CURATED[k] ?? new Set<string>()
        const left = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([kk]) => !skip.has(kk)))
        out[k.replace('_detail', ' details')] = left
      }
      continue
    }
    out[k] = v
  }
  if (a.similar_assets?.length || a.depends_on?.length) {
    out.links = { similar_assets: a.similar_assets ?? [], depends_on: a.depends_on ?? [] }
  }
  if (company.value) {
    const { id: _i, name: _n, symbol: _s, type: _t, description: _d, current_price: _c, currency: _cu, ...c } = company.value
    out['company profile'] = c
  }
  return out
})
const tags = computed(() => [...(asset.value?.tags ?? [])])
</script>

<template>
  <div class="ad">
    <div class="ad-top">
      <NuxtLink to="/prices" class="ad-back">← Prices</NuxtLink>
      <ChartStyleToggle />
    </div>

    <div v-if="!mounted || (loading && !asset)" class="ad-state">Loading…</div>
    <div v-else-if="!asset" class="ad-state">
      <h1>Asset not found</h1>
      <p>No asset “{{ routeId }}”.</p>
      <NuxtLink to="/prices" class="ad-back">← Back to prices</NuxtLink>
    </div>

    <template v-else>
      <!-- ── Header ── -->
      <header class="ad-head" :style="{ '--ad-type': typeColor }">
        <div class="ad-head-row">
          <h1 class="ad-name" :title="asset.name">{{ asset.name }}</h1>
          <span class="ad-type">{{ typeLabel }}<template v-if="isBet && betSourceLabel(asset.source)"> · {{ betSourceLabel(asset.source) }}</template></span>
          <span v-if="!asset.live" class="ad-sim" title="No live market feed: the chart is simulated">sim</span>
          <span class="ad-head-end">
          <AssetBotChip :symbol="asset.symbol" :asset-id="String(asset.id)" />
          <button
            v-if="friends.faces.value.length"
            type="button"
            class="ad-friends"
            :class="{ on: friends.isRevealed.value }"
            :aria-pressed="friends.isRevealed.value"
            :title="friends.isRevealed.value ? 'Hide friends\' calls' : 'Show friends\' calls (hidden so your own call stays unbiased)'"
            @click="friends.toggle()"
          >
            <img v-for="f in friends.faces.value.slice(0, 4)" :key="f.id" :src="f.avatar" :alt="f.name" class="ad-face" />
            <span class="ad-friends-label">{{ friends.isRevealed.value ? 'Hide' : 'Show' }} {{ friends.faces.value.length }}</span>
          </button>
          </span>
        </div>
        <div class="ad-id-row">
          <div class="ad-ident">
            <div class="ad-plate">
              <img v-if="asset.icon_url && !iconFailed" :src="asset.icon_url" :alt="asset.name" @error="iconFailed = true" />
              <span v-else>{{ asset.symbol.slice(0, 4) }}</span>
            </div>
            <span class="ad-ticker" :title="asset.symbol">{{ asset.symbol }}</span>
          </div>
          <div class="ad-price-col">
            <span class="ad-price">{{ fmtPrice(Number(asset.current_price), kind, currency) }}</span>
            <span class="ad-sub">
              <span v-if="change !== null" class="ad-chg" :class="change >= 0 ? 'up' : 'down'">{{ fmtPct(change, 2) }} 24h</span>
              <span v-if="isBet" class="ad-muted">chance of YES</span>
              <span v-if="asset.live?.proxy" class="ad-muted" :title="`Priced from ${asset.live.proxy}`">via {{ asset.live.proxy }}</span>
            </span>
          </div>
        </div>
        <p v-if="asset.description && !asset.description.startsWith(asset.name)" class="ad-desc" :class="{ open: descOpen }" @click="descOpen = !descOpen">{{ asset.description }}</p>
        <div class="ad-tags">
          <span v-for="t in (tagsOpen ? allTags : allTags.slice(0, 9))" :key="t.tag" class="ad-tag" :class="t.kind">#{{ t.tag }}</span>
          <button v-if="allTags.length > 9" type="button" class="ad-tag more" @click="tagsOpen = !tagsOpen">{{ tagsOpen ? 'less' : `+${allTags.length - 9}` }}</button>
          <span v-for="t in userTags" :key="'u' + t" class="ad-tag mine">#{{ t }}<button type="button" :aria-label="`Remove tag ${t}`" @click="removeTag(t)">✕</button></span>
          <form class="ad-tag-add" @submit.prevent="addTag">
            <input v-model="tagInput" type="text" placeholder="+ your tag" aria-label="Add your own tag" maxlength="32" />
          </form>
        </div>
      </header>

      <nav class="ad-jump" aria-label="Sections">
        <a v-for="j in jumps" :key="j.id" :href="`#${j.id}`" @click.prevent="jump(j.id)">{{ j.label }}</a>
      </nav>

      <!-- ── Prediction chart ── -->
      <section id="sec-chart" class="ad-card">
        <PredictPanel
          :asset="asset"
          source="detail"
          :height="250"
          :friends="friends.predictions.value"
          :reveal-friends="friends.isRevealed.value"
        />
      </section>

      <!-- ── Key facts ── -->
      <section id="sec-facts" class="ad-card">
        <h2>{{ typeLabel }} facts</h2>
        <dl class="ad-facts">
          <div v-for="f in facts" :key="f.label" class="ad-fact">
            <dt>{{ f.label }}</dt>
            <dd :class="f.tone">
              <a v-if="f.href" :href="f.href" target="_blank" rel="noopener">{{ f.value }}</a>
              <template v-else>{{ f.value }}</template>
            </dd>
          </div>
        </dl>
      </section>


      <!-- ── Suppliers → asset → clients ── -->
      <section v-if="treeSuppliers.length || treeClients.length || treeSimilar.length" id="sec-supply" class="ad-card">
        <h2>Supply chain</h2>
        <SupplyTree
          :center="{ symbol: asset.symbol, name: asset.name, color: typeColor, price: fmtPrice(Number(asset.current_price), kind, currency) }"
          :suppliers="treeSuppliers" :clients="treeClients" :similar="treeSimilar"
          :supplier-label="treeLabels.suppliers" :client-label="treeLabels.clients"
        />
        <p v-if="!chain && (treeSuppliers.length || treeClients.length)" class="ad-note">Shares and nominal values not published for this asset: names only.</p>
      </section>

      <!-- ── Map ── -->
      <section v-if="mapPoints.length" id="sec-map" class="ad-card">
        <h2>Map</h2>
        <WorldMap :points="mapPoints" />
      </section>

      <!-- ── People & institutions ── -->
      <section v-if="people.length || institutions.length || watchers.length" id="sec-people" class="ad-card">
        <h2>People &amp; institutions</h2>
        <div class="ad-people">
          <div v-for="p in people" :key="'p' + p.name" class="ad-person">
            <span class="ad-initials" aria-hidden="true">{{ p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('') }}</span>
            <span class="ad-pname">{{ p.name }}</span><span class="ad-prole">{{ p.role }}</span>
          </div>
        </div>
        <div v-if="institutions.length" class="ad-insts">
          <div v-for="i in institutions" :key="'i' + i.name" class="ad-inst"><b>{{ i.name }}</b><span>{{ i.role }}</span></div>
        </div>
        <template v-if="watchers.length">
          <h3>Traders who cover it</h3>
          <div class="ad-people">
            <div v-for="w in watchers" :key="w.id" class="ad-person">
              <img :src="w.avatar_url" :alt="w.name" class="ad-initials img" />
              <span class="ad-pname">{{ w.handle }}</span>
              <span class="ad-prole">{{ w.about ? `${w.latest_signal.type} ${w.latest_signal.asset} · “${w.latest_signal.thesis}”` : `${Math.round(w.followers / 1000)}k followers · ${Math.round(w.win_rate_calls_30d * 100)}% hit rate` }}</span>
            </div>
          </div>
        </template>
      </section>

      <!-- ── Linked companies ── -->
      <section v-if="linked.length" id="sec-linked" class="ad-card">
        <h2>Linked companies</h2>
        <div class="ad-linked">
          <component :is="l.id ? 'NuxtLink' : 'div'" v-for="l in linked" :key="l.name" :to="l.id ? `/assets/${l.id}` : undefined" class="ad-link-row" :class="{ go: l.id }">
            <b>{{ l.name }}</b><span>{{ l.relation }}</span>
          </component>
        </div>
      </section>

      <!-- ── Calendar ── -->
      <section v-if="calendar.upcoming.length || calendar.recurring.length || calendar.past.length" id="sec-calendar" class="ad-card">
        <h2>Calendar</h2>
        <ol class="ad-cal">
          <li v-for="(c, i) in calendar.upcoming" :key="'u' + i" :class="{ mine: c.mine }">
            <time>{{ calDate(c.t) }}</time><span class="ad-cal-title">{{ c.title }}</span><span class="ad-cal-type">{{ c.type }}</span>
          </li>
          <li v-for="(c, i) in calendar.recurring" :key="'r' + i" class="recurring">
            <time>{{ c.when }}</time><span class="ad-cal-title">{{ c.event }}</span><span class="ad-cal-type">{{ c.type }}</span>
          </li>
          <li v-for="(c, i) in calendar.past" :key="'p' + i" class="past">
            <time>{{ calDate(c.t) }}</time><span class="ad-cal-title">{{ c.title }}</span><span class="ad-cal-type">past</span>
          </li>
        </ol>
      </section>

      <!-- ── Type-only blocks ── -->
      <section v-if="bet" id="sec-market" class="ad-card">
        <h2>Market</h2>
        <p class="ad-q">{{ bet.question }}</p>
        <div class="ad-yesno" role="img" :aria-label="`Yes ${Math.round(bet.yes * 100)} percent, no ${Math.round(bet.no * 100)} percent`">
          <span class="yes" :style="{ flexBasis: `${bet.yes * 100}%` }">YES {{ (bet.yes * 100).toFixed(1) }}%</span>
          <span class="no" :style="{ flexBasis: `${bet.no * 100}%` }">NO {{ (bet.no * 100).toFixed(1) }}%</span>
        </div>
        <table v-if="bet.bidAsk" class="ad-book">
          <thead><tr><th /><th>Bid</th><th>Ask</th><th>Spread</th></tr></thead>
          <tbody>
            <tr><th class="up">Yes</th><td>{{ Math.round(bet.bidAsk.yb * 100) }}¢</td><td>{{ Math.round(bet.bidAsk.ya * 100) }}¢</td><td>{{ Math.round((bet.bidAsk.ya - bet.bidAsk.yb) * 100) }}¢</td></tr>
            <tr><th class="down">No</th><td>{{ Math.round(bet.bidAsk.nb * 100) }}¢</td><td>{{ Math.round(bet.bidAsk.na * 100) }}¢</td><td>{{ Math.round((bet.bidAsk.na - bet.bidAsk.nb) * 100) }}¢</td></tr>
          </tbody>
        </table>
      </section>

      <section v-if="type === 'cryptocurrency' && (supply !== null || cryptoLinks.length || merged.crypto_detail?.use_cases?.length)" class="ad-card">
        <h2>Network</h2>
        <div v-if="supply !== null" class="ad-bar"><i :style="{ width: supply + '%' }" /><span>{{ supply.toFixed(1) }}% of max supply in circulation</span></div>
        <div v-if="merged.crypto_detail?.use_cases?.length" class="ad-chips"><span v-for="u in merged.crypto_detail.use_cases" :key="u" class="ad-chip">{{ u }}</span></div>
        <div v-if="cryptoLinks.length" class="ad-chips"><a v-for="[l, u] in cryptoLinks" :key="l" :href="u" target="_blank" rel="noopener" class="ad-chip link">{{ l }}</a></div>
      </section>

      <section v-if="type === 'commodity'" class="ad-card">
        <h2>Commodity flows in your strategies</h2>
        <AssetCommodityPipeline :compact="true" />
      </section>

      <!-- ── Alerts · paper trade ── -->
      <section id="sec-alerts" class="ad-card">
        <h2>Price alerts</h2>
        <PriceChart :asset-id="asset.id" :asset="asset" :current-price="Number(asset.current_price)" :volatility="volIndexOf(asset)" :height="180" />
      </section>

      <section id="sec-trade" class="ad-card">
        <h2>Paper trade</h2>
        <AssetQuickPaperBet :asset-id="String(asset.id)" :asset-symbol="asset.symbol" :current-price="Number(asset.current_price) || 100" />
      </section>

      <!-- ── Related ── -->
      <section v-if="related.length" id="sec-related" class="ad-card">
        <h2>Related</h2>
        <div class="ad-related">
          <NuxtLink v-for="r in related" :key="r.asset.id" :to="`/assets/${r.asset.id}`" class="ad-rel" :title="r.relation">
            <span class="ad-rel-sym">{{ r.asset.symbol.length > 9 ? r.asset.symbol.slice(0, 8) + '…' : r.asset.symbol }}</span>
            <span class="ad-rel-main">
              <span class="ad-rel-name">{{ r.asset.name }}</span>
              <span class="ad-rel-sub">
                <span class="ad-rel-price">{{ fmtPrice(Number(r.asset.current_price), priceKindOf(r.asset), r.asset.currency || 'USD') }}</span>
                <span v-if="typeof r.asset.change_24h_pct === 'number'" :class="r.asset.change_24h_pct >= 0 ? 'up' : 'down'">{{ fmtPct(r.asset.change_24h_pct) }}</span>
              </span>
            </span>
            <span class="ad-rel-dep">
              <span class="ad-rel-kind">{{ r.relation }}</span>
              <strong>{{ r.score }}</strong>
              <span class="ad-rel-meter" aria-hidden="true"><i :style="{ width: r.score + '%' }" /></span>
            </span>
          </NuxtLink>
        </div>
      </section>

      <!-- ── Everything else ── -->
      <details id="sec-data" class="ad-card ad-all">
        <summary><h2>All data</h2><span class="ad-muted">every field we have for {{ asset.symbol }}</span></summary>
        <AssetDataTree :data="rest" :currency="currency" />
      </details>
    </template>
  </div>
</template>

<style scoped>
.ad {
  display: flex; flex-direction: column; gap: 6px;
  max-width: 1100px; margin: 0 auto;
  padding: 6px 6px calc(96px + env(safe-area-inset-bottom));
  color: var(--text-white, #fff);
  font-family: var(--font-family-secondary, inherit);
}
.ad-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ad-back { color: var(--text-gray, #9aa0a6); text-decoration: none; font-size: 0.78rem; padding: 4px 2px; }
.ad-back:hover { color: var(--text-white, #fff); }
.ad-state { padding: 24px 8px; text-align: center; color: var(--text-gray, #9aa0a6); }

.ad-head, .ad-card {
  background: var(--card-bg, rgba(255,255,255,.03));
  border: 1px solid var(--border-primary, rgba(255,255,255,.1));
  border-radius: 10px;
  padding: 6px 8px;
  min-width: 0;
}
.ad-head { border-left: 3px solid var(--ad-type); }
.ad-head-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ad-name { margin: 0; min-width: 0; font-size: 1.05rem; font-weight: 750; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
.ad-type {
  flex-shrink: 0; padding: 0 7px; line-height: 16px; border-radius: 999px; font-size: 0.6rem; font-weight: 700;
  color: var(--ad-type); border: 1px solid color-mix(in srgb, var(--ad-type) 45%, transparent);
  background: color-mix(in srgb, var(--ad-type) 12%, transparent); white-space: nowrap;
}
.ad-sim { flex-shrink: 0; font-size: .56rem; text-transform: uppercase; letter-spacing: .05em; padding: 0 5px; line-height: 14px; border-radius: 999px; border: 1px dashed var(--text-gray, #888); color: var(--text-gray, #888); }
.ad-head-end { margin-left: auto; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; }
.ad-friends {
  flex-shrink: 0; display: inline-flex; align-items: center;
  min-height: 30px; padding: 2px 8px 2px 3px; border-radius: 999px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.14)); background: rgba(255,255,255,.03);
  color: var(--text-gray, #9aa0a6); cursor: pointer; font-size: 0.66rem; font-weight: 600; font-family: inherit;
}
.ad-friends.on { color: var(--text-white, #fff); border-color: rgba(120,170,255,.7); background: rgba(120,170,255,.12); }
.ad-face { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; margin-left: -6px; border: 1.5px solid #121214; background: #222; }
.ad-face:first-child { margin-left: 0; }
.ad-friends-label { margin-left: 5px; }
.ad-id-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.ad-ident { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 52px; flex-shrink: 0; }
.ad-plate {
  width: 44px; height: 44px; border-radius: 11px; background: #eef1f4; display: grid; place-items: center; overflow: hidden;
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--ad-type) 65%, transparent);
  font: 700 .66rem/1 var(--font-market-data, monospace); color: #37474f;
}
.ad-plate img { width: 32px; height: 32px; object-fit: contain; }
.ad-ticker { max-width: 52px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 800 0.62rem/1 var(--font-market-data, inherit); color: var(--ad-type); letter-spacing: .03em; }
.ad-price-col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ad-price { font: 800 1.5rem/1.05 var(--font-market-data, inherit); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.ad-sub { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 0.7rem; }
.ad-chg { font-weight: 700; font-family: var(--font-market-data, inherit); }
.up { color: var(--app-color-up, #00ff88); }
.down { color: var(--app-color-down, #ff4444); }
.ad-muted { color: var(--text-gray, #9aa0a6); }
.ad-desc {
  margin: 5px 0 0; font-size: 0.76rem; line-height: 1.4; color: var(--text-light-gray, rgba(255,255,255,.75));
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; cursor: pointer; white-space: pre-line;
}
.ad-desc.open { -webkit-line-clamp: unset; line-clamp: unset; }

.ad-card h2 { margin: 0 0 4px; font-size: 0.68rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-light-gray, rgba(255,255,255,.7)); font-weight: 700; }
.ad-facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 5px 10px; margin: 0; }
.ad-fact { min-width: 0; }
.ad-fact dt { font-size: 0.6rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-gray, #9aa0a6); }
.ad-fact dd { margin: 0; font-size: 0.8rem; font-weight: 600; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.ad-fact a { color: var(--primary-blue, #6aa8ff); text-decoration: none; }

.ad-q { margin: 0 0 6px; font-size: 0.8rem; }
.ad-yesno { display: flex; height: 22px; border-radius: 6px; overflow: hidden; font: 700 0.66rem/22px var(--font-market-data, inherit); }
.ad-yesno span { padding: 0 6px; white-space: nowrap; overflow: hidden; min-width: 0; }
.ad-yesno .yes { background: color-mix(in srgb, var(--app-color-up, #00ff88) 30%, transparent); color: var(--app-color-up, #00ff88); }
.ad-yesno .no { background: color-mix(in srgb, var(--app-color-down, #ff4444) 25%, transparent); color: var(--app-color-down, #ff4444); text-align: right; }
.ad-book { margin-top: 6px; border-collapse: collapse; font: 0.74rem var(--font-market-data, inherit); font-variant-numeric: tabular-nums; }
.ad-book th, .ad-book td { padding: 2px 12px 2px 0; text-align: left; }
.ad-book thead th { color: var(--text-gray, #9aa0a6); font-weight: 600; font-size: 0.62rem; }

.ad-bar { position: relative; height: 18px; border-radius: 5px; background: rgba(255,255,255,.06); overflow: hidden; font-size: 0.66rem; }
.ad-bar i { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--ad-type, #f7931a) 40%, transparent); }
.ad-bar span { position: relative; padding: 0 6px; line-height: 18px; }
.ad-chips { display: flex; flex-wrap: wrap; gap: 3px; margin: 4px 0; }
.ad-chip { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border-primary, rgba(255,255,255,.12)); font-size: 0.68rem; color: var(--text-light-gray, rgba(255,255,255,.8)); text-decoration: none; }
.ad-chip.link { color: var(--primary-blue, #6aa8ff); }

.ad-related { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 3px; }
.ad-rel {
  display: grid; grid-template-columns: 58px minmax(0, 1fr) 92px; align-items: center; gap: 6px;
  padding: 5px 6px; border-radius: 6px; background: rgba(255,255,255,.03); color: inherit; text-decoration: none; font-size: 0.72rem;
}
.ad-rel:hover { background: rgba(255,255,255,.07); }
.ad-rel-sym { font: 800 0.66rem/1 var(--font-market-data, inherit); }
.ad-rel-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ad-rel-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-light-gray, rgba(255,255,255,.75)); }
.ad-rel-sub { display: flex; gap: 6px; font-family: var(--font-market-data, inherit); font-variant-numeric: tabular-nums; font-size: 0.66rem; }
.ad-rel-dep { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; min-width: 0; }
.ad-rel-kind { max-width: 92px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.56rem; letter-spacing: .01em; color: var(--text-gray, #9aa0a6); text-align: right; }
.ad-rel-dep strong { font: 800 0.78rem/1 var(--font-market-data, inherit); font-variant-numeric: tabular-nums; }
.ad-rel-meter { width: 72px; height: 3px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.ad-rel-meter i { display: block; height: 100%; background: color-mix(in srgb, var(--ad-type, #6aa8ff) 80%, white); }


.ad-card h3 { margin: 6px 0 3px; font-size: 0.62rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-gray, #9aa0a6); }
.ad-note { margin: 3px 0 0; font-size: 0.64rem; color: var(--text-gray, #9aa0a6); }
.ad-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 5px; align-items: center; }
.ad-tag { display: inline-flex; align-items: center; gap: 2px; padding: 0 7px; line-height: 18px; border-radius: 999px; font-size: 0.64rem; border: 1px solid var(--border-primary, rgba(255,255,255,.12)); color: var(--text-light-gray, rgba(255,255,255,.78)); }
.ad-tag.derived { border-style: dashed; color: var(--text-gray, #9aa0a6); }
.ad-tag.profile { border-color: color-mix(in srgb, var(--ad-type) 40%, transparent); }
.ad-tag.more { background: none; cursor: pointer; font: inherit; font-size: 0.64rem; color: rgba(170,200,255,.95); }
.ad-tag.mine { border-color: rgba(120,170,255,.6); color: rgba(170,200,255,.95); }
.ad-tag button { border: 0; background: none; color: inherit; cursor: pointer; padding: 0 0 0 2px; font-size: .6rem; }
.ad-tag-add input { width: 88px; height: 20px; padding: 0 7px; border-radius: 999px; border: 1px dashed rgba(120,170,255,.6); background: transparent; color: var(--text-white, #fff); font: 0.64rem inherit; }
.ad-tag-add input::placeholder { color: rgba(170,200,255,.75); }
.ad-people { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 4px; }
.ad-person { display: grid; grid-template-columns: 26px 1fr; grid-template-rows: auto auto; column-gap: 6px; align-items: center; min-width: 0; }
.ad-initials { grid-row: 1 / 3; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--ad-type) 25%, #1a1d22); color: var(--text-white, #fff); font-size: .6rem; font-weight: 800; object-fit: cover; }
.ad-pname { font-size: 0.76rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ad-prole { font-size: 0.64rem; color: var(--text-gray, #9aa0a6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ad-insts { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 3px 10px; margin-top: 6px; }
.ad-inst { display: flex; flex-direction: column; min-width: 0; font-size: 0.72rem; }
.ad-inst span { font-size: 0.64rem; color: var(--text-gray, #9aa0a6); }
.ad-linked { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 3px; }
.ad-link-row { display: flex; flex-direction: column; padding: 4px 6px; border-radius: 6px; background: rgba(255,255,255,.03); color: inherit; text-decoration: none; font-size: 0.72rem; min-width: 0; }
.ad-link-row span { font-size: 0.64rem; color: var(--text-gray, #9aa0a6); }
.ad-link-row.go:hover { background: rgba(255,255,255,.08); }
.ad-link-row.go b::after { content: ' →'; color: var(--text-gray, #9aa0a6); }
.ad-cal { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.ad-cal li { display: grid; grid-template-columns: minmax(84px, max-content) 1fr auto; gap: 8px; align-items: baseline; padding: 3px 4px; border-radius: 5px; font-size: 0.72rem; }
.ad-cal li.mine { background: rgba(0,255,136,.06); }
.ad-cal li.recurring time { color: rgba(170,200,255,.9); }
.ad-cal li.past { opacity: .5; }
.ad-cal time { font-family: var(--font-market-data, inherit); font-weight: 700; font-size: 0.68rem; }
.ad-cal-type { font-size: 0.6rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-gray, #9aa0a6); }

.ad-jump {
  position: sticky; top: var(--nav-top-height, 3.25rem); z-index: 5; display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
  margin: 0 -6px; padding: 4px 6px; background: color-mix(in srgb, var(--bg-primary, #0b0d10) 88%, transparent); backdrop-filter: blur(8px);
}
.ad-jump::-webkit-scrollbar { display: none; }
.ad-jump a { flex-shrink: 0; padding: 0 9px; line-height: 24px; border-radius: 999px; border: 1px solid var(--border-primary, rgba(255,255,255,.12)); color: var(--text-light-gray, rgba(255,255,255,.8)); text-decoration: none; font-size: 0.68rem; }
.ad-jump a:hover { color: var(--text-white, #fff); border-color: rgba(255,255,255,.35); }
.ad-card { scroll-margin-top: calc(var(--nav-top-height, 3.25rem) + 38px); }
.ad-all summary { display: flex; align-items: baseline; gap: 8px; cursor: pointer; list-style: none; }
.ad-all summary::-webkit-details-marker { display: none; }
.ad-all summary h2 { margin: 0; }
.ad-all summary::after { content: '▾'; margin-left: auto; color: var(--text-gray, #9aa0a6); }
.ad-all[open] summary { margin-bottom: 6px; }
.ad-all[open] summary::after { content: '▴'; }

@media (min-width: 900px) {
  .ad { padding: 10px 14px 40px; gap: 8px; }
  .ad-name { font-size: 1.3rem; }
  .ad-price { font-size: 1.8rem; }
}
</style>
