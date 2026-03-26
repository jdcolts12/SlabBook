type LogoProps = {
  className?: string
  compact?: boolean
}

export function Logo ({ className = '', compact = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400/20 to-teal-500/10 ring-1 ring-emerald-400/25"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-emerald-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" strokeLinecap="round" />
        </svg>
      </div>
      {!compact && (
        <span className="text-lg font-semibold tracking-tight text-white">
          Slab<span className="text-emerald-400">Book</span>
        </span>
      )}
    </div>
  )
}
