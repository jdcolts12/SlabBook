import { useCallback, useId, useRef, useState, type DragEvent } from 'react'
import { validateCardImageFile } from '../../lib/cardImageStorage'

type Props = {
  label: string
  description?: string
  file: File | null
  existingUrl: string | null
  previewUrl: string | null
  onFile: (file: File | null) => void
  onRemove: () => void
  disabled?: boolean
}

export function CardPhotoDropzone ({
  label,
  description = 'JPG, PNG, or WEBP · max 5MB',
  file,
  existingUrl,
  previewUrl,
  onFile,
  onRemove,
  disabled,
}: Props) {
  const inputId = useId()
  const cameraInputId = `${inputId}-camera`
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const showPreview = previewUrl

  const applyFile = useCallback(
    (f: File | null) => {
      setLocalError(null)
      if (!f) {
        onFile(null)
        return
      }
      const err = validateCardImageFile(f)
      if (err) {
        setLocalError(err)
        return
      }
      onFile(f)
    },
    [onFile],
  )

  function onDrop (e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) applyFile(f)
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-sm font-medium text-zinc-300">{label}</p>
      <div
        role="group"
        aria-label={label}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-4 transition',
          dragOver ? 'border-slab-teal/60 bg-slab-teal/5' : 'border-zinc-600/80 bg-zinc-900/30',
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        {showPreview ? (
          <div className="relative w-full max-w-[200px]">
            <img
              src={showPreview}
              alt=""
              className="mx-auto max-h-36 w-auto rounded-lg object-contain ring-1 ring-zinc-700"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => {
                  setLocalError(null)
                  onRemove()
                }}
                className="absolute -right-1 -top-1 rounded-full bg-zinc-900 p-1 text-zinc-400 shadow ring-1 ring-zinc-600 hover:bg-red-500/20 hover:text-red-200"
                aria-label={`Remove ${label}`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <p className="text-center text-xs text-zinc-500">Drop an image or browse</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              applyFile(f)
              e.target.value = ''
            }}
          />
          <label
            htmlFor={inputId}
            className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
          >
            Browse
          </label>
          <input
            ref={cameraRef}
            id={cameraInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              applyFile(f)
              e.target.value = ''
            }}
          />
          <label
            htmlFor={cameraInputId}
            className="cursor-pointer rounded-lg border border-zinc-600/80 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/5 sm:hidden"
          >
            Take photo
          </label>
        </div>
      </div>
      <p className="text-[11px] text-zinc-600">{description}</p>
      {localError && <p className="text-xs text-red-400">{localError}</p>}
      {existingUrl && !file && (
        <a
          href={existingUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-slab-teal hover:text-slab-teal-light"
        >
          Open current image in new tab
        </a>
      )}
    </div>
  )
}
