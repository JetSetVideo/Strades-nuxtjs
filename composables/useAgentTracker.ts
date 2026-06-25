import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useTrainingStore, type TrainingEventType } from '~/stores/training'

/**
 * useAgentTracker — the user-behavior funnel feeding the personal Avatar.
 *
 * Two ways to use:
 *   1. Imperative:  `const tracker = useAgentTracker(); tracker.track('asset_click', { id })`
 *   2. Declarative: pass a `target` Ref<HTMLElement> + an `auto` map; it wires
 *      mouseenter (dwell), click, and viewport-visible events for you.
 */
export interface TrackerAutoConfig {
  click?: { type: TrainingEventType; payload?: Record<string, any> }
  dwell?: { type: TrainingEventType; minMs?: number; payload?: Record<string, any> }
  hover?: { type: TrainingEventType; payload?: Record<string, any> }
}

export interface AgentTracker {
  track: (type: TrainingEventType, payload?: Record<string, any>) => void
  bindElement: (el: HTMLElement | null, cfg: TrackerAutoConfig) => () => void
}

export function useAgentTracker(target?: Ref<HTMLElement | null>, auto?: TrackerAutoConfig): AgentTracker {
  const training = useTrainingStore()

  const track = (type: TrainingEventType, payload: Record<string, any> = {}) => {
    training.record(type, payload)
  }

  const bindElement = (el: HTMLElement | null, cfg: TrackerAutoConfig): (() => void) => {
    if (!el) return () => {}

    const cleanups: Array<() => void> = []

    if (cfg.click) {
      const onClick = () => track(cfg.click!.type, cfg.click!.payload ?? {})
      el.addEventListener('click', onClick)
      cleanups.push(() => el.removeEventListener('click', onClick))
    }

    if (cfg.hover) {
      const onEnter = () => track(cfg.hover!.type, cfg.hover!.payload ?? {})
      el.addEventListener('mouseenter', onEnter)
      cleanups.push(() => el.removeEventListener('mouseenter', onEnter))
    }

    if (cfg.dwell) {
      let dwellStart = 0
      const minMs = cfg.dwell.minMs ?? 500
      const onEnter = () => { dwellStart = performance.now() }
      const onLeave = () => {
        if (dwellStart === 0) return
        const dwell_ms = performance.now() - dwellStart
        dwellStart = 0
        if (dwell_ms >= minMs) {
          track(cfg.dwell!.type, { ...(cfg.dwell!.payload ?? {}), dwell_ms })
        }
      }
      el.addEventListener('mouseenter', onEnter)
      el.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        el.removeEventListener('mouseenter', onEnter)
        el.removeEventListener('mouseleave', onLeave)
      })
    }

    return () => cleanups.forEach(fn => fn())
  }

  // Declarative wiring: only if both target ref and auto config passed
  if (target && auto) {
    let unbind: (() => void) | null = null
    onMounted(() => {
      unbind = bindElement(target.value, auto)
    })
    onBeforeUnmount(() => unbind?.())
  }

  return { track, bindElement }
}
