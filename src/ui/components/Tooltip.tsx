import { AnimatePresence, motion } from 'framer-motion'

interface TooltipProps {
  title: string
  body: string
  visible: boolean
  onDismiss: () => void
}

export function Tooltip({ title, body, visible, onDismiss }: TooltipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-lg border-2 border-amber-700 bg-amber-100 p-4 shadow-lg"
          onClick={onDismiss}
        >
          <p className="font-bold text-amber-900 text-sm uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-stone-800 text-sm leading-relaxed">{body}</p>
          <p className="mt-2 text-xs text-stone-500 text-right">tap to dismiss</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
