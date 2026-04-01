import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { AllocationSlice } from '../../lib/dashboardChartData'

type Props = {
  slices: AllocationSlice[]
  loading: boolean
  money: Intl.NumberFormat
}

export function DashboardAllocationCard ({ slices, loading, money }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-white">Allocation</h3>
      <p className="mt-0.5 text-xs text-zinc-500">By sport &amp; category (estimated value)</p>

      {loading ? (
        <div className="mt-8 flex h-[200px] items-center justify-center text-sm text-zinc-600">Loading…</div>
      ) : slices.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700/80 bg-zinc-950/40 px-4 py-10 text-center text-sm text-zinc-500">
          No value estimates yet — refresh values on your cards to see the breakdown.
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-6 md:flex-row md:items-center md:justify-between">
          <div className="h-[200px] w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | string) => money.format(Number(value))}
                  contentStyle={{
                    background: '#141414',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2.5">
            {slices.map((s) => {
              const total = slices.reduce((a, x) => a + x.value, 0)
              const pct = total > 0 ? (s.value / total) * 100 : 0
              return (
                <li key={s.name} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-zinc-200">{s.name}</span>
                      <span className="shrink-0 tabular-nums text-zinc-400">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums text-xs font-medium text-zinc-300 sm:text-sm">
                    {money.format(s.value)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
