import { useEffect } from 'react'

type PlaceholderPageProps = {
  title: string
  documentTitle: string
  description: string
}

export function PlaceholderPage ({ title, documentTitle, description }: PlaceholderPageProps) {
  useEffect(() => {
    document.title = `${documentTitle} — SlabBook`
  }, [documentTitle])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-2 text-zinc-400">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed border-zinc-700 bg-[var(--color-surface-raised)]/50 p-12 text-center text-sm text-zinc-500">
        This section is ready for your MVP features.
      </div>
    </div>
  )
}
