import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
} from '../lib/cardImageStorage'
import { supabase } from '../lib/supabase'
import { AI_VALUE_DISCLAIMER } from '../lib/aiValueCopy'
import { mergeEstimateIntoCard } from '../lib/estimateCardValueApi'
import { getCardValue } from '../lib/pricing-service'
import { createCheckoutSession } from '../lib/stripeApi'
import { effectiveTier, maxCardsForUser } from '../lib/tierLimits'
import type { Card } from '../types/card'

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
  return {
    user_id: userId,
    sport: v.sport,
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
    value_low: null,
    value_high: null,
    confidence: null,
    trend: null,
    value_note: null,
    pricing_source: null,
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
  const { user, session } = useAuth()
  const { profile } = useUserProfile(user?.id)
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Record<string, boolean>>({})

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
    document.title = 'Collection — SlabBook'
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

  function openAdd () {
    const cap = maxCardsForUser(profile)
    if (cards.length >= cap) {
      setUpgradeOpen(true)
      return
    }
    setDialogMode('add')
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit (c: Card) {
    setDialogMode('edit')
    setEditing(c)
    setDialogOpen(true)
  }

  async function handleSubmit (submit: CardFormSubmitPayload) {
    if (!user) throw new Error('Not signed in.')
    const {
      values,
      draftCardId,
      imageFront,
      imageBack,
      removeImageFront,
      removeImageBack,
    } = submit
    const payload = formValuesToPayload(user.id, values)

    if (dialogMode === 'add') {
      const cap = maxCardsForUser(profile)
      if (cards.length >= cap) {
        setUpgradeOpen(true)
        throw new Error('Collection limit reached. Upgrade to add more cards.')
      }
      const { data: row, error } = await supabase
        .from('cards')
        .insert({
          id: draftCardId,
          ...payload,
          image_front_url: null,
          image_back_url: null,
          last_updated: new Date().toISOString(),
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)

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

      setToastMessage('Card added to your collection.')
      await loadCards({ silent: true })
      void estimateCard(row as Card, { forceRefresh: true })
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
        ...payload,
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

  async function estimateCard (card: Card, opts?: { forceRefresh?: boolean }) {
    setLoadError(null)
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
      setCards((prev) => prev.map((entry) => (entry.id === card.id ? mergeEstimateIntoCard(entry, est) : entry)))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to estimate value.')
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
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Collection</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Portfolio, filters, and market values — switch between table and grid anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slab-teal px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-slab-teal-light"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add card
        </button>
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
          <h2 className="mt-8 text-xl font-semibold text-white">Start your slab collection</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Add your first card to track purchase price, grading, and live comps. Your portfolio summary and
            gain/loss will show up here automatically.
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-xl bg-slab-teal px-8 py-3.5 text-base font-semibold text-zinc-950 shadow-lg shadow-slab-teal/20 transition hover:bg-slab-teal-light"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add your first card
          </button>
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
              onRefresh={refreshSingleCardValue}
              onEdit={openEdit}
              onDelete={handleDelete}
              onViewImage={setImageModalCard}
            />
          ) : (
            <CollectionGridView
              cards={visibleCards}
              money={money}
              refreshingIds={refreshingIds}
              onRefresh={refreshSingleCardValue}
              onEdit={openEdit}
              onDelete={handleDelete}
              onViewImage={setImageModalCard}
            />
          )}
        </>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={effectiveTier(profile) === 'collector' ? 'Upgrade to Investor' : 'Upgrade to Collector'}
        body={
          effectiveTier(profile) === 'collector'
            ? "You've reached the 500 card limit on the Collector plan. Upgrade to Investor for unlimited cards, daily AI insights, and tax export."
            : "You've reached the 15 card limit on the free plan. Upgrade to track up to 500 cards, get AI insights, and live price estimates."
        }
        ctaLabel={effectiveTier(profile) === 'collector' ? 'Upgrade for $12/mo' : 'Upgrade for $5/mo'}
        ctaLoading={upgradeLoading}
        onCta={() => {
          if (!session?.access_token) return
          setUpgradeLoading(true)
          void (async () => {
            try {
              const tier = effectiveTier(profile) === 'collector' ? 'investor' : 'collector'
              const url = await createCheckoutSession(session.access_token, tier, '')
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
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />

      <CardImageModal
        card={imageModalCard}
        open={imageModalCard != null}
        onClose={() => setImageModalCard(null)}
      />
    </div>
  )
}
