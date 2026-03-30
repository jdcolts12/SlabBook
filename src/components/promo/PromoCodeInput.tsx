import { useEffect, useRef, useState } from 'react'
import { validatePromoRequest } from '../../lib/promoApi'

type Props = {
  value: string
  onChange: (value: string) => void
  tier?: string
  userId?: string | null
  id?: string
  placeholder?: string
}

export function PromoCodeInput ({
  value,
  onChange,
  tier,
  userId,
  id = 'promo-code',
  placeholder = 'Enter code',
}: Props) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      const clear = window.setTimeout(() => {
        setStatus('idle')
        setMessage(null)
      }, 0)
      return () => clearTimeout(clear)
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setStatus('checking')
      setMessage(null)
      void (async () => {
        const res = await validatePromoRequest(trimmed, { tier, userId })
        if (!trimmed || value.trim() !== trimmed) return
        if (res.valid) {
          setStatus('valid')
          setMessage(res.message)
        } else {
          setStatus('invalid')
          const err = typeof res.error === 'string' ? res.error.trim() : ''
          const generic = /^error$/i.test(err)
          setMessage(err && !generic ? err : 'Invalid code')
        }
      })()
    }, 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, tier, userId])

  return (
    <div className="space-y-1.5">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm uppercase tracking-wide text-[var(--slab-text)] placeholder:text-[var(--slab-text-muted)] focus:border-slab-teal/50 focus:outline-none focus:ring-2 focus:ring-slab-teal/20"
      />
      {status === 'checking' && value.trim() && (
        <p className="text-xs text-[var(--slab-text-muted)]">Checking…</p>
      )}
      {status === 'valid' && message && (
        <p className="flex items-center gap-1.5 text-xs text-slab-teal-light">
          <span className="text-base leading-none" aria-hidden>
            ✓
          </span>
          {message}
        </p>
      )}
      {status === 'invalid' && message && (
        <p className="text-xs text-red-400" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
