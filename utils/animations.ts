/**
 * Stop every Web Animation (CSS animations + transitions included) under a page root before
 * the page leaves the DOM.
 *
 * Why: an infinite CSS animation on an element whose removal was interrupted (a <Transition>
 * leave cut by a route change, a loading skeleton still pulsing) stays registered on the
 * document timeline: DocumentTimeline → CSSAnimation → element → __vueParentComponent →
 * the whole page (board-optimization O1). Cancelling them on unmount drops that retainer.
 */
export interface AnimationHost {
  getAnimations?: (opts?: { subtree?: boolean }) => Array<{ cancel: () => void }>
}

/** Cancels the animations of `el` and its subtree; returns how many were cancelled. */
export function cancelSubtreeAnimations(el: AnimationHost | null | undefined): number {
  if (!el || typeof el.getAnimations !== 'function') return 0
  let list: Array<{ cancel: () => void }>
  try {
    list = el.getAnimations({ subtree: true })
  } catch {
    return 0
  }
  let n = 0
  for (const a of list) {
    try { a.cancel(); n++ } catch { /* already finished / detached */ }
  }
  return n
}
