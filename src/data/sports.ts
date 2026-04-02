/**
 * Preset leagues shown in the sport field datalist. Users can type any custom label
 * (WNBA, F1, Rugby, etc.); it is stored as-is on the card.
 */
export const SPORTS_PRESETS = [
  'NFL',
  'NBA',
  'MLB',
  'NHL',
  'Soccer',
  'MMA',
] as const

export type SportPreset = (typeof SPORTS_PRESETS)[number]

/** @deprecated Use SPORTS_PRESETS — alias for forms that still import `SPORTS`. */
export const SPORTS = SPORTS_PRESETS

/** Normalize DB / API values to a stable label; default NFL when empty. */
export function normalizeSportLabel (raw: string | null | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return 'NFL'
  const upper = t.toUpperCase()
  if (upper === 'NFL' || upper === 'NBA' || upper === 'MLB' || upper === 'NHL') return upper
  const hit = SPORTS_PRESETS.find((p) => p.toLowerCase() === t.toLowerCase())
  if (hit) return hit
  return t
}

/** Curated set names per preset sport — used to filter the Set dropdown. Unknown sports get []. */
export const SETS_BY_SPORT: Record<string, string[]> = {
  NFL: [
    'Panini Prizm',
    'Donruss Optic',
    'Panini Mosaic',
    'Panini Contenders',
    'Panini Select',
    'Panini National Treasures',
    'Panini Immaculate',
    'Panini Flawless',
    'Panini Obsidian',
    'Topps Chrome',
    'Leaf Metal',
    'Score',
    'Donruss',
    'Panini One',
    'Panini Certified',
  ],
  NBA: [
    'Panini Prizm',
    'Donruss Optic',
    'Panini Mosaic',
    'Panini Contenders',
    'Panini Select',
    'Panini National Treasures',
    'Panini Immaculate',
    'Panini Flawless',
    'Panini Obsidian',
    'Topps Chrome',
    'Hoops',
    'Donruss',
    'Panini One',
    'Panini Certified',
    'Panini Noir',
  ],
  MLB: [
    'Topps Chrome',
    'Bowman Chrome',
    'Topps Finest',
    'Panini Prizm',
    'Donruss Optic',
    'Topps Series 1',
    'Topps Series 2',
    'Bowman',
    'Topps Heritage',
    'Topps Stadium Club',
    'Topps Allen & Ginter',
    'Panini Immaculate',
    'Panini Flawless',
    'Leaf Metal',
    'Donruss',
  ],
  NHL: [
    'Upper Deck Series 1',
    'Upper Deck Series 2',
    'Upper Deck Young Guns',
    'SP Authentic',
    'SP Game Used',
    'The Cup',
    'OPC Platinum',
    'Artifacts',
    'Artifacts Frozen',
    'Allure',
    'Parkhurst',
    'O-Pee-Chee Platinum',
    'Upper Deck Ice',
    'Chronology',
    'Trilogy',
  ],
  Soccer: [
    'Topps Chrome UEFA',
    'Panini Prizm FIFA World Cup',
    'Panini Select FIFA',
    'Topps MLS',
    'Merlin Chrome',
    'Parkside NWSL',
    'Futera',
  ],
  MMA: [
    'Topps UFC Chrome',
    'Panini Prizm UFC',
    'Leaf Metal UFC',
    'Donruss UFC',
  ],
}
