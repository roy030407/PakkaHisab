/**
 * FILE: components/landing/LandingReveal.tsx
 *
 * WHAT THIS DOES:
 *   Client-side IntersectionObserver that adds .revealed to every
 *   [data-reveal] element when it scrolls into view (one-shot).
 *   Renders nothing — mount once anywhere on the landing page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Playful Bazaar landing page
 *
 * WHERE IT FITS:
 *   The only client component on the public landing page. CSS in
 *   globals.css ([data-reveal] rules) does the actual animation.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/page.tsx
 */
"use client"

import { useEffect } from "react"

export function LandingReveal() {
  useEffect(() => {
    const els = document.querySelectorAll("[data-reveal]")
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("revealed"))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("revealed")
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.15 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
