import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UserPlanFields } from '../lib/tierLimits'

export function useUserProfile (userId: string | undefined) {
  const [profile, setProfile] = useState<UserPlanFields | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select(
        'subscription_tier, subscription_status, lifetime_access, trial_ends_at, subscription_ends_at, stripe_customer_id, subscription_id, current_period_end, promo_code_used',
      )
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      setProfile(null)
    } else {
      setProfile(data as UserPlanFields)
    }
    setLoading(false)
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
          void load()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, load])

  return { profile, loading, refresh: load }
}
