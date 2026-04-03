/**
 * Downscale and JPEG-encode for vision API calls (keeps request size within typical serverless limits).
 * Default longest edge 1000px matches `/api/identify-card` server resize cap for Anthropic cost control.
 */
export async function compressImageForVision (
  file: File,
  maxEdge = 1000,
  quality = 0.82,
): Promise<{ base64: string; media_type: 'image/jpeg' }> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare image.')
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not compress image.'))),
        'image/jpeg',
        quality,
      )
    })
    const base64 = await blobToBase64(blob)
    return { base64, media_type: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

function blobToBase64 (blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = reader.result as string
      const comma = s.indexOf(',')
      resolve(comma >= 0 ? s.slice(comma + 1) : s)
    }
    reader.onerror = () => reject(new Error('Could not read image.'))
    reader.readAsDataURL(blob)
  })
}
