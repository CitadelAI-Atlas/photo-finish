import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'

// Surface invisible bankroll events (stipend, card-complete bonus) as
// dismissable toasts. Without this, the player sees their balance move
// and has to guess why.
//
// Auto-dismiss after AUTO_DISMISS_MS; also clickable. The store owns
// the queue so any future engine event (achievement unlock, tier up)
// can push onto it without touching UI plumbing.

const AUTO_DISMISS_MS = 4500

export function Toasts() {
  const notifications = useGameStore(s => s.pendingNotifications)
  const consume = useGameStore(s => s.consumeNotification)

  useEffect(() => {
    if (notifications.length === 0) return
    const timers = notifications.map(n =>
      setTimeout(() => consume(n.id), AUTO_DISMISS_MS),
    )
    return () => { for (const t of timers) clearTimeout(t) }
  }, [notifications, consume])

  return (
    <div className="fixed top-3 left-0 right-0 z-50 flex flex-col items-center gap-2 px-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.button
            key={n.id}
            layout
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            onClick={() => consume(n.id)}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border-2 px-3 py-2 text-left shadow-lg ${
              n.tone === 'stipend'
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-green-500 bg-green-50 text-green-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                {n.tone === 'stipend' ? 'Stipend' : 'Bonus'}
              </span>
              <span className="text-[10px] opacity-50">tap to dismiss</span>
            </div>
            <p className="text-sm font-medium leading-snug mt-0.5">{n.message}</p>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
