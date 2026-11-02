/**
 * Long lists render a first page, then grow on "Show more" (pages/predict.vue).
 * Every row stays reachable: the button says how many are left and "Show all" ends the paging.
 */
export const LIST_PAGE = 50

/** The rows to render: the first `shown` of `list`. */
export function listWindow<T>(list: readonly T[], shown: number): T[] {
  return list.slice(0, Math.max(0, Math.floor(shown)))
}

/** How many to show after one "Show more" click (never past the end). */
export function nextShown(shown: number, total: number, step = LIST_PAGE): number {
  return Math.min(Math.max(0, total), Math.max(0, shown) + step)
}

/** Rows not rendered yet. */
export function hiddenCount(shown: number, total: number): number {
  return Math.max(0, total - Math.max(0, shown))
}
