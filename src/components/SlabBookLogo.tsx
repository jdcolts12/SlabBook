import type { ReactNode } from 'react'

export type SlabBookLogoSize = 'sm' | 'md' | 'lg'

type SlabBookLogoProps = {
  size?: SlabBookLogoSize
  /** Card + SB badge only; no wordmark */
  iconOnly?: boolean
  className?: string
}

const ICON_WIDTH: Record<SlabBookLogoSize, number> = {
  sm: 24,
  md: 36,
  lg: 48,
}

const WORDMARK_CLASS: Record<SlabBookLogoSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
}

const ASPECT = 40 / 32

function CardIcon ({
  widthPx,
  iconOnly,
}: {
  widthPx: number
  iconOnly: boolean
}) {
  const heightPx = Math.round(widthPx * ASPECT)

  return (
    <svg
      width={widthPx}
      height={heightPx}
      viewBox="0 0 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="cardTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B1F26" />
          <stop offset="100%" stopColor="#101217" />
        </linearGradient>
        <linearGradient id="cardBottom" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0E6852" />
          <stop offset="100%" stopColor="#1D9E75" />
        </linearGradient>
      </defs>

      {/* Back card: Michael Jordan */}
      <g transform="translate(1.5,4) rotate(-8 8.5 17.5)">
        <rect x="1" y="1" width="15" height="33" rx="2.5" fill="url(#cardTop)" stroke="#1D9E75" strokeWidth="1" />
        <rect x="2.5" y="2.5" width="12" height="15" rx="1.5" fill="#20242C" />
        <rect x="2.5" y="19.5" width="12" height="12.5" rx="1.5" fill="url(#cardBottom)" />
        <text x="8.5" y="27" textAnchor="middle" fill="#D9F6EA" style={{ fontSize: '3px', fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif', fontWeight: 700 }}>
          M.JORDAN
        </text>
      </g>

      {/* Middle card: Tom Brady */}
      <g transform="translate(8,2)">
        <rect x="1" y="1" width="15" height="33" rx="2.5" fill="url(#cardTop)" stroke="#1D9E75" strokeWidth="1" />
        <rect x="2.5" y="2.5" width="12" height="15" rx="1.5" fill="#232933" />
        <rect x="2.5" y="19.5" width="12" height="12.5" rx="1.5" fill="url(#cardBottom)" />
        <text x="8.5" y="27" textAnchor="middle" fill="#D9F6EA" style={{ fontSize: '3px', fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif', fontWeight: 700 }}>
          T.BRADY
        </text>
      </g>

      {/* Front card: Shohei Ohtani */}
      <g transform="translate(15.5,4) rotate(8 8.5 17.5)">
        <rect x="1" y="1" width="15" height="33" rx="2.5" fill="url(#cardTop)" stroke="#1D9E75" strokeWidth="1" />
        <rect x="2.5" y="2.5" width="12" height="15" rx="1.5" fill="#1F2630" />
        <rect x="2.5" y="19.5" width="12" height="12.5" rx="1.5" fill="url(#cardBottom)" />
        <text x="8.5" y="27" textAnchor="middle" fill="#D9F6EA" style={{ fontSize: '2.8px', fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif', fontWeight: 700 }}>
          OHTANI
        </text>
      </g>

      {iconOnly && (
        <rect x="22.5" y="1.5" width="8" height="4.5" rx="1.5" fill="#1D9E75" opacity="0.9" />
      )}
    </svg>
  )
}

export function SlabBookLogo ({ size = 'md', iconOnly = false, className = '' }: SlabBookLogoProps) {
  const w = ICON_WIDTH[size]
  const wordmark: ReactNode = iconOnly ? null : (
    <span
      className={[
        'font-medium tracking-tight',
        WORDMARK_CLASS[size],
      ].join(' ')}
    >
      <span className="text-[var(--slab-text,#F1EFE8)]">Slab</span>
      <span className="text-[var(--slab-teal,#1D9E75)]">Book</span>
    </span>
  )

  return (
    <div
      className={['inline-flex items-center gap-2.5', className].filter(Boolean).join(' ')}
      role={iconOnly ? 'img' : undefined}
      aria-label={iconOnly ? 'SlabBook' : undefined}
    >
      <CardIcon widthPx={w} iconOnly={iconOnly} />
      {wordmark}
    </div>
  )
}
