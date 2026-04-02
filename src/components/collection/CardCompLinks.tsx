import type { Card } from '../../types/card'
import type { PokemonCard } from '../../types/pokemonCard'
import {
  ebayCompsUrlForCard,
  ebayCompsUrlForPokemon,
  sportsCardsProCompsUrlForCard,
  sportsCardsProSearchUrlForPokemon,
} from '../../lib/compLinks'

const linkCls = 'font-medium text-slab-teal hover:text-slab-teal-light underline-offset-2 hover:underline'

type SportsProps = {
  card: Card
  className?: string
  linkClassName?: string
}

export function SportsCardCompLinks ({ card, className = '', linkClassName = linkCls }: SportsProps) {
  const ebay = ebayCompsUrlForCard(card)
  const scp = sportsCardsProCompsUrlForCard(card)
  return (
    <div className={['flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]', className].join(' ')}>
      <a href={ebay} target="_blank" rel="noreferrer" className={linkClassName}>
        eBay comps
      </a>
      {scp ? (
        <a href={scp} target="_blank" rel="noreferrer" className={linkClassName}>
          SportsCardsPro
        </a>
      ) : null}
    </div>
  )
}

type PokemonProps = {
  card: PokemonCard
  className?: string
  linkClassName?: string
}

export function PokemonCardCompLinks ({ card, className = '', linkClassName = linkCls }: PokemonProps) {
  const ebay = ebayCompsUrlForPokemon(card)
  const scp = sportsCardsProSearchUrlForPokemon(card)
  return (
    <div className={['flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]', className].join(' ')}>
      <a href={ebay} target="_blank" rel="noreferrer" className={linkClassName}>
        eBay comps
      </a>
      {scp ? (
        <a href={scp} target="_blank" rel="noreferrer" className={linkClassName}>
          SCP search
        </a>
      ) : null}
    </div>
  )
}
