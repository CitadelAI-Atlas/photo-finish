import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface AnnouncerProps {
  lines: string[]
  speed?: number // ms per character
  onComplete?: () => void
}

export function Announcer({ lines, speed = 30, onComplete }: AnnouncerProps) {
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)

  // Reset the typewriter whenever the script changes — otherwise a new
  // set of lines would resume mid-word from where the previous one ended.
  // Done via "adjusting state while rendering" (React docs pattern) so
  // the reset happens before paint rather than in a cascading effect.
  const [prevLines, setPrevLines] = useState(lines)
  if (prevLines !== lines) {
    setPrevLines(lines)
    setLineIdx(0)
    setCharIdx(0)
  }

  const currentLine = lines[lineIdx] ?? ''
  const displayText = currentLine.slice(0, charIdx)

  useEffect(() => {
    if (charIdx < currentLine.length) {
      const timer = setTimeout(() => setCharIdx(c => c + 1), speed)
      return () => clearTimeout(timer)
    }
    // Line complete — wait then advance
    if (lineIdx < lines.length - 1) {
      const timer = setTimeout(() => {
        setLineIdx(i => i + 1)
        setCharIdx(0)
      }, 800)
      return () => clearTimeout(timer)
    }
    // All lines complete
    if (onComplete) {
      const timer = setTimeout(onComplete, 1000)
      return () => clearTimeout(timer)
    }
  }, [charIdx, currentLine.length, lineIdx, lines.length, speed, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded border border-stone-600 bg-stone-900 px-3 py-2"
    >
      <p className="font-mono text-sm text-green-400 min-h-[2.5rem] leading-relaxed">
        {displayText}
        <span className="animate-pulse">_</span>
      </p>
    </motion.div>
  )
}
