import { AnimatePresence, motion } from 'framer-motion'

interface AchievementToastProps {
  title: string
  visible: boolean
}

export function AchievementToast({ title, visible }: AchievementToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed top-4 inset-x-4 z-50 mx-auto max-w-sm rounded-lg border-2 border-yellow-600 bg-yellow-100 px-4 py-3 text-center shadow-lg"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-700">Achievement Unlocked</p>
          <p className="mt-1 text-sm font-bold text-yellow-900">{title}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
