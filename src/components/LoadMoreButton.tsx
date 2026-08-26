export function LoadMoreButton({ shown, total, onClick }: { shown: number; total: number; onClick: () => void }) {
  if (shown >= total) return null
  return <button className="button-secondary mt-3 w-full" onClick={onClick} type="button">Show more <span className="text-xs font-normal text-slate-500">{shown} of {total}</span></button>
}
