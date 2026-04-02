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
            : sport === 'Soccer'
              ? '⚽'
              : sport === 'MMA'
                ? '🥊'
                : '🃏'
  return (
    <span className={className} aria-hidden>
      {glyph}
    </span>
  )
}
