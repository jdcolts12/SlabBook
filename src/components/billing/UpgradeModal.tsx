import { Link } from 'react-router-dom'

type Props = {
  open: boolean
  title?: string
  body: string
  ctaLabel?: string
  onCta: () => void
  onClose: () => void
  ctaLoading?: boolean
}

export function UpgradeModal ({
  open,
  title = 'Upgrade to Collector',
  body,
  ctaLabel = 'Upgrade for $5/mo',
  onCta,
  onClose,
  ctaLoading = false,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-6 shadow-2xl"
      >
        <h2 id="upgrade-modal-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-600 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            onClick={onClose}
          >
            View all plans
          </Link>
          <button
            type="button"
            disabled={ctaLoading}
            onClick={() => onCta()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slab-teal px-5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light disabled:opacity-50"
          >
            {ctaLoading ? '…' : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
