import { useState, useCallback } from 'react'
import { Tooltip } from '@/ui/components/Tooltip'
import { TOOLTIPS } from '@/data/tooltips'

const TOOLTIPS_BY_TRIGGER = Object.fromEntries(TOOLTIPS.map(t => [t.trigger, t]))

interface TooltipHostProps {
  seenTooltips: string[]
  markSeen: (id: string) => void
}

// A single mount point for term-explanation tooltips. Pass the trigger
// key (e.g. "dirt", "favorite") to `show`; a first-time explanation pops
// up and is marked seen so subsequent taps are a no-op for a while.
// Returns a `show(trigger)` callback the caller can wire onto "?" chips.
export function useTooltipHost({ seenTooltips, markSeen }: TooltipHostProps) {
  const [activeTrigger, setActiveTrigger] = useState<string | null>(null)

  const show = useCallback((trigger: string) => {
    const def = TOOLTIPS_BY_TRIGGER[trigger]
    if (!def) return
    setActiveTrigger(trigger)
    if (!seenTooltips.includes(def.id)) markSeen(def.id)
  }, [seenTooltips, markSeen])

  const active = activeTrigger ? TOOLTIPS_BY_TRIGGER[activeTrigger] : null

  const element = active ? (
    <Tooltip
      title={active.title}
      body={active.body}
      visible={activeTrigger !== null}
      onDismiss={() => setActiveTrigger(null)}
    />
  ) : null

  return { show, element }
}
