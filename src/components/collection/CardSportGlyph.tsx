type Props = {
  sport: string | null | undefined
  className?: string
}

export function CardSportGlyph ({ sport, className }: Props) {
  const glyph =
    sport === 'NFL'
      ? '🏈'
      : sport === 'NBA'
        ? '🏀'
        : sport === 'MLB'
          ? '⚾'
          : sport === 'NHL'
            ? '🏒'
            : '🃏'
  return (
    <span className={className} aria-hidden>
      {glyph}
    </span>
  )
}
