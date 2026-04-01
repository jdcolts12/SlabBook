import type { PortfolioMetrics } from '../../lib/cardMetrics'

type Props = {
  metrics: PortfolioMetrics
  loading: boolean
  money: Intl.NumberFormat
  pct: Intl.NumberFormat
  sportsCount: number
  pokemonCount: number
}

export function DashboardQuickStats ({
  metrics,
  loading,
  money,
  pct,
  sportsCount,
  pokemonCount,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Invested</p>
        <p className="mt-1.5 text-lg font-semibold tabular-nums text-white sm:text-xl">
          {loading ? '—' : money.format(metrics.totalInvested)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">Total cost basis</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Est. range</p>
        <p className="mt-1.5 text-lg font-semibold tabular-nums text-white sm:text-xl">
          {loading ? (
            '—'
          ) : (
            <span className="block truncate text-base sm:text-lg">
              {money.format(metrics.totalValueLow)} – {money.format(metrics.totalValueHigh)}
            </span>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500">AI low / high band</p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Holdings</p>
        <p className="mt-1.5 text-lg font-semibold tabular-nums text-white sm:text-xl">
          {loading ? '—' : String(metrics.count)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {pokemonCount > 0
            ? `${sportsCount} sports · ${pokemonCount} Pokémon`
            : `${sportsCount} sports cards`}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-4 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Top mover</p>
        <p className="mt-1.5 truncate text-lg font-semibold text-white sm:text-xl">
          {loading || !metrics.bestPerformer ? '—' : metrics.bestPerformer.card.player_name}
        </p>
        <p
          className={[
            'mt-1 text-xs font-medium tabular-nums',
            metrics.bestPerformer && metrics.bestPerformer.gainPercent >= 0
              ? 'text-emerald-400/90'
              : 'text-amber-400/90',
          ].join(' ')}
        >
          {!loading && metrics.bestPerformer
            ? `${pct.format(metrics.bestPerformer.gainPercent / 100)} vs cost (sports)`
            : '—'}
        </p>
      </div>
    </div>
  )
}
