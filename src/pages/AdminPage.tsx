import { useCallback, useEffect, useState } from 'react'

type PromoRow = {
  id: string
  code: string
  type: string
  value: number | null
  applicable_tier: string
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

type RedemptionRow = {
  id: string
  redeemed_at: string
  discount_applied: string
  code: string
  email: string
}

export function AdminPage () {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [codes, setCodes] = useState<PromoRow[]>([])
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [newCode, setNewCode] = useState('')
  const [newType, setNewType] = useState('percent_off')
  const [newValue, setNewValue] = useState('')
  const [newApplicable, setNewApplicable] = useState('any')
  const [newMaxUses, setNewMaxUses] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const checkSession = useCallback(async () => {
    const res = await fetch('/api/admin-login', { credentials: 'include' })
    const data = (await res.json()) as { authenticated?: boolean }
    setAuthenticated(Boolean(data.authenticated))
  }, [])

  useEffect(() => {
    document.title = 'Admin — SlabBook'
    void checkSession()
  }, [checkSession])

  const loadData = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch('/api/admin-promos', { credentials: 'include' }),
        fetch('/api/admin-redemptions', { credentials: 'include' }),
      ])
      if (!cRes.ok) {
        const e = (await cRes.json()) as { error?: string }
        throw new Error(e.error ?? 'Failed to load promos')
      }
      if (!rRes.ok) {
        const e = (await rRes.json()) as { error?: string }
        throw new Error(e.error ?? 'Failed to load redemptions')
      }
      const cJson = (await cRes.json()) as { codes: PromoRow[] }
      const rJson = (await rRes.json()) as { redemptions: RedemptionRow[] }
      setCodes(cJson.codes ?? [])
      setRedemptions(rJson.redemptions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authenticated) void loadData()
  }, [authenticated, loadData])

  async function handleLogin (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const j = (await res.json()) as { error?: string }
      setError(j.error ?? 'Login failed')
      return
    }
    setPassword('')
    setAuthenticated(true)
    await loadData()
  }

  async function handleLogout () {
    await fetch('/api/admin-login', { method: 'DELETE', credentials: 'include' })
    setAuthenticated(false)
    setCodes([])
    setRedemptions([])
  }

  async function toggleActive (id: string, is_active: boolean) {
    const res = await fetch('/api/admin-promos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    if (!res.ok) return
    await loadData()
  }

  async function handleCreate (e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/admin-promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code: newCode,
        type: newType,
        value: newValue === '' ? null : Number(newValue),
        applicable_tier: newApplicable,
        max_uses: newMaxUses === '' ? null : Number(newMaxUses),
        notes: newNotes || null,
      }),
    })
    if (!res.ok) {
      const j = (await res.json()) as { error?: string }
      setError(j.error ?? 'Create failed')
      return
    }
    setNewCode('')
    setNewValue('')
    setNewNotes('')
    await loadData()
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface)]">
        <p className="text-[var(--slab-text-muted)]">Loading…</p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-surface)] px-4">
        <h1 className="text-xl font-semibold text-[var(--slab-text)]">SlabBook Admin</h1>
        <form onSubmit={handleLogin} className="mt-6 w-full max-w-sm space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] px-3 py-2 text-[var(--slab-text)]"
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-slab-teal py-2 font-semibold text-zinc-950 hover:bg-slab-teal-light"
          >
            Sign in
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--color-surface)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-[var(--slab-text)]">Promo admin</h1>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 text-sm text-[var(--slab-text-muted)] hover:text-[var(--slab-text)]"
          >
            Log out
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <section className="mt-10">
          <h2 className="text-lg font-medium text-[var(--slab-text)]">Create promo code</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm uppercase"
              required
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm"
            >
              <option value="percent_off">percent_off</option>
              <option value="fixed_off">fixed_off</option>
              <option value="free_months">free_months</option>
              <option value="lifetime_free">lifetime_free</option>
            </select>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value (number)"
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm"
            />
            <select
              value={newApplicable}
              onChange={(e) => setNewApplicable(e.target.value)}
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm"
            >
              <option value="any">any</option>
              <option value="pro">pro</option>
              <option value="lifetime">lifetime</option>
            </select>
            <input
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
              placeholder="max uses (empty = unlimited)"
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm"
            />
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="notes"
              className="rounded border border-zinc-700 bg-[var(--color-surface)] px-2 py-2 text-sm sm:col-span-2"
            />
            <button type="submit" className="rounded-lg bg-slab-teal px-4 py-2 text-sm font-semibold text-zinc-950 sm:col-span-2 lg:col-span-1">
              Create
            </button>
          </form>
        </section>

        <section className="mt-12 overflow-x-auto">
          <h2 className="text-lg font-medium text-[var(--slab-text)]">Promo codes</h2>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--slab-text-muted)]">Loading…</p>
          ) : (
            <table className="mt-4 w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-[var(--slab-text-muted)]">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Value</th>
                  <th className="py-2 pr-2">Uses</th>
                  <th className="py-2 pr-2">Max</th>
                  <th className="py-2 pr-2">Expires</th>
                  <th className="py-2 pr-2">Active</th>
                  <th className="py-2"> </th>
                </tr>
              </thead>
              <tbody className="text-[var(--slab-text)]">
                {codes.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border-subtle)]/60">
                    <td className="py-2 pr-2 font-mono">{c.code}</td>
                    <td className="py-2 pr-2">{c.type}</td>
                    <td className="py-2 pr-2">{c.value ?? '—'}</td>
                    <td className="py-2 pr-2">{c.uses_count}</td>
                    <td className="py-2 pr-2">{c.max_uses ?? '∞'}</td>
                    <td className="py-2 pr-2 text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-2">{c.is_active ? 'yes' : 'no'}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void toggleActive(c.id, c.is_active)}
                        className="text-slab-teal hover:underline"
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-12 overflow-x-auto">
          <h2 className="text-lg font-medium text-[var(--slab-text)]">Recent redemptions</h2>
          <table className="mt-4 w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)] text-[var(--slab-text-muted)]">
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Date</th>
                <th className="py-2">Discount</th>
              </tr>
            </thead>
            <tbody className="text-[var(--slab-text)]">
              {redemptions.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border-subtle)]/60">
                  <td className="py-2 pr-2">{r.email}</td>
                  <td className="py-2 pr-2 font-mono">{r.code}</td>
                  <td className="py-2 pr-2 text-xs">{new Date(r.redeemed_at).toLocaleString()}</td>
                  <td className="py-2">{r.discount_applied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
