import type { SortKey } from '../../lib/cardMetrics'

export type GradeFilter = 'all' | 'graded' | 'raw'
export type ViewMode = 'table' | 'grid'

type Props = {
  sortBy: SortKey
  onSortChange: (v: SortKey) => void
  sport: string
  onSportChange: (v: string) => void
  sportOptions: string[]
  gradeFilter: GradeFilter
  onGradeFilterChange: (v: GradeFilter) => void
  gradingCompany: string
  onGradingCompanyChange: (v: string) => void
  gradingCompanyOptions: string[]
  viewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
}

const selectCls =
  'rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-slab-teal/50 focus:ring-1 focus:ring-slab-teal/30'

export function CollectionToolbar ({
  sortBy,
  onSortChange,
  sport,
  onSportChange,
  sportOptions,
  gradeFilter,
  onGradeFilterChange,
  gradingCompany,
  onGradingCompanyChange,
  gradingCompanyOptions,
  viewMode,
  onViewModeChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">View</span>
        <div className="inline-flex rounded-lg border border-[var(--color-border-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              viewMode === 'table'
                ? 'bg-slab-teal/20 text-slab-teal-muted'
                : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              viewMode === 'grid'
                ? 'bg-slab-teal/20 text-slab-teal-muted'
                : 'text-zinc-400 hover:text-zinc-200',
            ].join(' ')}
          >
            Grid
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Sort by</span>
          <select
            className={selectCls}
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
          >
            <option value="value">Value (high → low)</option>
            <option value="gain_pct">Gain % (high → low)</option>
            <option value="player">Player name (A–Z)</option>
            <option value="date_added">Date added (newest)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Sport</span>
          <select className={selectCls} value={sport} onChange={(e) => onSportChange(e.target.value)}>
            <option value="all">All sports</option>
            {sportOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Card type</span>
          <select
            className={selectCls}
            value={gradeFilter}
            onChange={(e) => onGradeFilterChange(e.target.value as GradeFilter)}
          >
            <option value="all">All</option>
            <option value="graded">Graded only</option>
            <option value="raw">Raw only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-500">Grading company</span>
          <select
            className={selectCls}
            value={gradingCompany}
            onChange={(e) => onGradingCompanyChange(e.target.value)}
            disabled={gradeFilter === 'raw'}
          >
            <option value="all">All companies</option>
            {gradingCompanyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
