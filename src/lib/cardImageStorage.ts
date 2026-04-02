import type { SupabaseClient } from '@supabase/supabase-js'

export const CARD_IMAGES_BUCKET = 'card-images'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateCardImageFile (file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return 'Use a JPG, PNG, or WEBP image.'
  }
  if (file.size > MAX_BYTES) {
    return 'Each image must be 5MB or smaller.'
  }
  return null
}

export function extForMime (mime: string): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  throw new Error('Unsupported image type')
}

export function cardImageObjectPath (
  userId: string,
  cardId: string,
  side: 'front' | 'back',
  ext: string,
): string {
  return `${userId}/${cardId}-${side}.${ext}`
}

/** Same bucket; distinct prefix so paths never collide with sports card IDs. */
export function pokemonCardImageObjectPath (
  userId: string,
  cardId: string,
  side: 'front' | 'back',
  ext: string,
): string {
  return `${userId}/pokemon-${cardId}-${side}.${ext}`
}

export function watchlistImageObjectPath (userId: string, watchlistItemId: string, ext: string): string {
  return `${userId}/watchlist-${watchlistItemId}-front.${ext}`
}

export async function uploadWatchlistImageFront (
  supabase: SupabaseClient,
  userId: string,
  watchlistItemId: string,
  file: File,
): Promise<string> {
  const err = validateCardImageFile(file)
  if (err) throw new Error(err)
  const ext = extForMime(file.type)
  const path = watchlistImageObjectPath(userId, watchlistItemId, ext)
  return uploadToCardImagesBucket(supabase, path, file)
}

export function parseCardImagePathFromPublicUrl (url: string): string | null {
  const marker = `/object/public/${CARD_IMAGES_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

export async function uploadCardImageSide (
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  side: 'front' | 'back',
  file: File,
): Promise<string> {
  const err = validateCardImageFile(file)
  if (err) throw new Error(err)
  const ext = extForMime(file.type)
  const path = cardImageObjectPath(userId, cardId, side, ext)
  return uploadToCardImagesBucket(supabase, path, file)
}

export async function uploadPokemonCardImageSide (
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  side: 'front' | 'back',
  file: File,
): Promise<string> {
  const err = validateCardImageFile(file)
  if (err) throw new Error(err)
  const ext = extForMime(file.type)
  const path = pokemonCardImageObjectPath(userId, cardId, side, ext)
  return uploadToCardImagesBucket(supabase, path, file)
}

async function uploadToCardImagesBucket (
  supabase: SupabaseClient,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage.from(CARD_IMAGES_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(CARD_IMAGES_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function removeCardImageByPublicUrl (
  supabase: SupabaseClient,
  url: string | null | undefined,
): Promise<void> {
  if (!url?.trim()) return
  const path = parseCardImagePathFromPublicUrl(url)
  if (!path) return
  const { error } = await supabase.storage.from(CARD_IMAGES_BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
