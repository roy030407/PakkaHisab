/**
 * FILE: components/landing/LandingReveal.tsx
 *
 * WHAT THIS DOES:
 *   Client-side motion controller for the landing page. Renders nothing.
 *   Handles three behaviours, all respecting prefers-reduced-motion:
 *     1. Scroll reveal: adds .revealed to [data-reveal] when it enters view.
 *     2. Count-up: animates [data-countup] numbers from 0 to their target
 *        when first revealed (supports prefix/suffix and decimals).
 *     3. Mouse parallax: nudges [data-parallax] elements (the hero floaters)
 *        toward the pointer for a subtle depth effect.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Playful Bazaar landing page
 *   - Mythos pass: added count-up stat animation and mouse parallax
 *
 * WHERE IT FITS:
 *   The only client component on the public landing page. CSS in
 *   globals.css ([data-reveal], .parallax) does the visual work.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/page.tsx
 */
"use client"

import { useEffect } from "react"

export function LandingReveal() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // ── 1 + 2. Reveal + count-up ──────────────────────────────
    const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]")

    function runCountUp(el: HTMLElement) {
      const target = parseFloat(el.dataset.countupTo ?? "")
      if (Number.isNaN(target)) return
      const decimals = parseInt(el.dataset.countupDecimals ?? "0", 10)
      const prefix = el.dataset.countupPrefix ?? ""
      const suffix = el.dataset.countupSuffix ?? ""
      const duration = 1100
      const start = performance.now()
      function frame(now: number) {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
        const value = (target * eased).toFixed(decimals)
        el.textContent = `${prefix}${value}${suffix}`
        if (t < 1) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }

    const countEls = document.querySelectorAll<HTMLElement>("[data-countup]")
    if (reduce) {
      revealEls.forEach((el) => el.classList.add("revealed"))
      countEls.forEach((el) => {
        const prefix = el.dataset.countupPrefix ?? ""
        const suffix = el.dataset.countupSuffix ?? ""
        el.textContent = `${prefix}${el.dataset.countupTo ?? ""}${suffix}`
      })
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("revealed")
              if ((e.target as HTMLElement).hasAttribute("data-countup")) {
                runCountUp(e.target as HTMLElement)
              }
              io.unobserve(e.target)
            }
          }
        },
        { threshold: 0.2 }
      )
      revealEls.forEach((el) => io.observe(el))
      countEls.forEach((el) => io.observe(el))

      // ── 3. Mouse parallax for hero floaters ──────────────────
      const parallaxEls = Array.from(
        document.querySelectorAll<HTMLElement>("[data-parallax]")
      )
      let raf = 0
      const onMove = (ev: MouseEvent) => {
        const cx = window.innerWidth / 2
        const cy = window.innerHeight / 2
        const dx = (ev.clientX - cx) / cx
        const dy = (ev.clientY - cy) / cy
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => {
          for (const el of parallaxEls) {
            const depth = parseFloat(el.dataset.parallax ?? "1")
            el.style.setProperty("--px", `${dx * depth * 14}px`)
            el.style.setProperty("--py", `${dy * depth * 14}px`)
          }
        })
      }
      window.addEventListener("mousemove", onMove)

      return () => {
        io.disconnect()
        window.removeEventListener("mousemove", onMove)
        cancelAnimationFrame(raf)
      }
    }
  }, [])

  return null
}
