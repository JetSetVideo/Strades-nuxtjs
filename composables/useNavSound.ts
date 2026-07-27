// Module-level AudioContext singleton — shared across all nav components
let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (_ctx.state === 'suspended') _ctx.resume()
    return _ctx
  } catch { return null }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.07,
  startDelay = 0,
) {
  const ctx = getCtx()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g)
    g.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay)
    g.gain.setValueAtTime(0.0001, ctx.currentTime + startDelay)
    g.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + startDelay + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startDelay + duration)
    osc.start(ctx.currentTime + startDelay)
    osc.stop(ctx.currentTime + startDelay + duration + 0.01)
  } catch { /* silent fail */ }
}

export const useNavSound = () => {
  // Barely-there tick on hover — just tactile feel
  const playHover = () => tone(1400, 0.04, 'sine', 0.025)

  // Two-part click: thump + high chime
  const playClick = () => {
    tone(700, 0.05, 'sine', 0.09)
    tone(1300, 0.08, 'sine', 0.04, 0.03)
  }

  // Satisfying "arrived" chime when route becomes active
  const playActiveRoute = () => {
    tone(660, 0.12, 'triangle', 0.06)
    tone(880, 0.09, 'triangle', 0.04, 0.06)
  }

  // Soft back-navigation sound (descending)
  const playBack = () => {
    tone(880, 0.06, 'sine', 0.07)
    tone(660, 0.08, 'sine', 0.05, 0.04)
  }

  return { playHover, playClick, playActiveRoute, playBack }
}
