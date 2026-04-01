import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PortfolioMetrics } from '../../lib/cardMetrics'
import type { PortfolioTimelinePoint } from '../../lib/dashboardChartData'

type Props = {
  metrics: PortfolioMetrics
  timeline: PortfolioTimelinePoint[]
  loading: boolean
  money: Intl.NumberFormat
  pct: Intl.NumberFormat
}

export function DashboardPortfolioHero ({ metrics, timeline, loading, money, pct }: Props) {
  const gainPositive = metrics.gainLossDollars >= 0
  const gainPctStr =
    metrics.gainLossPercent != null ? pct.format(metrics.gainLossPercent / 100) : null
  const chartData = timeline.map((p) => ({
    label: p.label,
    value: p.value,
  }))

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-zinc-900/95 via-[#121212] to-[var(--color-surface-raised)] shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_24px_80px_rgba(0,0,0,0.45)]">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-slab-teal/[0.07] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-emerald-500/[0.04] blur-3xl"
        aria-hidden
      />

      <div className="relative px-5 pb-2 pt-6 sm:px-8 sm:pt-8">
        <p className="text-[13px] font-medium tracking-wide text-zinc-500">Portfolio value</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl md:text-[3.25rem]">
          {loading ? '—' : money.format(metrics.totalValue)}
        </p>
        {!loading && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={[
                'inline-flex items-center gap-1 text-sm font-semibold tabular-nums',
                gainPctStr != null
                  ? gainPositive
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-zinc-400',
              ].join(' ')}
            >
              {gainPctStr != null && <span aria-hidden>{gainPositive ? '▲' : '▼'}</span>}
              {gainPctStr != null ? `${gainPctStr} all time` : 'Add purchase prices to see % return'}
            </span>
            <span className="text-sm tabular-nums text-zinc-500">
              {gainPositive ? '+' : ''}
              {money.format(metrics.gainLossDollars)} vs invested
            </span>
          </div>
        )}
        <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-zinc-600">
          Chart uses current estimates, stepped by when each card was added — not intraday market data.
        </p>
      </div>

      <div className="relative h-[200px] w-full sm:h-[240px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">Loading chart…</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-zinc-500">No value data yet</p>
            <p className="max-w-xs text-xs text-zinc-600">
              Add cards and run estimates — your portfolio curve will show here.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="dashPortfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d9e75" stopOpacity={0.45} />
                  <stop offset="55%" stopColor="#1d9e75" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#1d9e75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                hide
                padding={{ top: 12, bottom: 4 }}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                contentStyle={{
                  background: '#141414',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                }}
                labelStyle={{ color: '#a1a1aa', fontSize: 11, marginBottom: 4 }}
                formatter={(value: number | string) => [money.format(Number(value)), 'Est. value']}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#5dcaa5"
                strokeWidth={2}
                fill="url(#dashPortfolioFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#5dcaa5', stroke: '#0a0a0a', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
