// A tiny inline chip that triggers a tooltip on tap. Designed to sit
// next to jargon without drawing the eye when the player already knows
// the term.
export function TooltipChip({ trigger, onShow }: { trigger: string; onShow: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onShow(trigger) }}
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-300 text-[9px] font-bold text-stone-600 hover:bg-amber-300 hover:text-amber-900"
      aria-label={`Learn about ${trigger}`}
    >
      ?
    </button>
  )
}
