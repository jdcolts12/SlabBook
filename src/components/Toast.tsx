import { useEffect } from 'react'

type ToastProps = {
  message: string
  onDismiss: () => void
}

export function Toast ({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 3500)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[200] max-w-md -translate-x-1/2 rounded-xl border border-slab-teal/40 bg-zinc-900 px-4 py-3 text-sm text-slab-teal-muted shadow-xl shadow-black/50"
    >
      {message}
    </div>
  )
}
