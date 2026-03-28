/** Match server-side cache window in api/estimate-card-value.ts */
export const ESTIMATE_CACHE_MS = 48 * 60 * 60 * 1000

export function isEstimateStale (card: {
  current_value: number | null
  last_updated: string | null
}): boolean {
  if (card.current_value == null) return true
  if (!card.last_updated) return true
  const t = new Date(card.last_updated).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t >= ESTIMATE_CACHE_MS
}
