/**
 * Known pro / rookie card years for major players (NFL/NBA/MLB/NHL).
 * Used to avoid mislabeling veterans as rookies and to stage careers accurately.
 */
export const PLAYER_ROOKIE_YEARS: Record<string, number> = {
  'Patrick Mahomes': 2017,
  'Josh Allen': 2018,
  'Joe Burrow': 2020,
  'Justin Herbert': 2020,
  'Trevor Lawrence': 2021,
  'Justin Fields': 2021,
  'Bryce Young': 2023,
  'CJ Stroud': 2023,
  'Drake Maye': 2024,
  'Caleb Williams': 2024,
  'LeBron James': 2003,
  'Stephen Curry': 2009,
  'Kevin Durant': 2007,
  'Giannis Antetokounmpo': 2013,
  'Luka Doncic': 2018,
  'Ja Morant': 2019,
  'Zion Williamson': 2019,
  'Cade Cunningham': 2021,
  'Paolo Banchero': 2022,
  'Victor Wembanyama': 2023,
  'Caitlin Clark': 2024,
  'Mike Trout': 2011,
  'Shohei Ohtani': 2018,
  'Ronald Acuna Jr': 2018,
  'Ronald Acuña Jr': 2018,
  'Juan Soto': 2018,
  'Fernando Tatis Jr': 2019,
  'Julio Rodriguez': 2022,
  'Paul Skenes': 2024,
  'Connor McDavid': 2015,
  'Auston Matthews': 2016,
  'Connor Bedard': 2023,
  'Macklin Celebrini': 2024,
}

const ROOKIE_KEYS = Object.keys(PLAYER_ROOKIE_YEARS)

export function findPlayerProRookieYear (playerName: string): number | null {
  const n = playerName.trim().replace(/\s+/g, ' ')
  if (!n) return null
  if (PLAYER_ROOKIE_YEARS[n] != null) return PLAYER_ROOKIE_YEARS[n]
  const lower = n.toLowerCase()
  for (const k of ROOKIE_KEYS) {
    if (k.toLowerCase() === lower) return PLAYER_ROOKIE_YEARS[k]
  }
  return null
}

export type CardRowForInsights = {
  player_name: string
  year: number | null
  set_name: string | null
  sport: string | null
  is_graded: boolean
  grade: string | null
  grading_company: string | null
  purchase_price: number | null
  current_value: number | null
  purchase_date: string | null
  card_number: string | null
  variation: string | null
}

export type EnrichedCardForInsights = {
  card_display_label: string
  player_name: string
  year: number | null
  set_name: string | null
  sport: string | null
  grade_line: string
  card_number: string | null
  variation: string | null
  purchase_price: number | null
  current_value: number | null
  purchase_date: string | null
  psa_population: number | null
  card_age_years: number | null
  player_pro_rookie_year: number | null
  years_since_player_pro_debut: number | null
  is_true_rookie_card: boolean
  rookie_years_ago: number | null
  /** Player-based stage when known; otherwise era of the card print */
  career_stage: string
  card_print_career_stage: string
  player_career_stage: string | null
  value_change_percent: string | null
  holding_period_days: number | null
  holding_period_text: string | null
  is_up: boolean | null
  annualized_return_percent: string | null
}

function gradeLine (c: CardRowForInsights): string {
  if (!c.is_graded) return 'Raw'
  const bits = [c.grading_company, c.grade].filter(Boolean)
  return bits.length ? bits.join(' ') : 'Graded'
}

function cardPrintCareerStage (cardAgeYears: number | null): string {
  if (cardAgeYears == null || !Number.isFinite(cardAgeYears)) return 'Unknown (missing card year)'
  if (cardAgeYears <= 1) return 'Current rookie era print'
  if (cardAgeYears <= 3) return 'Early career era print'
  if (cardAgeYears <= 7) return 'Established veteran era print'
  if (cardAgeYears <= 12) return 'Prime veteran era print'
  return 'Late career / retired era print'
}

function playerCareerStageFromYears (yearsPro: number): string {
  if (yearsPro <= 1) return 'Current rookie / very early career'
  if (yearsPro <= 3) return 'Early career'
  if (yearsPro <= 7) return 'Established veteran'
  if (yearsPro <= 12) return 'Prime veteran'
  return 'Late career / retired'
}

function holdingPeriodText (days: number): string {
  if (days < 1) return 'Less than a day'
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  const parts: string[] = []
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m > 0) parts.push(`${m} month${m === 1 ? '' : 's'}`)
  if (parts.length === 0) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function hasRookieKeywords (c: CardRowForInsights): boolean {
  const blob = `${c.variation ?? ''} ${c.set_name ?? ''} ${c.card_number ?? ''}`
  return /\brc\b|rookie|first year|1st year/i.test(blob)
}

export function enrichCardForInsights (c: CardRowForInsights, now: Date): EnrichedCardForInsights {
  const cy = now.getUTCFullYear()
  const cardYear = c.year
  const cardAgeYears =
    cardYear != null && Number.isFinite(cardYear) ? Math.max(0, cy - cardYear) : null

  const playerPro = findPlayerProRookieYear(c.player_name)
  const yearsSincePro =
    playerPro != null ? Math.max(0, cy - playerPro) : null

  const isTrueRookieCard =
    (cardYear != null && playerPro != null && cardYear === playerPro) || hasRookieKeywords(c)

  const rookieYearsAgo = cardAgeYears

  const purchase = c.purchase_price != null ? Number(c.purchase_price) : null
  const current = c.current_value != null ? Number(c.current_value) : null
  let valueChangePercent: string | null = null
  let isUp: boolean | null = null
  let annualized: string | null = null

  if (purchase != null && purchase > 0 && current != null && Number.isFinite(current)) {
    const pct = ((current - purchase) / purchase) * 100
    valueChangePercent = pct.toFixed(1)
    isUp = current > purchase
    let days: number | null = null
    if (c.purchase_date) {
      const p = new Date(c.purchase_date).getTime()
      if (!Number.isNaN(p)) days = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
    }
    if (days != null && days >= 30) {
      const years = days / 365
      if (years > 0 && current > 0) {
        const r = (current / purchase) ** (1 / years) - 1
        annualized = (r * 100).toFixed(1)
      }
    }
  }

  let holdingDays: number | null = null
  if (c.purchase_date) {
    const p = new Date(c.purchase_date).getTime()
    if (!Number.isNaN(p)) holdingDays = Math.max(0, Math.floor((now.getTime() - p) / 86_400_000))
  }

  const cardPrintStage = cardPrintCareerStage(cardAgeYears)
  const playerStage = yearsSincePro != null ? playerCareerStageFromYears(yearsSincePro) : null
  const careerStage = playerStage ?? cardPrintStage
  const labelParts = [
    c.player_name,
    c.year != null ? String(c.year) : null,
    c.set_name,
    gradeLine(c),
  ].filter(Boolean)

  return {
    card_display_label: labelParts.join(' · '),
    player_name: c.player_name,
    year: c.year,
    set_name: c.set_name,
    sport: c.sport,
    grade_line: gradeLine(c),
    card_number: c.card_number,
    variation: c.variation,
    purchase_price: purchase,
    current_value: current,
    purchase_date: c.purchase_date,
    psa_population: null,
    card_age_years: cardAgeYears,
    player_pro_rookie_year: playerPro,
    years_since_player_pro_debut: yearsSincePro,
    is_true_rookie_card: isTrueRookieCard,
    rookie_years_ago: rookieYearsAgo,
    career_stage: careerStage,
    card_print_career_stage: cardPrintStage,
    player_career_stage: playerStage,
    value_change_percent: valueChangePercent,
    holding_period_days: holdingDays,
    holding_period_text: holdingDays != null ? holdingPeriodText(holdingDays) : null,
    is_up: isUp,
    annualized_return_percent: annualized,
  }
}

export type PortfolioSummaryForInsights = {
  total_cards: number
  total_invested: number
  total_value: number
  gain_loss: number
  gain_pct: string
  best_card_label: string
  best_pct: string
  worst_card_label: string
  worst_pct: string
}

export function buildPortfolioSummary (
  enriched: EnrichedCardForInsights[],
): PortfolioSummaryForInsights {
  const total_cards = enriched.length
  let total_invested = 0
  let total_value = 0
  let best: { label: string; pct: number } | null = null
  let worst: { label: string; pct: number } | null = null

  for (const c of enriched) {
    const inv = c.purchase_price ?? 0
    const val = c.current_value ?? 0
    if (c.purchase_price != null && c.purchase_price > 0) total_invested += inv
    if (c.current_value != null) total_value += val

    const pctStr = c.value_change_percent
    if (pctStr != null && c.purchase_price != null && c.purchase_price > 0) {
      const pct = Number.parseFloat(pctStr)
      if (Number.isFinite(pct)) {
        const label = `${c.player_name}${c.year != null ? ` (${c.year})` : ''} · ${c.grade_line}`
        if (!best || pct > best.pct) best = { label, pct }
        if (!worst || pct < worst.pct) worst = { label, pct }
      }
    }
  }

  const gain_loss = total_value - total_invested
  const gain_pct =
    total_invested > 0 ? ((gain_loss / total_invested) * 100).toFixed(1) : '0.0'

  return {
    total_cards,
    total_invested,
    total_value,
    gain_loss,
    gain_pct,
    best_card_label: best?.label ?? 'N/A',
    best_pct: best != null ? best.pct.toFixed(1) : '0',
    worst_card_label: worst?.label ?? 'N/A',
    worst_pct: worst != null ? worst.pct.toFixed(1) : '0',
  }
}

export function topCardsByValue (
  enriched: EnrichedCardForInsights[],
  n: number,
): EnrichedCardForInsights[] {
  return [...enriched]
    .filter((c) => c.current_value != null && c.current_value > 0)
    .sort((a, b) => (b.current_value ?? 0) - (a.current_value ?? 0))
    .slice(0, n)
}

/** Shape sent to Claude (field names match product spec). */
export function cardToInsightsPromptJson (c: EnrichedCardForInsights): Record<string, unknown> {
  return {
    card_display_label: c.card_display_label,
    player_name: c.player_name,
    year: c.year,
    set_name: c.set_name,
    sport: c.sport,
    grade_line: c.grade_line,
    card_number: c.card_number,
    variation: c.variation,
    purchase_price: c.purchase_price,
    current_value: c.current_value,
    purchase_date: c.purchase_date,
    psa_population: c.psa_population,
    card_age_years: c.card_age_years,
    player_pro_rookie_year: c.player_pro_rookie_year,
    is_true_rookie: c.is_true_rookie_card,
    rookie_years_ago: c.rookie_years_ago,
    career_stage: c.career_stage,
    card_print_career_stage: c.card_print_career_stage,
    player_career_stage: c.player_pro_rookie_year != null ? c.player_career_stage : null,
    value_change_percent: c.value_change_percent,
    holding_period_days: c.holding_period_days,
    holding_period_text: c.holding_period_text,
    is_up: c.is_up,
    annualized_return: c.annualized_return_percent,
  }
}
