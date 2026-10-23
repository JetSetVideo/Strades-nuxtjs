/**
 * Candles for one asset over a time window, the same way on every page.
 *
 *  - live market with ≤ 48 h asked: the hourly closes the quotes feed already sent
 *  - live market, longer window: real Binance candles via /api/market/history
 *  - no market data: a seeded simulated path (stable per asset), flagged `sim`
 *
 * Real data that doesn't reach far enough back is continued by the simulated
 * path, joined without a jump, so the chart always fills its window.
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { Asset } from '~/types/asset'
import { publicAssetUrl } from '~/composables/useLocalJson'
import {
  HOUR, pickInterval, stitchCandles, candlesFromHourlyCloses, closesFromReturns,
  priceKindOf, volIndexOf, type Candle, type SimSpec,
} from '~/utils/assetChart'

/** One clock for every chart, ticking each minute (client only). */
export const chartNow = ref(Date.now())
let clockStarted = false
function startClock() {
  if (clockStarted || typeof window === 'undefined') return
  clockStarted = true
  chartNow.value = Date.now()
  setInterval(() => { chartNow.value = Date.now() }, 60_000)
}

type HistoryRow = { t: number; o: number; h: number; l: number; c: number }
const HISTORY = new Map<string, { at: number; candles: Candle[]; promise?: Promise<void> }>()
const historyTick = ref(0)

function loadHistory(symbol: string, interval: string, limit: number) {
  const key = `${symbol}|${interval}|${limit}`
  const hit = HISTORY.get(key)
  if (hit && (hit.promise || Date.now() - hit.at < 5 * 60_000)) return
  const entry = { at: Date.now(), candles: hit?.candles ?? [], promise: undefined as Promise<void> | undefined }
  entry.promise = $fetch<{ candles: HistoryRow[] }>(publicAssetUrl('/api/market/history'), {
    query: { symbol, interval, limit },
  })
    .then((r) => { entry.candles = (r.candles ?? []).map(c => ({ ...c })) })
    .catch(() => { /* keep the simulated path */ })
    .finally(() => { entry.promise = undefined; entry.at = Date.now(); historyTick.value++ })
  HISTORY.set(key, entry)
}

export interface SeriesWindow {
  /** first instant shown, epoch ms */
  start: number
  /** at most this many candles */
  maxCandles?: number
}

export function simSpecOf(asset: Asset | null | undefined, change24hPct?: number): SimSpec | null {
  if (!asset) return null
  return {
    key: String(asset.symbol || asset.id),
    volIndex: volIndexOf(asset as any),
    current: Number(asset.current_price) || 0,
    kind: priceKindOf(asset),
    // the simulated path agrees with the 24h move shown next to it; where real
    // candles exist they replace the simulated part anyway
    change24hPct: change24hPct ?? asset.change_24h_pct,
  }
}

export function useAssetSeries(
  asset: Ref<Asset | null | undefined>,
  win: Ref<SeriesWindow>,
  change24hPct?: Ref<number | undefined>,
) {
  startClock()

  const spanHours = computed(() => Math.max(1, (chartNow.value - win.value.start) / HOUR))
  const interval = computed(() => pickInterval(spanHours.value, win.value.maxCandles ?? 48))

  /** Binance only knows the symbols in the quotes route; the backend's own quotes have no history. */
  const fetchable = computed(() => !!asset.value?.live && asset.value.live.pair !== 'strades-api')
  const limit = computed(() => Math.ceil(spanHours.value / interval.value.hours) + 2)
  const useReturns = computed(() => !!asset.value?.return_history?.length && spanHours.value <= (asset.value?.return_history?.length ?? 0))

  watch([() => asset.value?.symbol, interval, limit, fetchable, useReturns], () => {
    if (!import.meta.client || !asset.value?.symbol || !fetchable.value || useReturns.value) return
    loadHistory(asset.value.symbol.toUpperCase(), interval.value.id, limit.value)
  }, { immediate: true })

  const candles = computed<Candle[]>(() => {
    void historyTick.value
    const a = asset.value
    const spec = simSpecOf(a, change24hPct?.value)
    if (!a || !spec || !(spec.current > 0)) return []
    const now = chartNow.value
    let real: Candle[] = []
    if (useReturns.value) {
      real = candlesFromHourlyCloses(closesFromReturns(spec.current, a.return_history!), now, interval.value.hours)
    } else if (fetchable.value) {
      real = HISTORY.get(`${a.symbol.toUpperCase()}|${interval.value.id}|${limit.value}`)?.candles ?? []
      // the last candle closes at the price shown on the card
      if (real.length) {
        const last = real[real.length - 1]!
        real = [...real.slice(0, -1), { ...last, c: spec.current, h: Math.max(last.h, spec.current), l: Math.min(last.l, spec.current) }]
      }
    }
    return stitchCandles(real, spec, now, win.value.start, interval.value.hours)
  })

  const simulated = computed(() => candles.value.some(c => c.sim))
  const allSimulated = computed(() => candles.value.length > 0 && candles.value.every(c => c.sim))
  /** first real candle time when the window mixes simulated and real data */
  const realFrom = computed(() => {
    const first = candles.value.find(c => !c.sim)
    return simulated.value && first ? first.t : null
  })

  return { candles, interval, simulated, allSimulated, realFrom, now: chartNow }
}
