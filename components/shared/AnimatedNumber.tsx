/**
 * FILE: components/shared/AnimatedNumber.tsx
 *
 * WHAT THIS DOES:
 *   Counts a number up from 0 to its value on mount using rAF (600ms
 *   ease-out cubic). Renders instantly under prefers-reduced-motion.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Used by StatCard, the dashboard hero, and landing page number band.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/reports/StatCard.tsx, app/(dashboard)/dashboard/page.tsx
 */
"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  value: number
  format?: (n: number) => string
  durationMs?: number
  className?: string
}

export function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString("en-IN"),
  durationMs = 600,
  className = "",
}: Props) {
  const [display, setDisplay] = useState<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value)
      return
    }
    let raf: number
    startRef.current = null
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const p = Math.min((ts - startRef.current) / durationMs, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(value * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  // Render final value during SSR/first paint to avoid layout shift
  const shown = display === null ? value : Math.round(display)
  return <span className={`tabular-nums ${className}`}>{format(shown)}</span>
}
