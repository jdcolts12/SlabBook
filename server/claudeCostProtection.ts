import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoMode } from './demoMode'

const DEFAULT_CAP = 50

function dailyCap (): number {
  const raw = process.env.CLAUDE_DAILY_CAP?.trim()
  if (!raw) return DEFAULT_CAP
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP
}

function utcDayStartIso (): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString()
}

/**
 * Reserve one Claude call slot for the current UTC day. Returns blocked if at/over cap.
 * Inserts a row before the outbound API call so retries/loops count attempts.
 */
export async function tryReserveClaudeCall (
  admin: SupabaseClient,
  route: string,
): Promise<{ ok: true } | { ok: false; reason: 'cap' }> {
  if (isDemoMode()) {
    return { ok: true }
  }

  const cap = dailyCap()
  const since = utcDayStartIso()

  const { count, error: countErr } = await admin
    .from('claude_api_calls')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)

  if (countErr) {
    console.error('[claude cap] count failed', countErr.message)
    return { ok: true }
  }

  const n = count ?? 0
  if (n >= cap) {
    console.warn(
      `[claude cap] Daily limit reached (${n}/${cap} since ${since}). Route would be: ${route}`,
    )
    void sendCapAlertEmailIfNeeded(admin)
    return { ok: false, reason: 'cap' }
  }

  const { error: insErr } = await admin.from('claude_api_calls').insert({ route })
  if (insErr) {
    console.error('[claude cap] insert failed', insErr.message)
    return { ok: true }
  }

  return { ok: true }
}

async function sendCapAlertEmailIfNeeded (admin: SupabaseClient): Promise<void> {
  const to = process.env.ALERT_EMAIL?.trim() || process.env.CLAUDE_CAP_ALERT_EMAIL?.trim()
  if (!to) return

  const day = new Date().toISOString().slice(0, 10)

  const { data: existing } = await admin.from('claude_cap_alert_sent').select('day').eq('day', day).maybeSingle()

  if (existing) return

  const { error: insErr } = await admin.from('claude_cap_alert_sent').insert({ day })
  if (insErr) {
    if ((insErr as { code?: string }).code === '23505') return
    console.warn('[claude cap] could not record alert row', insErr.message)
    return
  }

  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.warn('[claude cap] ALERT_EMAIL set but RESEND_API_KEY missing — cannot send email')
    return
  }

  const from = process.env.RESEND_FROM?.trim() ?? 'SlabBook <onboarding@resend.dev>'
  const cap = dailyCap()
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `SlabBook — Claude daily cap reached (${cap}/day)`,
      text: `The app hit ${cap} Claude API calls today (UTC) and is blocking further calls until tomorrow.\n\nCheck logs for loops or bugs.\n\n— SlabBook`,
    }),
  }).catch((e) => {
    console.warn('[claude cap] Resend fetch failed', e)
    return null
  })

  if (res && !res.ok) {
    const t = await res.text().catch(() => '')
    console.warn('[claude cap] Resend error', res.status, t)
  }
}
