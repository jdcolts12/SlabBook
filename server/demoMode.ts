/** True when SlabBook should not call Anthropic (saves credits during dev). */
export function isDemoMode (): boolean {
  const v = process.env.DEMO_MODE?.trim().toLowerCase()
  const v2 = process.env.VITE_DEMO_MODE?.trim().toLowerCase()
  return v === 'true' || v === '1' || v2 === 'true' || v2 === '1'
}
