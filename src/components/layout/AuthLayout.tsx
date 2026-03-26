import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../Logo'

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
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(52,211,153,0.15),transparent)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="mb-10 inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-lg"
        >
          <Logo />
        </Link>
        <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-8 shadow-xl shadow-black/40">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <div className="mt-8 text-center text-sm text-zinc-500">{footer}</div>
      </div>
    </div>
  )
}
