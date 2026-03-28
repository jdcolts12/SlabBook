import type { ReactNode } from 'react'
import type { PortfolioMetrics } from '../../lib/cardMetrics'

type Props = {
  metrics: PortfolioMetrics
  loading?: boolean
  money: Intl.NumberFormat
  pct: Intl.NumberFormat
}

function Stat ({
  label,
  children,
  sub,
}: {
  label: string
  children: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-1 min-w-0 truncate text-lg font-semibold tabular-nums text-white sm:text-xl">{children}</div>
      {sub ? <p className="mt-0.5 truncate text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function PortfolioSummaryBar ({ metrics, loading, money, pct }: Props) {
  const gainPositive = metrics.gainLossDollars >= 0
  const gainPctStr =
    metrics.gainLossPercent != null ? pct.format(metrics.gainLossPercent / 100) : '—'

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-3">
        <Stat
          label="Collection value"
          sub={
            loading ? undefined : (
              <span className="tabular-nums">
                Range {money.format(metrics.totalValueLow)} — {money.format(metrics.totalValueHigh)}
              </span>
            )
          }
        >
          {loading ? '—' : money.format(metrics.totalValue)}
        </Stat>
        <Stat label="Total invested">{loading ? '—' : money.format(metrics.totalInvested)}</Stat>
        <Stat
          label="Gain / loss"
          sub={
            metrics.gainLossPercent != null ? (
              <span className={gainPositive ? 'text-slab-teal/90' : 'text-red-400/90'}>
                {gainPctStr} portfolio
              </span>
            ) : (
              <span>Add cost & value for %</span>
            )
          }
        >
          {loading ? (
            '—'
          ) : (
            <span
              className={[
                'tabular-nums',
                gainPositive ? 'text-slab-teal' : 'text-red-400',
              ].join(' ')}
            >
              {money.format(metrics.gainLossDollars)}
            </span>
          )}
        </Stat>
        <Stat label="Cards tracked">{loading ? '—' : String(metrics.count)}</Stat>
        <Stat
          label="Best performer"
          sub={
            metrics.bestPerformer ? (
              <span
                className={
                  metrics.bestPerformer.gainPercent >= 0 ? 'text-slab-teal/90' : 'text-amber-400/90'
                }
              >
                {pct.format(metrics.bestPerformer.gainPercent / 100)} vs cost
              </span>
            ) : (
              <span>Needs paid + value</span>
            )
          }
        >
          {loading ? (
            '—'
          ) : metrics.bestPerformer ? (
            <span className="truncate text-zinc-100" title={metrics.bestPerformer.card.player_name}>
              {metrics.bestPerformer.card.player_name}
            </span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
        </Stat>
      </div>
    </div>
  )
}
