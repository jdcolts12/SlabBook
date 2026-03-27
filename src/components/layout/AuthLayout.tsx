import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SlabBookLogo } from '../SlabBookLogo'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout ({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--color-surface)] px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,color-mix(in_srgb,var(--slab-teal)_15%,transparent),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Link
            to="/"
            className="inline-flex rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-slab-teal/50"
          >
            <SlabBookLogo size="lg" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-8 shadow-xl shadow-black/40">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--slab-text)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--slab-text-muted)]">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="mt-8 text-center text-sm text-[var(--slab-text-muted)]">{footer}</div>
      </div>
    </div>
  )
}
