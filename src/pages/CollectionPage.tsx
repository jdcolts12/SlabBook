import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CollectionSubnav } from '../components/collection/CollectionSubnav'
import { CardFormDialog, type CardFormSubmitPayload } from '../components/collection/CardFormDialog'
import { CardImageModal } from '../components/collection/CardImageModal'
import { CollectionGridView } from '../components/collection/CollectionGridView'
import { PortfolioSummaryBar } from '../components/collection/PortfolioSummaryBar'
import { CollectionTableView } from '../components/collection/CollectionTableView'
import {
  type GradeFilter,
  CollectionToolbar,
  type ViewMode,
} from '../components/collection/CollectionToolbar'
import { Toast } from '../components/Toast'
import { type CardFormValues, variationFromFormValues } from '../lib/cardForm'
import {
  computePortfolioMetrics,
  sortCards,
  type SortKey,
} from '../lib/cardMetrics'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { UpgradeModal } from '../components/billing/UpgradeModal'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import {
  removeCardImageByPublicUrl,
  uploadCardImageSide,
  uploadPokemonCardImageSide,
} from '../lib/cardImageStorage'
import { supabase } from '../lib/supabase'
import { AI_VALUE_DISCLAIMER } from '../lib/aiValueCopy'
import { fetchTotalCardCount } from '../lib/collectionCounts'
import { mergeEstimateIntoCard } from '../lib/estimateCardValueApi'
import { getCardValue } from '../lib/pricing-service'
import { createCheckoutSession } from '../lib/stripeApi'
import { effectiveTier, maxCardsForUser } from '../lib/tierLimits'
import type { Card } from '../types/card'
import type { PokemonCard } from '../types/pokemonCard'

const money = moneyFormatter

function parseOptionalNumber (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseFloat(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseOptionalInt (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

type CardWritable = Omit<
  Card,
  'id' | 'created_at' | 'last_updated' | 'image_front_url' | 'image_back_url'
>

function formValuesToPayload (userId: string, v: CardFormValues): CardWritable {
  const tcg =
    v.detected_card_kind === 'pokemon_tcg' || v.detected_card_kind === 'other_tcg'
  return {
    user_id: userId,
    sport: tcg ? null : v.sport,
    player_name: v.player_name.trim(),
    year: parseOptionalInt(v.year),
    set_name: v.set_name.trim() || null,
    card_number: v.card_number.trim() || null,
    variation: variationFromFormValues(v),
    is_graded: v.is_graded,
    grade: v.is_graded && v.grade.trim() ? v.grade.trim() : null,
    grading_company: v.is_graded && v.grading_company.trim() ? v.grading_company.trim() : null,
    condition: v.is_graded ? null : v.condition.trim() || null,
    purchase_price: parseOptionalNumber(v.purchase_price),
    purchase_date: v.purchase_date.trim() || null,
    current_value: parseOptionalNumber(v.current_value),
    value_low: v.instant_value_low ? parseOptionalNumber(v.instant_value_low) : null,
    value_high: v.instant_value_high ? parseOptionalNumber(v.instant_value_high) : null,
    confidence: v.instant_confidence ?? null,
    trend: v.instant_trend ?? null,
    value_note: v.instant_value_note ? v.instant_value_note.trim() || null : null,
    pricing_source: null,
  }
}

type PokemonWritable = Omit<
  PokemonCard,
  'id' | 'created_at' | 'image_front_url' | 'image_back_url'
>

function pokemonValuesToPayload (userId: string, v: CardFormValues): PokemonWritable {
  return {
    user_id: userId,
    pokemon_name: v.player_name.trim(),
    language: 'en',
    set_name: v.set_name.trim() || null,
    card_number: v.card_number.trim() || null,
    variation: variationFromFormValues(v),
    is_graded: v.is_graded,
    grade: v.is_graded && v.grade.trim() ? v.grade.trim() : null,
    grading_company: v.is_graded && v.grading_company.trim() ? v.grading_company.trim() : null,
    condition: v.is_graded ? null : v.condition.trim() || null,
    purchase_price: parseOptionalNumber(v.purchase_price),
    purchase_date: v.purchase_date.trim() || null,
    current_value: parseOptionalNumber(v.current_value),
  }
}

const VIEW_KEY = 'slabbook.collectionView'

function readStoredView (): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'grid' ? 'grid' : 'table'
  } catch {
    return 'table'
  }
}

function filterCards (
  cards: Card[],
  sport: string,
  gradeFilter: GradeFilter,
  gradingCompany: string,
): Card[] {
  return cards.filter((c) => {
    if (sport !== 'all' && c.sport !== sport) return false
    if (gradeFilter === 'graded' && !c.is_graded) return false
    if (gradeFilter === 'raw' && c.is_graded) return false
    if (gradingCompany !== 'all') {
      if (!c.is_graded) return false
      if (c.grading_company !== gradingCompany) return false
    }
    return true
  })
}

export function CollectionPage () {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, session } = useAuth()
  const { profile, refresh: refreshProfile } = useUserProfile(user?.id)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})
  const [estimateErrors, setEstimateErrors] = useState<Record<string, string | null>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<Card | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [sortBy, setSortBy] = useState<SortKey>('value')
  const [sport, setSport] = useState('all')
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all')
  const [gradingCompany, setGradingCompany] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => readStoredView())
  const [imageModalCard, setImageModalCard] = useState<Card | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [scanModeOpen, setScanModeOpen] = useState(false)
  const [postAdd, setPostAdd] = useState<{ cardId: string; estimating: boolean; done: boolean } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode)
    } catch {
      /* ignore */
    }
  }, [viewMode])

  useEffect(() => {
    if (gradeFilter === 'raw') setGradingCompany('all')
  }, [gradeFilter])

  const loadCards = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error.message)
        setCards([])
      } else {
        setCards((data ?? []) as Card[])
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    document.title = 'Sports collection — SlabBook'
  }, [])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  useEffect(() => {
    const raw = location.state as Record<string, unknown> | null
    const editId = raw && typeof raw.editCardId === 'string' ? raw.editCardId : null
    if (!editId) return
    if (loading) return
    const card = cards.find((c) => c.id === editId)
    if (!card) {
      navigate(location.pathname, { replace: true, state: null })
      return
    }
    setDialogMode('edit')
    setEditing(card)
    setDialogOpen(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, cards, navigate, loading])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`collection-cards-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cards',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void loadCards({ silent: true })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, loadCards])

  const sportOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of cards) {
      if (c.sport) set.add(c.sport)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [cards])

  const gradingCompanyOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of cards) {
      if (c.is_graded && c.grading_company) set.add(c.grading_company)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [cards])

  const portfolioMetrics = useMemo(() => computePortfolioMetrics(cards), [cards])
  const currentTier = effectiveTier(profile)
  const isFreeUser = currentTier === 'free'

  const filteredCards = useMemo(
    () => filterCards(cards, sport, gradeFilter, gradingCompany),
    [cards, sport, gradeFilter, gradingCompany],
  )

  const visibleCards = useMemo(
    () => sortCards(filteredCards, sortBy),
    [filteredCards, sortBy],
  )

  function resetFilters () {
    setSport('all')
    setGradeFilter('all')
    setGradingCompany('all')
    setSortBy('value')
  }

  function openAdd (opts?: { scan?: boolean }) {
    void (async () => {
      if (!user) return
      const plan = await refreshProfile({ quiet: true })
      const cap = maxCardsForUser(plan)
      if (!Number.isFinite(cap)) {
        setDialogMode('add')
        setEditing(null)
        setScanModeOpen(Boolean(opts?.scan))
        setDialogOpen(true)
        return
      }
      try {
        const total = await fetchTotalCardCount(supabase, user.id)
        if (total >= cap) {
          setUpgradeOpen(true)
          return
        }
      } catch {
        setLoadError('Could not verify collection limit.')
        return
      }
      setDialogMode('add')
      setEditing(null)
      setScanModeOpen(Boolean(opts?.scan))
      setDialogOpen(true)
    })()
  }

  function openEdit (c: Card) {
    setDialogMode('edit')
    setEditing(c)
    setScanModeOpen(false)
    setDialogOpen(true)
  }

  useEffect(() => {
    if (loading) return
    const wantsScan = searchParams.get('scan') === '1'
    if (!wantsScan) return
    openAdd({ scan: true })
    const next = new URLSearchParams(searchParams)
    next.delete('scan')
    const welcomed = next.get('welcome') === '1'
    if (welcomed) {
      next.delete('welcome')
      setToastMessage('Welcome to SlabBook! Start by scanning your first card.')
    }
    setSearchParams(next, { replace: true })
  }, [loading, searchParams, setSearchParams])

  async function handleSubmit (submit: CardFormSubmitPayload) {
    if (!user) throw new Error('Not signed in.')
    const {
      values,
      draftCardId,
      imageFront,
      imageBack,
      removeImageFront,
      removeImageBack,
      awaitEstimateAfterSave,
    } = submit
    const cardKind = values.detected_card_kind
    const cardPayload = formValuesToPayload(user.id, values)
    const pokemonPayload = pokemonValuesToPayload(user.id, values)

    if (dialogMode === 'add') {
      const plan = await refreshProfile({ quiet: true })
      const cap = maxCardsForUser(plan)
      if (Number.isFinite(cap)) {
        const total = await fetchTotalCardCount(supabase, user.id)
        if (total >= cap) {
          setUpgradeOpen(true)
          throw new Error('Collection limit reached. Upgrade to add more cards.')
        }
      }
      if (cardKind === 'pokemon_tcg') {
        const { error: insertErr } = await supabase.from('pokemon_cards').insert({
          id: draftCardId,
          ...pokemonPayload,
          image_front_url: null,
          image_back_url: null,
        })
        if (insertErr) throw new Error(insertErr.message)

        let image_front_url: string | null = null
        let image_back_url: string | null = null
        try {
          if (imageFront) {
            image_front_url = await uploadPokemonCardImageSide(
              supabase,
              user.id,
              draftCardId,
              'front',
              imageFront,
            )
          }
          if (imageBack) {
            image_back_url = await uploadPokemonCardImageSide(
              supabase,
              user.id,
              draftCardId,
              'back',
              imageBack,
            )
          }
          if (image_front_url || image_back_url) {
            const { error: imgErr } = await supabase
              .from('pokemon_cards')
              .update({
                ...(image_front_url != null ? { image_front_url } : {}),
                ...(image_back_url != null ? { image_back_url } : {}),
              })
              .eq('id', draftCardId)
              .eq('user_id', user.id)
            if (imgErr) throw new Error(imgErr.message)
          }
        } catch (imgErr) {
          await supabase.from('pokemon_cards').delete().eq('id', draftCardId).eq('user_id', user.id)
          throw imgErr instanceof Error ? imgErr : new Error('Image upload failed.')
        }

        setToastMessage('Pokémon card added to your collection.')
        await loadCards({ silent: true })
        navigate('/dashboard/collection/pokemon')
        return
      }

      const { error: insertErr } = await supabase.from('cards').insert({
        id: draftCardId,
        ...cardPayload,
        image_front_url: null,
        image_back_url: null,
        last_updated: new Date().toISOString(),
      })
      if (insertErr) throw new Error(insertErr.message)

      let image_front_url: string | null = null
      let image_back_url: string | null = null
      try {
        if (imageFront) {
          image_front_url = await uploadCardImageSide(
            supabase,
            user.id,
            draftCardId,
            'front',
            imageFront,
          )
        }
        if (imageBack) {
          image_back_url = await uploadCardImageSide(
            supabase,
            user.id,
            draftCardId,
            'back',
            imageBack,
          )
        }
        if (image_front_url || image_back_url) {
          const { error: imgErr } = await supabase
            .from('cards')
            .update({
              ...(image_front_url != null ? { image_front_url } : {}),
              ...(image_back_url != null ? { image_back_url } : {}),
            })
            .eq('id', draftCardId)
            .eq('user_id', user.id)
          if (imgErr) throw new Error(imgErr.message)
        }
      } catch (imgErr) {
        await supabase.from('cards').delete().eq('id', draftCardId).eq('user_id', user.id)
        throw imgErr instanceof Error ? imgErr : new Error('Image upload failed.')
      }

      const { data: fullRow, error: fetchErr } = await supabase
        .from('cards')
        .select('*')
        .eq('id', draftCardId)
        .eq('user_id', user.id)
        .single()
      if (fetchErr) throw new Error(fetchErr.message)
      const added = fullRow as Card

      // If the scan verification already produced an instant estimate, don't re-estimate after saving.
      if (!isFreeUser && added.current_value != null) {
        setToastMessage('Card added — instant value estimate ready.')
        await loadCards({ silent: true })
        setPostAdd(null)
        return
      }

      const waitForEstimate = awaitEstimateAfterSave === true

      if (waitForEstimate && !isFreeUser) {
        const estimated = await estimateCard(added, { forceRefresh: true })
        await loadCards({ silent: true })
        if (estimated?.current_value != null) {
          setToastMessage(`Added — est. ${money.format(Number(estimated.current_value))}`)
        } else if (estimated) {
          setToastMessage('Card added. Estimate completed.')
        } else {
          setToastMessage('Card added. Use Refresh on the card to fetch an estimate.')
        }
        setPostAdd(null)
        return
      }

      setToastMessage('Card added to your collection.')
      await loadCards({ silent: true })
      if (isFreeUser) {
        setPostAdd({ cardId: added.id, estimating: false, done: false })
      } else {
        setPostAdd({ cardId: added.id, estimating: true, done: false })
        void (async () => {
          await estimateCard(added, { forceRefresh: true })
          setPostAdd({ cardId: added.id, estimating: false, done: true })
        })()
      }
      return
    }

    if (dialogMode === 'edit' && editing) {
      let nextFront = editing.image_front_url
      let nextBack = editing.image_back_url

      if (removeImageFront) {
        await removeCardImageByPublicUrl(supabase, editing.image_front_url)
        nextFront = null
      }
      if (removeImageBack) {
        await removeCardImageByPublicUrl(supabase, editing.image_back_url)
        nextBack = null
      }
      if (imageFront) {
        await removeCardImageByPublicUrl(supabase, editing.image_front_url)
        nextFront = await uploadCardImageSide(supabase, user.id, editing.id, 'front', imageFront)
      }
      if (imageBack) {
        await removeCardImageByPublicUrl(supabase, editing.image_back_url)
        nextBack = await uploadCardImageSide(supabase, user.id, editing.id, 'back', imageBack)
      }

      const updates: Record<string, unknown> = {
        ...cardPayload,
        last_updated: new Date().toISOString(),
      }
      if (removeImageFront || imageFront) updates.image_front_url = nextFront
      if (removeImageBack || imageBack) updates.image_back_url = nextBack

      const { error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', editing.id)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
    }

    await loadCards({ silent: true })
  }

  async function estimateCard (card: Card, opts?: { forceRefresh?: boolean }): Promise<Card | null> {
    setLoadError(null)
    setEstimateErrors((prev) => ({ ...prev, [card.id]: null }))
    setRefreshingIds((prev) => ({ ...prev, [card.id]: true }))
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Missing auth session. Please sign in again.')
      }
      const est = await getCardValue(card, session.access_token, {
        force_refresh: opts?.forceRefresh === true,
      })
      if (est.error) {
        throw new Error(est.error)
      }
      const merged = mergeEstimateIntoCard(card, est)
      setCards((prev) => prev.map((entry) => (entry.id === card.id ? merged : entry)))
      return merged
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to estimate value.'
      setLoadError(msg)
      setEstimateErrors((prev) => ({ ...prev, [card.id]: msg }))
      return null
    } finally {
      setRefreshingIds((prev) => {
        const next = { ...prev }
        delete next[card.id]
        return next
      })
    }
  }

  async function handleDelete (c: Card) {
    if (!user) return
    const ok = window.confirm(`Remove "${c.player_name}" from your collection?`)
    if (!ok) return
    try {
      await removeCardImageByPublicUrl(supabase, c.image_front_url)
      await removeCardImageByPublicUrl(supabase, c.image_back_url)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not remove card images from storage.')
      return
    }
    const { error } = await supabase.from('cards').delete().eq('id', c.id).eq('user_id', user.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await loadCards({ silent: true })
  }

  async function refreshSingleCardValue (card: Card) {
    await estimateCard(card, { forceRefresh: true })
  }

  const hasCards = cards.length > 0
  const filterEmpty = hasCards && visibleCards.length === 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CollectionSubnav />
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
      {postAdd && (
        <div
          className={[
            'rounded-xl border p-4 transition-colors',
            !isFreeUser && postAdd.estimating
              ? 'border-slab-teal/50 bg-slab-teal/[0.12] shadow-[0_0_0_1px_rgba(45,212,191,0.12)]'
              : 'border-slab-teal/30 bg-slab-teal/10',
          ].join(' ')}
        >
          {isFreeUser ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slab-teal-light">Card added! Upgrade to Pro to get an instant AI market value estimate.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="rounded-lg bg-slab-teal px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-slab-teal-light"
                >
                  Upgrade to Pro
                </button>
                <button
                  type="button"
                  onClick={() => setPostAdd(null)}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  View Collection
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slab-teal-light">Card added! Get your instant value estimate.</p>
                <p className="mt-1 text-xs text-zinc-400">
                  {postAdd.estimating ? 'Searching recent sales...' : postAdd.done ? 'Estimate complete.' : 'Ready to estimate.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={postAdd.estimating}
                  onClick={() => {
                    const c = cards.find((x) => x.id === postAdd.cardId)
                    if (!c) return
                    setPostAdd((p) => (p ? { ...p, estimating: true } : p))
                    void (async () => {
                      await estimateCard(c, { forceRefresh: true })
                      setPostAdd((p) => (p ? { ...p, estimating: false, done: true } : p))
                    })()
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slab-teal px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-slab-teal-light disabled:opacity-50"
                >
                  {postAdd.estimating && (
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-900/25 border-t-zinc-950"
                      aria-hidden
                    />
                  )}
                  {postAdd.estimating ? 'Searching sales...' : 'Get Estimate Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setPostAdd(null)}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                >
                  View in Collection
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Sports cards</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Rookies, autos, and slabs — Pokémon lives in its own tab. Table or grid, filters, and AI values.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <button
            type="button"
            onClick={() => openAdd({ scan: true })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slab-teal px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-slab-teal/25 transition hover:bg-slab-teal-light sm:w-auto"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5A2.25 2.25 0 016 5.25h2.172c.597 0 1.17-.237 1.592-.659l.486-.486a2.25 2.25 0 011.592-.659h.316a2.25 2.25 0 011.592.659l.486.486a2.25 2.25 0 001.592.659H18A2.25 2.25 0 0120.25 7.5v9A2.25 2.25 0 0118 18.75H6a2.25 2.25 0 01-2.25-2.25v-9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            Scan & price card
          </button>
          <button
            type="button"
            onClick={() => openAdd({ scan: false })}
            className="text-xs text-zinc-400 hover:text-zinc-300"
          >
            Add manually instead
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-700 border-t-slab-teal"
            role="status"
            aria-label="Loading collection"
          />
        </div>
      ) : !hasCards ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-gradient-to-b from-[var(--color-surface-raised)] to-[var(--color-surface)] px-6 py-20 text-center sm:py-24">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slab-teal/10 ring-1 ring-slab-teal/25">
            <svg className="h-8 w-8 text-slab-teal/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v9m3-3.75h-3.75m3.75 3.75H21"
              />
            </svg>
          </div>
          <h2 className="mt-8 text-2xl font-semibold text-white">Add your first card</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Take a photo and AI identifies it automatically.
          </p>
          <button
            type="button"
            onClick={() => openAdd({ scan: true })}
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-slab-teal px-10 py-4 text-lg font-semibold text-zinc-950 shadow-lg shadow-slab-teal/25 transition hover:bg-slab-teal-light"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5A2.25 2.25 0 016 5.25h2.172c.597 0 1.17-.237 1.592-.659l.486-.486a2.25 2.25 0 011.592-.659h.316a2.25 2.25 0 011.592.659l.486.486a2.25 2.25 0 001.592.659H18A2.25 2.25 0 0120.25 7.5v9A2.25 2.25 0 0118 18.75H6a2.25 2.25 0 01-2.25-2.25v-9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
            Scan Your First Card
          </button>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => openAdd({ scan: false })}
              className="text-sm text-zinc-400 underline-offset-4 hover:text-zinc-300 hover:underline"
            >
              Add manually instead
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-4 py-2.5 text-xs leading-relaxed text-zinc-500">
            {AI_VALUE_DISCLAIMER}
          </p>
          <PortfolioSummaryBar
            metrics={portfolioMetrics}
            loading={false}
            money={money}
            pct={pctFormatter}
          />

          <CollectionToolbar
            sortBy={sortBy}
            onSortChange={setSortBy}
            sport={sport}
            onSportChange={setSport}
            sportOptions={sportOptions}
            gradeFilter={gradeFilter}
            onGradeFilterChange={setGradeFilter}
            gradingCompany={gradingCompany}
            onGradingCompanyChange={setGradingCompany}
            gradingCompanyOptions={gradingCompanyOptions}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {filterEmpty ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-6 py-12 text-center">
              <p className="text-zinc-200">No cards match your filters.</p>
              <p className="mt-2 text-sm text-zinc-500">Try widening sport, grade, or company filters.</p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Reset filters
              </button>
            </div>
          ) : viewMode === 'table' ? (
            <CollectionTableView
              cards={visibleCards}
              money={money}
              refreshingIds={refreshingIds}
              estimateErrors={estimateErrors}
              onRefresh={refreshSingleCardValue}
              onEdit={openEdit}
              onDelete={handleDelete}
              onViewImage={setImageModalCard}
              isFreeUser={isFreeUser}
              onUpgradeRequest={() => setUpgradeOpen(true)}
            />
          ) : (
            <CollectionGridView
              cards={visibleCards}
              money={money}
              refreshingIds={refreshingIds}
              estimateErrors={estimateErrors}
              onRefresh={refreshSingleCardValue}
              onEdit={openEdit}
              onDelete={handleDelete}
              onViewImage={setImageModalCard}
              isFreeUser={isFreeUser}
              onUpgradeRequest={() => setUpgradeOpen(true)}
            />
          )}
        </>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Upgrade to Pro"
        body="You've reached the 15 card limit on the free plan (sports + Pokémon combined). Pro includes unlimited cards, full AI (identify, pricing, daily insights), alerts, market values, trade tools, and tax export."
        ctaLabel="Get Pro"
        ctaLoading={upgradeLoading}
        onCta={() => {
          if (!session?.access_token) return
          setUpgradeLoading(true)
          void (async () => {
            try {
              const url = await createCheckoutSession(session.access_token, 'pro', '')
              window.location.href = url
            } catch (e) {
              window.alert(e instanceof Error ? e.message : 'Checkout failed.')
            } finally {
              setUpgradeLoading(false)
            }
          })()
        }}
      />

      <CardFormDialog
        open={dialogOpen}
        mode={dialogMode}
        scanMode={scanModeOpen}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
          setScanModeOpen(false)
        }}
        onSubmit={handleSubmit}
        isFreeUser={isFreeUser}
        onUpgradeRequest={() => setUpgradeOpen(true)}
      />

      <CardImageModal
        card={imageModalCard}
        open={imageModalCard != null}
        onClose={() => setImageModalCard(null)}
        money={money}
        refreshing={Boolean(imageModalCard && refreshingIds[imageModalCard.id])}
        isFreeUser={isFreeUser}
        onRefreshValue={(c) => void refreshSingleCardValue(c)}
        onUpgrade={() => setUpgradeOpen(true)}
      />
    </div>
  )
}
