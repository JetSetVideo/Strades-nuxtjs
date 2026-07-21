/**
 * useBacktest — Monte Carlo strategy backtesting engine
 *
 * Evaluates strategy conditions against synthetic price paths driven by
 * real asset volatility, then aggregates P&L, risk metrics, and trade logs.
 * Supports multi-asset portfolios and supply-chain / counterparty risk factors.
 */
import { ref, computed } from 'vue'
import { useAssetsStore } from '@/stores/assets'
import { useMacroStore } from '@/stores/macro'
import { useWalletStore } from '@/stores/wallet'

// ─── Public types ────────────────────────────────────────────────────────────

export interface BacktestConfig {
  id: string
  name: string
  conditions: BacktestCondition[]
  variables: {
    stop_loss_percent: number
    take_profit_percent: number
    position_size: number // % of capital per trade
  }
  targetAssets: string[]
  initialCapital: number
  frequency: string
  period: { start: string; end: string }
  /** Optional supply-chain risk overlay */
  counterpartyRiskFactor?: number // 0–1
  commodityCorrelation?: number  // -1 to 1
}

export interface BacktestCondition {
  datasource: string
  asset: string
  operator: string
  value: string | number
  timeframe: string
}

export interface TradeRecord {
  date: string
  asset: string
  side: 'long' | 'short' | 'exit'
  entryPrice: number
  exitPrice: number
  quantity: number
  pnl: number
  pnlPct: number
  reason: string
}

export interface EquityPoint {
  date: string
  equity: number
  drawdown: number
  drawdownPct: number
}

export interface BacktestMetrics {
  totalReturn: number
  totalReturnPct: number
  annualReturn: number
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  maxDrawdownPct: number
  winRate: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  alpha: number
  beta: number
  correlation: number
  calmarRatio: number
}

export interface BacktestResult {
  id: string
  name: string
  metrics: BacktestMetrics
  equityCurve: EquityPoint[]
  trades: TradeRecord[]
  config: BacktestConfig
  simulatedAt: string
}

// ─── Seeded PRNG ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  ))
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ─── Core engine ─────────────────────────────────────────────────────────────

export function useBacktest() {
  const running = ref(false)
  const progress = ref(0)
  const lastResult = ref<BacktestResult | null>(null)
  const assetsStore = useAssetsStore()
  const macroStore = useMacroStore()
  const walletStore = useWalletStore()

  /** Build synthetic price history using GBM (Geometric Brownian Motion) */
  function generatePricePath(
    basePrice: number,
    annualVol: number,
    days: number,
    seed: number,
    drift: number = 0
  ): number[] {
    const rng = mulberry32(seed)
    const dt = 1 / 252
    const sigma = annualVol / Math.sqrt(252) // daily vol
    const mu = drift / 252
    const prices: number[] = [basePrice]

    for (let i = 1; i < days; i++) {
      const z = (rng() + rng() + rng() - 1.5) * 1.15 // Box-Muller approx
      const ret = mu * dt + sigma * Math.sqrt(dt) * z
      const next = prices[i - 1] * Math.exp(Math.max(-0.15, Math.min(0.15, ret)))
      prices.push(Math.max(0.01, next))
    }
    return prices
  }

  /** Compute MA (moving average) for a price series */
  function ma(prices: number[], period: number): (number | null)[] {
    return prices.map((_, i) => {
      if (i < period - 1) return null
      let sum = 0
      for (let j = 0; j < period; j++) sum += prices[i - j]
      return sum / period
    })
  }

  /** Evaluate a single condition against a price bar */
  function evalCondition(
    cond: BacktestCondition,
    prices: number[],
    idx: number,
    indicators: Record<string, (number | null)[]>
  ): boolean {
    const price = prices[idx]
    if (idx === 0) return false

    const prevPrice = prices[idx - 1]
    const numericVal = typeof cond.value === 'number' ? cond.value : Number(cond.value)

    switch (cond.operator) {
      case '>':           return price > numericVal
      case '<':           return price < numericVal
      case '>=':          return price >= numericVal
      case '<=':          return price <= numericVal
      case 'cross_above':
      case 'cross_over':
        return prevPrice <= numericVal && price > numericVal
      case 'cross_below':
        return prevPrice >= numericVal && price < numericVal
      default:
        return false
    }
  }

  /** Run a single Monte Carlo simulation path */
  function simulatePath(
    config: BacktestConfig,
    prices: number[],
    dates: string[],
    days: number,
    stopLoss: number,
    takeProfit: number
  ): { trades: TradeRecord[]; equity: number[] } {
    const trades: TradeRecord[] = []
    const equity: number[] = [config.initialCapital]
    let capital = config.initialCapital
    let position: { entryPrice: number; side: 'long' | 'short'; qty: number; entryIdx: number } | null = null

    // Pre-compute indicators
    const ma50 = ma(prices, 50)
    const ma200 = ma(prices, 200)
    const rsi14 = prices.map((p, i) => {
      if (i < 14) return null
      let gains = 0, losses = 0
      for (let j = i - 13; j <= i; j++) {
        const delta = prices[j] - prices[j - 1]
        if (delta > 0) gains += delta
        else losses -= delta
      }
      const avgGain = gains / 14, avgLoss = losses / 14
      if (avgLoss === 0) return 100
      return 100 - 100 / (1 + avgGain / avgLoss)
    })

    const indicatorMap: Record<string, (number | null)[]> = {
      MA50: ma50,
      MA200: ma200,
      RSI14: rsi14,
    }

    for (let i = 0; i < days; i++) {
      const price = prices[i]
      const date = dates[i]

      // Check exit conditions if in position
      if (position) {
        const pnlPct = (price - position.entryPrice) / position.entryPrice * position.side === 'long' ? 1 : -1
        const actualPnlPct = position.side === 'long'
          ? (price - position.entryPrice) / position.entryPrice
          : (position.entryPrice - price) / position.entryPrice

        let exitReason: string | null = null

        // Stop loss
        if (actualPnlPct <= -stopLoss / 100) exitReason = 'stop_loss'
        // Take profit
        if (actualPnlPct >= takeProfit / 100) exitReason = 'take_profit'

        // Condition-based exit
        for (const cond of config.conditions) {
          if (cond.operator.startsWith('cross_') && cond.datasource === 'price') {
            const signal = evalCondition(cond, prices, i, indicatorMap)
            if (signal) exitReason = `signal:${cond.operator}`
          }
        }

        if (exitReason) {
          const qty = position.qty
          const pnl = position.side === 'long'
            ? (price - position.entryPrice) * qty
            : (position.entryPrice - price) * qty
          trades.push({
            date,
            asset: config.targetAssets[0],
            side: 'exit',
            entryPrice: position.entryPrice,
            exitPrice: price,
            quantity: qty,
            pnl,
            pnlPct: (price - position.entryPrice) / position.entryPrice * 100,
            reason: exitReason,
          })
          capital += position.qty * position.entryPrice + pnl
          position = null
        }
      }

      // Check entry conditions if not in position
      if (!position) {
        let shouldEnter = false
        for (const cond of config.conditions) {
          if (['>', '<', 'cross_above', 'cross_over', 'cross_below'].includes(cond.operator)) {
            if (evalCondition(cond, prices, i, indicatorMap)) {
              shouldEnter = true
              break
            }
          }
        }

        if (shouldEnter) {
          const alloc = config.variables.position_size / 100
          const qty = (capital * alloc) / price
          trades.push({
            date,
            asset: config.targetAssets[0],
            side: 'long',
            entryPrice: price,
            exitPrice: 0,
            quantity: qty,
            pnl: 0,
            pnlPct: 0,
            reason: 'entry_signal',
          })
          position = { entryPrice: price, side: 'long', qty, entryIdx: i }
        }
      }

      // Mark equity
      const posValue = position
        ? position.qty * price
        : 0
      equity.push(capital + posValue)
    }

    // Close any open position at end
    if (position) {
      const lastPrice = prices[days - 1]
      const pnl = (lastPrice - position.entryPrice) * position.qty
      trades.push({
        date: dates[days - 1],
        asset: config.targetAssets[0],
        side: 'exit',
        entryPrice: position.entryPrice,
        exitPrice: lastPrice,
        quantity: position.qty,
        pnl,
        pnlPct: (lastPrice - position.entryPrice) / position.entryPrice * 100,
        reason: 'end_of_period',
      })
      capital += position.qty * position.entryPrice + pnl
    }

    return { trades, equity }
  }

  /** Compute risk-adjusted metrics from equity curve and trades */
  function computeMetrics(
    equity: number[],
    trades: TradeRecord[],
    initialCapital: number,
    days: number,
    rf: number = 0.05
  ): BacktestMetrics {
    const totalReturn = equity[equity.length - 1] - initialCapital
    const totalReturnPct = totalReturn / initialCapital * 100
    const annFactor = 252 / Math.max(1, days)
    const annualReturn = totalReturnPct * annFactor

    // Daily returns
    const dailyReturns: number[] = []
    for (let i = 1; i < equity.length; i++) {
      dailyReturns.push(equity[i] / equity[i - 1] - 1)
    }

    const meanRet = dailyReturns.reduce((a, b) => a + b, 0) / Math.max(1, dailyReturns.length)
    const variance = dailyReturns.reduce((a, b) => a + (b - meanRet) ** 2, 0) / Math.max(1, dailyReturns.length)
    const vol = Math.sqrt(variance * 252) * 100
    const annualMean = meanRet * 252

    const sharpeRatio = vol > 0 ? (annualMean - rf) / (vol / 100) : 0

    // Sortino: downside deviation only
    const negReturns = dailyReturns.filter(r => r < 0)
    const downVariance = negReturns.length > 0
      ? negReturns.reduce((a, b) => a + b ** 2, 0) / negReturns.length
      : 0
    const downVol = Math.sqrt(downVariance * 252) * 100
    const sortinoRatio = downVol > 0 ? (annualMean - rf) / (downVol / 100) : 0

    // Max drawdown
    let peak = equity[0]
    let maxDd = 0
    let maxDdPct = 0
    for (const e of equity) {
      if (e > peak) peak = e
      const dd = peak - e
      const ddPct = (peak - e) / peak * 100
      if (dd > maxDd) { maxDd = dd; maxDdPct = ddPct }
    }

    // Trade stats
    const winning = trades.filter(t => t.pnl > 0)
    const losing = trades.filter(t => t.pnl < 0)
    const totalTrades = trades.length
    const winRate = totalTrades > 0 ? (winning.length / totalTrades) * 100 : 0
    const avgWin = winning.length > 0
      ? winning.reduce((a, t) => a + t.pnl, 0) / winning.length
      : 0
    const avgLoss = losing.length > 0
      ? Math.abs(losing.reduce((a, t) => a + t.pnl, 0) / losing.length)
      : 0
    const profitFactor = avgLoss > 0 ? (avgWin * winning.length) / (avgLoss * losing.length) : winning.length > 0 ? Infinity : 0

    // Calmar = annual return / max drawdown
    const calmarRatio = maxDdPct > 0 ? annualReturn / maxDdPct : 0

    return {
      totalReturn,
      totalReturnPct,
      annualReturn,
      volatility: vol,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown: maxDd,
      maxDrawdownPct: maxDdPct,
      winRate,
      totalTrades,
      winningTrades: winning.length,
      losingTrades: losing.length,
      avgWin,
      avgLoss,
      profitFactor,
      alpha: 0,
      beta: 0,
      correlation: 0,
      calmarRatio,
    }
  }

  /** Main entry: run N Monte Carlo simulations and aggregate */
  async function runBacktest(config: BacktestConfig, simulations: number = 500): Promise<BacktestResult> {
    running.value = true
    progress.value = 0

    const days = daysBetween(config.period.start, config.period.end)
    const dates: string[] = []
    const cursor = new Date(config.period.start)
    for (let i = 0; i < days; i++) {
      dates.push(fmtDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    // Get real asset data for volatility
    const macroState = macroStore.macroState
    const assetData = config.targetAssets.map(id => assetsStore.getAssetBySymbol(id) || assetsStore.getAssetById(id))
    const basePrices = assetData.map(a => a?.current_price ?? 100)
    const classVolByAsset: Record<string, number> = {
      btc: macroState?.volatility_by_class?.crypto ?? 0.6,
      eth: macroState?.volatility_by_class?.crypto ?? 0.6,
      sol: macroState?.volatility_by_class?.crypto ?? 0.6,
      usd: macroState?.volatility_by_class?.fiat ?? 0.05,
      eur: macroState?.volatility_by_class?.fiat ?? 0.05,
      appl: macroState?.volatility_by_class?.stocks ?? 0.3,
      amzn: macroState?.volatility_by_class?.stocks ?? 0.3,
      tsla: macroState?.volatility_by_class?.stocks ?? 0.35,
    }
    const assetVol = (assetData[0]?.symbol?.toLowerCase() ?? 'btc')
    const annualVol = classVolByAsset[assetVol] ?? 0.5

    // Apply counterparty risk as a volatility multiplier
    const volMultiplier = 1 + (config.counterpartyRiskFactor ?? 0) * 0.3
    const effectiveVol = annualVol * volMultiplier

    const stopLoss = config.variables.stop_loss_percent || 5
    const takeProfit = config.variables.take_profit_percent || 15

    // Batch of Monte Carlo runs
    const allTrades: TradeRecord[][] = []
    const allFinalEquities: number[] = []
    const allEquities: number[][] = []

    const batchSize = Math.min(50, simulations)
    for (let batch = 0; batch < simulations; batch += batchSize) {
      const batchResults = await new Promise<{ trades: TradeRecord[]; equity: number[] }[]>((resolve) => {
        // Use setTimeout to yield to UI between batches
        setTimeout(() => {
          const results = []
          for (let s = 0; s < batchSize && batch + s < simulations; s++) {
            const basePrice = basePrices[0] || 100
            const drift = (macroState?.market_sentiment ?? 0) * 0.15
            const path = generatePricePath(basePrice, effectiveVol, days, batch + s * 7919, drift)
            const result = simulatePath(config, path, dates, days, stopLoss, takeProfit)
            results.push(result)
          }
          resolve(results)
        }, 0)
      })

      for (const r of batchResults) {
        allTrades.push(r.trades)
        allEquities.push(r.equity)
        allFinalEquities.push(r.equity[r.equity.length - 1])
      }

      progress.value = Math.round(((batch + batchSize) / simulations) * 100)
    }

    // Aggregate: use median-path equity curve
    const sortedIdx = allFinalEquities
      .map((e, i) => ({ e, i }))
      .sort((a, b) => a.e - b.e)
    const medianIdx = sortedIdx[Math.floor(sortedIdx.length / 2)].i

    const medianEquity = allEquities[medianIdx]
    const medianTrades = allTrades[medianIdx]
    const metrics = computeMetrics(medianEquity, medianTrades, config.initialCapital, days)

    // Build equity curve
    const equityCurve: EquityPoint[] = medianEquity.map((e, i) => ({
      date: dates[i] ?? fmtDate(new Date(config.period.start)),
      equity: Math.round(e * 100) / 100,
      drawdown: 0,
      drawdownPct: 0,
    }))

    // Compute drawdown for equity curve
    let peak = equityCurve[0].equity
    for (const pt of equityCurve) {
      if (pt.equity > peak) peak = pt.equity
      pt.drawdown = peak - pt.equity
      pt.drawdownPct = peak > 0 ? (peak - pt.equity) / peak * 100 : 0
    }

    const result: BacktestResult = {
      id: config.id,
      name: config.name,
      metrics,
      equityCurve,
      trades: medianTrades,
      config,
      simulatedAt: new Date().toISOString(),
    }

    lastResult.value = result
    running.value = false
    progress.value = 100
    return result
  }

  return {
    running,
    progress,
    lastResult,
    runBacktest,
    generatePricePath,
    computeMetrics,
  }
}
