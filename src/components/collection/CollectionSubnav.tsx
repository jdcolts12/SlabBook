import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/dashboard/collection', label: 'Sports', end: true as boolean },
  { to: '/dashboard/collection/pokemon', label: 'Pokémon TCG', end: false },
  { to: '/dashboard/collection/all', label: 'All cards', end: false },
] as const

export function CollectionSubnav () {
  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-[var(--color-border-subtle)] pb-3"
      aria-label="Collection areas"
    >
      {tabs.map(({ to, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              'rounded-lg px-3 py-2 text-sm font-medium transition',
              isActive
                ? 'bg-slab-teal/20 text-slab-teal-muted ring-1 ring-slab-teal/30'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            ].join(' ')
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
