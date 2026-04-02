import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'
import type { WatchlistItem } from '../types/watchlistItem'

/** Fields used to build sports / generic trading-card comp URLs. */
export type CardCompsFields = Pick<
  Card,
  'player_name' | 'year' | 'set_name' | 'card_number' | 'variation' | 'sport'
>

function scpSlugify (raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function scpCardNumberSlug (raw: string | null | undefined): string {
  if (!raw) return ''
  const base = String(raw).split('/')[0] || ''
  const cleaned = base.replace(/^[#\s]+/, '').trim()
  return scpSlugify(cleaned)
}

function sportSlug (sport: string | null | undefined): string {
  if (sport === 'NFL') return 'football-cards'
  if (sport === 'NBA') return 'basketball-cards'
  if (sport === 'MLB') return 'baseball-cards'
  if (sport === 'NHL') return 'hockey-cards'
  return ''
}

/** eBay sold / search style query for sports slab cards */
export function ebayCompsUrlForCard (
  card: Pick<Card, 'player_name' | 'year' | 'set_name' | 'card_number'>,
): string {
  const q = `${card.player_name} ${card.year ?? ''} ${card.set_name ?? ''} ${card.card_number ?? ''}`.trim()
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`
}

export function watchlistItemToCardComps (w: WatchlistItem): CardCompsFields {
  return {
    player_name: w.player_name,
    year: w.year,
    set_name: w.set_name,
    card_number: w.card_number,
    variation: w.variation,
    sport: w.sport,
  }
}

/** SportsCardsPro exact game URL when we have sport/year/set/player/#; else search. */
export function sportsCardsProCompsUrlForCard (card: CardCompsFields): string {
  const scpSportSlug = sportSlug(card.sport)
  const scpYear = card.year != null ? String(card.year) : ''
  const scpSetSlug = card.set_name ? scpSlugify(card.set_name) : ''
  const scpPlayerSlug = scpSlugify(card.player_name)
  const scpCardNumber = scpCardNumberSlug(card.card_number)

  const scpSetSlugHasYearPrefix =
    Boolean(scpYear) && Boolean(scpSetSlug) && scpSetSlug.toLowerCase().startsWith(`${scpYear.toLowerCase()}-`)

  const scpGamePathSetPart =
    scpSportSlug && scpSetSlug
      ? scpSetSlugHasYearPrefix
        ? `${scpSportSlug}-${scpSetSlug}`
        : `${scpSportSlug}-${scpYear}-${scpSetSlug}`
      : ''

  const sportsCardsProGameUrl =
    scpGamePathSetPart && scpPlayerSlug && scpCardNumber
      ? `https://www.sportscardspro.com/game/${scpGamePathSetPart}/${scpPlayerSlug}-${scpCardNumber}#completed-auctions-manual-only`
      : ''

  const sportsCardsProQuery = [
    card.player_name,
    card.year != null ? String(card.year) : null,
    card.set_name,
    card.card_number,
    card.variation,
    card.sport,
  ]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join(' ')
    .trim()

  const sportsCardsProSearchUrl =
    sportsCardsProQuery.length > 0
      ? `https://www.sportscardspro.com/search-products?q=${encodeURIComponent(sportsCardsProQuery)}&type=prices`
      : ''

  return sportsCardsProGameUrl || sportsCardsProSearchUrl
}

export function ebayCompsUrlForPokemon (
  card: Pick<PokemonCard, 'pokemon_name' | 'set_name' | 'card_number' | 'variation' | 'language'>,
): string {
  const lang = card.language === 'jp' ? 'Japanese' : 'English'
  const q = [card.pokemon_name, card.set_name, card.card_number, card.variation, lang, 'Pokemon card']
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join(' ')
    .trim()
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`
}

/** SportsCardsPro is sports-first; Pokémon uses the same search endpoint for price discovery. */
export function sportsCardsProSearchUrlForPokemon (
  card: Pick<PokemonCard, 'pokemon_name' | 'set_name' | 'card_number' | 'variation' | 'language'>,
): string {
  const q = [
    card.pokemon_name,
    card.language === 'jp' ? 'Japanese' : null,
    card.set_name,
    card.card_number,
    card.variation,
    'Pokemon TCG',
  ]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join(' ')
    .trim()
  if (!q) return ''
  return `https://www.sportscardspro.com/search-products?q=${encodeURIComponent(q)}&type=prices`
}
