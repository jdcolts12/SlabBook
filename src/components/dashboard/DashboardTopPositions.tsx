import type { Card } from '../../types/card'

type Props = {
  cards: Card[]
  loading: boolean
  money: Intl.NumberFormat
  max?: number
}

/** Sports cards only — largest estimated values (Robinhood “positions” style). */
export function DashboardTopPositions ({ cards, loading, money, max = 6 }: Props) {
  const ranked = [...cards]
    .filter((c) => c.current_value != null && Number(c.current_value) > 0)
    .sort((a, b) => Number(b.current_value) - Number(a.current_value))
    .slice(0, max)

  const top = ranked[0] ? Number(ranked[0].current_value) : 0

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-white">Largest positions</h3>
      <p className="mt-0.5 text-xs text-zinc-500">Sports cards by estimated value</p>

      {loading ? (
        <div className="mt-8 py-10 text-center text-sm text-zinc-600">Loading…</div>
      ) : ranked.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
          Add estimates to your sports cards to rank positions here.
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {ranked.map((c) => {
            const v = Number(c.current_value)
            const w = top > 0 ? Math.max(8, (v / top) * 100) : 0
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-zinc-200">{c.player_name}</span>
                  <span className="shrink-0 tabular-nums text-sm font-semibold text-emerald-400/95">
                    {money.format(v)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/90">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slab-teal/90 to-emerald-400/80"
                    style={{ width: `${w}%` }}
                  />
                </div>
                <p className="mt-1 truncate text-[11px] text-zinc-600">
                  {[c.sport, c.set_name].filter(Boolean).join(' · ') || 'Card'}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
