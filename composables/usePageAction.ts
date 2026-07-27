import { watch, onBeforeUnmount, getCurrentInstance } from 'vue'

export interface PageActionEvent {
  name: string
  ts: number
}

/**
 * Tiny cross-component event bus for top-bar → page actions.
 *
 * The top bar (Navigation/Top/ContextActions.vue) dispatches named actions
 * ("news:compose", "chat:new-message", …) and the active page subscribes
 * with onPageAction() to open its composer / modal.
 */
export function usePageAction() {
  const event = useState<PageActionEvent | null>('page-action', () => null)

  const dispatch = (name: string) => {
    event.value = { name, ts: Date.now() }
  }

  const onPageAction = (name: string, handler: () => void) => {
    const stop = watch(event, (e) => {
      if (e && e.name === name) handler()
    })
    if (getCurrentInstance()) onBeforeUnmount(stop)
    return stop
  }

  return { event, dispatch, onPageAction }
}
