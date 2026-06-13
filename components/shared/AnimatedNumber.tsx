/**
 * FILE: components/shared/AnimatedNumber.tsx
 *
 * WHAT THIS DOES:
 *   Counts a number up from 0 to its value on mount using rAF (600ms
 *   ease-out cubic). Renders instantly under prefers-reduced-motion.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *   - Fix: accept string format presets ("inr", "inr-compact") so server
 *     components can use it - functions can't cross the RSC boundary
 *
 * WHERE IT FITS:
 *   Used by StatCard, the dashboard hero, and landing page number band.
 *   Server components MUST pass a string preset; function formats are
 *   only legal when the caller is itself a client component.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/reports/StatCard.tsx, app/(dashboard)/dashboard/page.tsx
 */
"use client"

import { useEffect, useRef, useState } from "react"

type FormatPreset = "plain" | "inr" | "inr-compact"

interface Props {
  value: number
  format?: FormatPreset | ((n: number) => string)
  durationMs?: number
  className?: string
}

function compactINR(n: number): string {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toLocaleString("en-IN")}`
}

function resolveFormat(
  format: FormatPreset | ((n: number) => string) | undefined
): (n: number) => string {
  if (typeof format === "function") return format
  if (format === "inr") return (n) => `₹${n.toLocaleString("en-IN")}`
  if (format === "inr-compact") return compactINR
  return (n) => n.toLocaleString("en-IN")
}

export function AnimatedNumber({
  value,
  format,
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

  const fmt = resolveFormat(format)
  // Render final value during SSR/first paint to avoid layout shift
  const shown = display === null ? value : Math.round(display)
  return <span className={`tabular-nums ${className}`}>{fmt(shown)}</span>
}
