export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-sky-400 text-slate-950 shadow-[0_8px_24px_rgba(82,167,255,0.2)]">
        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
          <path d="M3 13h3.2l1.8-4.2L11 17l2.3-5.2H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        </svg>
      </div>
      {!compact && <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-50">Pocket Pace</span>}
    </div>
  )
}
