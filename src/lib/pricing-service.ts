/**
 * Client-side pricing entry point.
 *
 * Server-side estimation lives in `api/estimate-card-value.ts` (Claude, single Vercel function).
 * TODO: Replace the server `getCardValue` implementation with a real pricing API (e.g. 130point,
 * eBay sold listings). The SPA should keep importing from this file so only one client call site
 * needs review when switching providers.
 */

import { postEstimateCardValue, type EstimateCardValueResponse } from './estimateCardValueApi'
import type { Card } from '../types/card'

export async function getCardValue (
  card: Pick<Card, 'id'>,
  accessToken: string,
  opts?: { force_refresh?: boolean },
): Promise<EstimateCardValueResponse> {
  return postEstimateCardValue(accessToken, card.id, opts)
}
