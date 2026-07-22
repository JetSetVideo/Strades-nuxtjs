import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useTrainingStore, type TrainingEventType } from '~/stores/training'
import { useActivityLogStore, type ActivityCategory } from '~/stores/activityLog'

/**
 * useAgentTracker — the user-behavior funnel feeding the personal Avatar.
 *
 * Two ways to use:
 *   1. Imperative:  `const tracker = useAgentTracker(); tracker.track('asset_click', { id })`
 *   2. Declarative: pass a `target` Ref<HTMLElement> + an `auto` map; it wires
 *      mouseenter (dwell), click, and viewport-visible events for you.
 *
 * Every track() also journals a where/when/what/why entry into the activity log
 * (without double-feeding training — training.record remains the source of truth here).
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

const CATEGORY_FOR: Partial<Record<TrainingEventType, ActivityCategory>> = {
  article_dwell: 'content',
  article_political_view: 'content',
  allocation_change: 'trading',
  asset_click: 'content',
  asset_hover: 'content',
  strategy_deploy: 'trading',
  strategy_pause: 'trading',
  agent_compare: 'trading',
  agent_fork: 'trading',
  agent_plug: 'trading',
  page_route: 'navigation',
  chart_annotation: 'trading',
  prediction_set: 'trading',
  prediction_triggered: 'trading',
  asset_tag: 'content',
  chat_message_sent: 'social',
  friend_added: 'social',
  search_used: 'navigation',
  share_asset: 'share',
  share_opinion: 'share',
  share_strategy: 'share',
  share_article: 'share',
}

export function useAgentTracker(target?: Ref<HTMLElement | null>, auto?: TrackerAutoConfig): AgentTracker {
  const training = useTrainingStore()
  const activityLog = useActivityLogStore()

  const track = (type: TrainingEventType, payload: Record<string, any> = {}) => {
    training.record(type, payload)

    try {
      const page = (payload.page as string)
        ?? (import.meta.client ? window.location.pathname : '/')
      activityLog.log({
        where: { page, component: payload.component as string | undefined },
        what: {
          action: type,
          target: String(payload.id ?? payload.target ?? payload.asset_id ?? type),
          category: CATEGORY_FOR[type] ?? 'content',
        },
        why: {
          intent: (payload.intent as string) ?? type,
          context: { ...payload },
        },
        with: payload.recipient_ids || payload.friend_ids
          ? {
              friend_ids: (payload.recipient_ids ?? payload.friend_ids) as string[],
              conversation_id: payload.conversation_id as string | undefined,
            }
          : undefined,
        duration_ms: payload.dwell_ms as number | undefined,
        feedTraining: false,
      })
    } catch {
      /* activity log optional during early boot */
    }
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
