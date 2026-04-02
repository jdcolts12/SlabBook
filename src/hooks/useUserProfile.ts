import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UserPlanFields } from '../lib/tierLimits'

export function useUserProfile (userId: string | undefined) {
  const [profile, setProfile] = useState<UserPlanFields | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (opts?: { quiet?: boolean }): Promise<UserPlanFields | null> => {
    if (!userId) {
      setProfile(null)
      if (!opts?.quiet) setLoading(false)
      return null
    }
    if (!opts?.quiet) setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select(
        'subscription_tier, subscription_status, lifetime_access, trial_ends_at, subscription_ends_at, stripe_customer_id, subscription_id, current_period_end, promo_code_used',
      )
      .eq('id', userId)
      .maybeSingle()
    let row: UserPlanFields | null = null
    if (error) {
      setProfile(null)
    } else {
      row = (data ?? null) as UserPlanFields | null
      setProfile(row)
    }
    if (!opts?.quiet) setLoading(false)
    return row
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`user-profile-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        () => {
          void load({ quiet: true })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  return { profile, loading, refresh: load }
}
