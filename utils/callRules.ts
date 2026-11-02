/**
 * Rules for the user's own price calls (PredictPanel).
 *
 *  - Confidence is the user's input, 1–5 (default 3). It used to be hard-coded 3.
 *  - A call can be withdrawn only while it is pending AND its target date is still
 *    ahead. A resolved call (accurate / missed / expired) is a record: it stays.
 *    A pending call past its target is awaiting resolution: withdrawing it then
 *    would let a user erase a miss they can already see, so it is locked too.
 */

export const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const
export const DEFAULT_CONFIDENCE = 3

export const CONFIDENCE_LABEL: Record<number, string> = {
  1: 'a hunch', 2: 'unsure', 3: 'fairly sure', 4: 'confident', 5: 'very confident',
}

export function clampConfidence(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return DEFAULT_CONFIDENCE
  return Math.min(5, Math.max(1, n))
}

export function canWithdrawCall(p: { status: string; targetTs?: number; targetDate?: string }, now = Date.now()): boolean {
  if (p.status !== 'pending') return false
  const target = typeof p.targetTs === 'number' && Number.isFinite(p.targetTs) ? p.targetTs : Date.parse(p.targetDate ?? '')
  return !Number.isFinite(target) || target > now
}

/** Why the ✕ is missing, for a title/aria text. */
export function lockedReason(p: { status: string; targetTs?: number; targetDate?: string }, now = Date.now()): string {
  if (p.status !== 'pending') return 'Resolved calls stay on your record.'
  return canWithdrawCall(p, now) ? '' : 'Past its target date: waiting for the result, it can no longer be withdrawn.'
}
