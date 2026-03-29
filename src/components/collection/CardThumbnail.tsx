import type { Card } from '../../types/card'
import { playerInitials } from '../../lib/cardDisplayHelpers'
import { CardSportGlyph } from './CardSportGlyph'

type Variant = 'grid' | 'table' | 'fill'

type Props = {
  card: Card
  variant?: Variant
  className?: string
  onClick?: () => void
  alt?: string
}

export function CardThumbnail ({
  card,
  variant = 'grid',
  className = '',
  onClick,
  alt,
}: Props) {
  const url = card.image_front_url?.trim() || null
  const interactive = Boolean(onClick)
  const label = alt ?? `${card.player_name} card front`

  const wrapCls = [
    'relative overflow-hidden bg-zinc-800/80',
    variant === 'table' ? 'h-14 w-10 shrink-0 rounded-md ring-1 ring-zinc-700/80' : '',
    variant === 'grid' ? 'h-full w-full rounded-t-xl' : '',
    variant === 'fill' ? 'h-full w-full rounded-lg' : '',
    interactive ? 'cursor-pointer transition hover:ring-2 hover:ring-slab-teal/40' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const inner = url ? (
    <img
      src={url}
      alt={label}
      className={[
        'h-full w-full object-cover',
        variant === 'table' ? 'object-top' : '',
      ].join(' ')}
      loading="lazy"
    />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-zinc-800 to-zinc-900 p-1 text-center">
      <CardSportGlyph sport={card.sport} className="text-base opacity-80" />
      <span className="text-[10px] font-bold leading-none tracking-tight text-zinc-200">
        {playerInitials(card.player_name)}
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button type="button" className={wrapCls} onClick={onClick} aria-label={`View ${label}`}>
        {inner}
      </button>
    )
  }

  return <div className={wrapCls}>{inner}</div>
}
