import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-[1.5rem] border border-white/[0.07] bg-slate-900/70 px-5 py-8 text-center shadow-card">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-800 text-sky-300">{icon}</div>
      <h2 className="mt-4 text-base font-semibold tracking-[-0.02em] text-slate-100">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-5 text-slate-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
