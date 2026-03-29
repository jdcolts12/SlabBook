import type { ReactNode } from 'react'

export type SlabBookLogoSize = 'sm' | 'md' | 'lg'

type SlabBookLogoProps = {
  size?: SlabBookLogoSize
  /** Mark only; no wordmark */
  iconOnly?: boolean
  className?: string
}

const ICON_WIDTH: Record<SlabBookLogoSize, number> = {
  sm: 26,
  md: 36,
  lg: 48,
}

const WORDMARK_CLASS: Record<SlabBookLogoSize, string> = {
  sm: 'text-[15px] leading-none',
  md: 'text-lg leading-none',
  lg: 'text-2xl leading-none',
}

const ASPECT = 40 / 32

/**
 * Minimal slab mark: graded case + teal strip + inner “card” + subtle value line.
 * Reads clearly at 24–48px without micro typography.
 */
function SlabMark ({ widthPx }: { widthPx: number }) {
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
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="slabLogoTeal" x1="16" y1="5" x2="16" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4A8" />
          <stop offset="1" stopColor="#1D9E75" />
        </linearGradient>
        <linearGradient id="slabLogoCase" x1="8" y1="4" x2="26" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2E3540" />
          <stop offset="1" stopColor="#14171C" />
        </linearGradient>
        <linearGradient id="slabLogoShine" x1="8" y1="4" x2="20" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Back plane (depth) */}
      <rect
        x="5.5"
        y="6"
        width="21"
        height="29"
        rx="3.5"
        fill="#1A1E26"
        opacity="0.55"
        transform="rotate(-5 16 20.5)"
      />

      {/* Outer case */}
      <rect
        x="5"
        y="4"
        width="22"
        height="31"
        rx="4"
        fill="url(#slabLogoCase)"
        stroke="#3D4654"
        strokeWidth="1"
      />
      <path d="M6 8h20v6H6z" fill="url(#slabLogoShine)" opacity="0.9" />

      {/* Grading strip */}
      <rect x="7" y="5.5" width="18" height="6" rx="1.75" fill="url(#slabLogoTeal)" />
      <rect x="7.5" y="6" width="17" height="1.25" rx="0.5" fill="#ffffff" fillOpacity="0.12" />

      {/* Inner card window */}
      <rect x="8.5" y="13.5" width="15" height="17" rx="2" fill="#0C0E12" stroke="#2A313C" strokeWidth="0.75" />
      <rect x="9.5" y="14.5" width="13" height="8" rx="1" fill="#1A1F28" opacity="0.95" />

      {/* Simple “trend” — suggests value tracking */}
      <path
        d="M11.5 28.5 L14 25.8 L16.8 27.5 L21 23.2"
        stroke="#1D9E75"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.95"
      />

      {/* Specular edge */}
      <path
        d="M6 4.5C6 3.12 7.12 2 8.5 2h15c1.38 0 2.5 1.12 2.5 2.5"
        stroke="#ffffff"
        strokeOpacity="0.08"
        strokeWidth="0.75"
        fill="none"
      />
    </svg>
  )
}

export function SlabBookLogo ({ size = 'md', iconOnly = false, className = '' }: SlabBookLogoProps) {
  const w = ICON_WIDTH[size]
  const wordmark: ReactNode = iconOnly ? null : (
    <span
      className={[
        'font-semibold tracking-[-0.02em] antialiased',
        WORDMARK_CLASS[size],
      ].join(' ')}
    >
      <span className="text-[var(--slab-text,#F1EFE8)]">Slab</span>
      <span className="text-[var(--slab-teal,#1D9E75)]">Book</span>
    </span>
  )

  return (
    <div
      className={['inline-flex items-center gap-2 sm:gap-2.5', className].filter(Boolean).join(' ')}
      role={iconOnly ? 'img' : undefined}
      aria-label={iconOnly ? 'SlabBook' : undefined}
    >
      <SlabMark widthPx={w} />
      {wordmark}
    </div>
  )
}
