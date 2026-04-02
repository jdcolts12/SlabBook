import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CollectionSubnav } from '../components/collection/CollectionSubnav'
import {
  PokemonCardFormDialog,
  type PokemonFormSubmitPayload,
} from '../components/collection/PokemonCardFormDialog'
import { PokemonImageModal } from '../components/collection/PokemonImageModal'
import { PortfolioSummaryBar } from '../components/collection/PortfolioSummaryBar'
import { Toast } from '../components/Toast'
import { UpgradeModal } from '../components/billing/UpgradeModal'
import { fetchTotalCardCount } from '../lib/collectionCounts'
import { computePortfolioMetrics } from '../lib/cardMetrics'
import { moneyFormatter, pctFormatter } from '../lib/formatters'
import { removeCardImageByPublicUrl, uploadPokemonCardImageSide } from '../lib/cardImageStorage'
import { createCheckoutSession } from '../lib/stripeApi'
import { maxCardsForUser } from '../lib/tierLimits'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import type { PokemonCard } from '../types/pokemonCard'

const money = moneyFormatter

function parseOptionalNumber (raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number.parseFloat(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

type PokemonWritable = Omit<PokemonCard, 'id' | 'created_at' | 'image_front_url' | 'image_back_url'>

function formToPayload (userId: string, v: PokemonFormSubmitPayload['values']): PokemonWritable {
  return {
    user_id: userId,
    pokemon_name: v.pokemon_name.trim(),
    language: v.language,
    set_name: v.set_name.trim() || null,
    card_number: v.card_number.trim() || null,
    variation: v.variation.trim() || null,
    is_graded: v.is_graded,
    grade: v.is_graded && v.grade.trim() ? v.grade.trim() : null,
    grading_company: v.is_graded && v.grading_company.trim() ? v.grading_company.trim() : null,
    condition: v.is_graded ? null : v.condition.trim() || null,
    purchase_price: parseOptionalNumber(v.purchase_price),
    purchase_date: v.purchase_date.trim() || null,
    current_value: parseOptionalNumber(v.current_value),
  }
}

export function PokemonCollectionPage () {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, session } = useAuth()
  const { refresh: refreshProfile } = useUserProfile(user?.id)
  const [cards, setCards] = useState<PokemonCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<PokemonCard | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [imageModalCard, setImageModalCard] = useState<PokemonCard | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  const loadCards = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('pokemon_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(error.message)
        setCards([])
      } else {
        setCards((data ?? []) as PokemonCard[])
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    document.title = 'Pokémon collection — SlabBook'
  }, [])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  useEffect(() => {
    const raw = location.state as Record<string, unknown> | null
    const editId =
      raw && typeof raw.editPokemonCardId === 'string' ? raw.editPokemonCardId : null
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
      .channel(`collection-pokemon-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pokemon_cards',
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

  const portfolioMetrics = useMemo(() => {
    const shim = cards.map((c) => ({
      id: c.id,
      user_id: c.user_id,
      sport: null,
      player_name: c.pokemon_name,
      year: null,
      set_name: c.set_name,
      card_number: c.card_number,
      variation: c.variation,
      is_graded: c.is_graded,
      grade: c.grade,
      grading_company: c.grading_company,
      condition: c.condition,
      image_front_url: c.image_front_url,
      image_back_url: c.image_back_url,
      purchase_price: c.purchase_price,
      purchase_date: c.purchase_date,
      current_value: c.current_value,
      value_low: null,
      value_high: null,
      confidence: null,
      trend: null,
      value_note: null,
      pricing_source: null,
      last_updated: null,
      created_at: c.created_at,
    }))
    return computePortfolioMetrics(shim)
  }, [cards])

  async function openAdd () {
    if (!user) return
    const plan = await refreshProfile({ quiet: true })
    const cap = maxCardsForUser(plan)
    if (!Number.isFinite(cap)) {
      setDialogMode('add')
      setEditing(null)
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
    setDialogOpen(true)
  }

  function openEdit (c: PokemonCard) {
    setDialogMode('edit')
    setEditing(c)
    setDialogOpen(true)
  }

  async function handleSubmit (submit: PokemonFormSubmitPayload) {
    if (!user) throw new Error('Not signed in.')
    const {
      values,
      draftCardId,
      imageFront,
      imageBack,
      removeImageFront,
      removeImageBack,
    } = submit
    const payload = formToPayload(user.id, values)

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
      const { error } = await supabase
        .from('pokemon_cards')
        .insert({
          id: draftCardId,
          ...payload,
          image_front_url: null,
          image_back_url: null,
        })
        .select('*')
        .single()
      if (error) throw new Error(error.message)

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

      setToastMessage('Pokémon card added.')
      await loadCards({ silent: true })
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
        nextFront = await uploadPokemonCardImageSide(
          supabase,
          user.id,
          editing.id,
          'front',
          imageFront,
        )
      }
      if (imageBack) {
        await removeCardImageByPublicUrl(supabase, editing.image_back_url)
        nextBack = await uploadPokemonCardImageSide(
          supabase,
          user.id,
          editing.id,
          'back',
          imageBack,
        )
      }

      const updates: Record<string, unknown> = {
        ...payload,
        ...(removeImageFront || imageFront ? { image_front_url: nextFront } : {}),
        ...(removeImageBack || imageBack ? { image_back_url: nextBack } : {}),
      }

      const { error } = await supabase
        .from('pokemon_cards')
        .update(updates)
        .eq('id', editing.id)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
    }

    await loadCards({ silent: true })
  }

  async function handleDelete (c: PokemonCard) {
    if (!user) return
    const ok = window.confirm(`Remove "${c.pokemon_name}" from your Pokémon collection?`)
    if (!ok) return
    try {
      await removeCardImageByPublicUrl(supabase, c.image_front_url)
      await removeCardImageByPublicUrl(supabase, c.image_back_url)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not remove images from storage.')
      return
    }
    const { error } = await supabase.from('pokemon_cards').delete().eq('id', c.id).eq('user_id', user.id)
    if (error) {
      window.alert(error.message)
      return
    }
    await loadCards({ silent: true })
  }

  const hasCards = cards.length > 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <CollectionSubnav />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Pokémon TCG
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            English and Japanese slabs — separate from your sports collection. Values are manual for now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void openAdd()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slab-teal px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-slab-teal/25 transition hover:bg-slab-teal-light sm:w-auto"
        >
          Add Pokémon card
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
            aria-label="Loading"
          />
        </div>
      ) : !hasCards ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-gradient-to-b from-[var(--color-surface-raised)] to-[var(--color-surface)] px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-white">No Pokémon cards yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Track PSA, CGC, and other slabs here — kept apart from sports cards.
          </p>
          <button
            type="button"
            onClick={() => void openAdd()}
            className="mt-8 rounded-xl bg-slab-teal px-8 py-3 text-sm font-semibold text-zinc-950 hover:bg-slab-teal-light"
          >
            Add your first card
          </button>
        </div>
      ) : (
        <>
          <PortfolioSummaryBar
            metrics={portfolioMetrics}
            loading={false}
            money={money}
            pct={pctFormatter}
          />

          <div className="overflow-x-auto rounded-xl border border-[var(--color-border-subtle)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Lang</th>
                  <th className="px-4 py-3 font-medium">Set / #</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {cards.map((c) => (
                  <tr key={c.id} className="bg-[var(--color-surface-raised)]/40 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {(c.image_front_url || c.image_back_url) && (
                          <img
                            src={c.image_front_url?.trim() || c.image_back_url?.trim() || ''}
                            alt={`${c.pokemon_name} photo`}
                            className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-zinc-700/60"
                            loading="lazy"
                          />
                        )}
                        <span className="min-w-0 truncate font-medium text-white">{c.pokemon_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{c.language === 'jp' ? 'JP' : 'EN'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-400">
                      {[c.set_name, c.card_number].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {c.is_graded
                        ? [c.grading_company, c.grade].filter(Boolean).join(' ') || 'Graded'
                        : c.condition || 'Raw'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                      {c.current_value != null ? money.format(Number(c.current_value)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(c.image_front_url || c.image_back_url) && (
                          <button
                            type="button"
                            onClick={() => setImageModalCard(c)}
                            className="text-xs font-medium text-slab-teal hover:text-slab-teal-light"
                          >
                            Photos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-xs font-medium text-zinc-400 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c)}
                          className="text-xs font-medium text-red-400/90 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Upgrade to Pro"
        body="You've reached the 15 card limit on the free plan (sports + Pokémon combined). Pro includes unlimited cards and full AI features."
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

      <PokemonCardFormDialog
        open={dialogOpen}
        mode={dialogMode}
        initial={editing}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />

      <PokemonImageModal
        card={imageModalCard}
        open={imageModalCard != null}
        onClose={() => setImageModalCard(null)}
      />
    </div>
  )
}
