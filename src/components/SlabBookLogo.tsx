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
  const badgeLabel = iconOnly ? 'SB' : 'PSA'
  const fontSize = iconOnly ? 6.75 : 6

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
      <rect
        x="2"
        y="2"
        width="28"
        height="36"
        rx="4"
        fill="var(--slab-bg-card, #111111)"
        stroke="var(--slab-teal, #1D9E75)"
        strokeWidth="1.5"
      />
      <line
        x1="6.5"
        y1="10"
        x2="25.5"
        y2="10"
        stroke="var(--slab-teal, #1D9E75)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="6.5"
        y1="14.5"
        x2="19"
        y2="14.5"
        stroke="var(--slab-teal, #1D9E75)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="27.5" width="22" height="9" rx="1.5" fill="var(--slab-teal-dark, #0F6E56)" />
      <text
        x="16"
        y="34.2"
        textAnchor="middle"
        fill="var(--slab-teal-muted, #9FE1CB)"
        style={{
          fontSize: `${fontSize}px`,
          fontFamily: 'DM Sans, ui-sans-serif, system-ui, sans-serif',
          fontWeight: 600,
        }}
      >
        {badgeLabel}
      </text>
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
