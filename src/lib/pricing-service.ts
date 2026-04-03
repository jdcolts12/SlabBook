/**
 * Client-side pricing entry point.
 *
 * Server-side estimation lives in `api/estimate-card-value.ts`: Claude + optional web search
 * (default: restricted to SportsCardsPro.com). The SPA should keep importing from this file.
 */

import { postEstimateCardValue, type EstimateCardValueResponse } from './estimateCardValueApi'
import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'

export async function getCardValue (
  card: Pick<Card, 'id'>,
  accessToken: string,
  opts?: { force_refresh?: boolean },
): Promise<EstimateCardValueResponse> {
  return postEstimateCardValue(accessToken, card.id, opts)
}

export async function getPokemonCardValue (
  card: Pick<PokemonCard, 'id'>,
  accessToken: string,
  opts?: { force_refresh?: boolean },
): Promise<EstimateCardValueResponse> {
  return postEstimateCardValue(accessToken, card.id, { ...opts, card_kind: 'pokemon' })
}
