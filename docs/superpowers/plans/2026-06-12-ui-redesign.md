# PakkaHisab UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved "Khata Green" design system to all 9 app screens + navigation + auth, and build the new animated "Playful Bazaar" public landing page at `/`.

**Architecture:** Pure restyle + 5 new shared components. Brand color flows through the shadcn `--primary` CSS variable so most form controls rebrand automatically. The landing page is a server component with one tiny client component (`LandingReveal`) for IntersectionObserver scroll reveals; all animation is CSS keyframes — zero new dependencies.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS v4 (`@theme` in globals.css), shadcn/ui, lucide-react. No new packages.

**Spec:** `docs/superpowers/specs/2026-06-12-ui-redesign-design.md` — read it before starting.

**Verification per task:** This is a visual restyle; there is no test suite in this repo. Every task ends with `npx tsc --noEmit` (must be 0 errors) and a commit. Final task runs `npm run build`.

---

## GLOBAL CLASS MAPPING — used by all restyle tasks

When a task says "apply the global mapping", open the file and replace these Tailwind classes wherever they appear (only in className strings, and only where the element is an accent/action — not body text):

| Old | New |
|---|---|
| `bg-slate-900` / `bg-gray-900` (buttons, primary actions) | `bg-emerald-700` |
| `hover:bg-slate-800` / `hover:bg-gray-800` | `hover:bg-emerald-800` |
| `bg-slate-100 text-slate-900` (active pills) | `bg-emerald-50 text-emerald-800` |
| `text-slate-700 underline` (links) | `text-emerald-700 underline` |
| `rounded-xl` on hero/primary cards | `rounded-2xl` |
| `border-violet-*` / `bg-violet-*` / `text-violet-*` (AI accents) | emerald equivalents (`border-emerald-100`, `bg-emerald-50`, `text-emerald-700`) |
| focus rings `ring-slate-*` | leave alone — `--ring` variable handles it |

Standard card hover (add to interactive cards): `transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`

Icon chip pattern (for stat cards / list rows):
```tsx
<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
  <Icon size={14} className="text-emerald-700" />
</div>
```

---

### Task 1: Design tokens + motion CSS in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Rebrand the CSS variables**

In `app/globals.css` `:root`, replace these lines:

```css
--primary: oklch(0.205 0 0);
```
with
```css
--primary: oklch(0.508 0.118 165.612);   /* emerald-700 */
```

```css
--ring: oklch(0.708 0 0);
```
with
```css
--ring: oklch(0.696 0.17 162.48);        /* emerald-500 */
```

```css
--radius: 0.625rem;
```
with
```css
--radius: 0.75rem;
```

Replace the five `--chart-*` grayscale values with:
```css
--chart-1: oklch(0.508 0.118 165.612);   /* emerald-700 */
--chart-2: oklch(0.696 0.17 162.48);     /* emerald-500 */
--chart-3: oklch(0.845 0.143 164.978);   /* emerald-300 */
--chart-4: oklch(0.905 0.093 164.15);    /* emerald-200 */
--chart-5: oklch(0.769 0.188 70.08);     /* amber-500 */
```

- [ ] **Step 2: Add motion utilities and keyframes**

Append inside the existing `@layer utilities` block:

```css
  /* Interactive card hover lift */
  .card-lift {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  /* Success pulse on save confirmations */
  .save-pulse {
    animation: save-pulse 0.4s ease-out both;
  }
```

Append after the existing `@keyframes page-fade-up` block:

```css
@keyframes save-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}

/* ── Landing page animations ─────────────────────────── */
@keyframes float-soft {
  0%, 100% { transform: translateY(0) rotate(var(--float-rot, 0deg)); }
  50%      { transform: translateY(-10px) rotate(var(--float-rot, 0deg)); }
}
@keyframes drop-in {
  from { opacity: 0; transform: translateY(-40px) rotate(var(--float-rot, 0deg)) scale(0.6); }
  to   { opacity: 1; transform: translateY(0) rotate(var(--float-rot, 0deg)) scale(1); }
}
@keyframes marquee-x {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
@keyframes blink-caret {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

.landing-float {
  animation: drop-in 0.6s ease-out both, float-soft 4s ease-in-out 0.6s infinite;
}
.landing-marquee {
  animation: marquee-x 25s linear infinite;
}
/* Scroll-reveal: starts hidden, LandingReveal adds .revealed */
[data-reveal] {
  opacity: 0;
  transform: translateY(24px) rotate(var(--reveal-rot, 0deg));
  transition: opacity 0.5s ease, transform 0.5s ease;
  transition-delay: var(--reveal-delay, 0s);
}
[data-reveal].revealed {
  opacity: 1;
  transform: translateY(0) rotate(var(--reveal-rot-final, 0deg));
}

@media (prefers-reduced-motion: reduce) {
  .landing-float, .landing-marquee, .save-pulse, .page-enter { animation: none !important; }
  [data-reveal] { opacity: 1; transform: none; transition: none; }
  .card-lift, .card-lift:hover { transition: none; transform: none; }
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors. Run `npm run dev` briefly — buttons across the app should now be emerald.

```bash
git add app/globals.css
git commit -m "feat(ui): Khata Green design tokens + motion keyframes"
```

---

### Task 2: AnimatedNumber component

**Files:**
- Create: `components/shared/AnimatedNumber.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

Note: SSR and first client paint render the final value (`display === null` branch) — no layout shift, no hydration mismatch. The effect then animates from 0 to the value. One-frame transition from final → 0 is imperceptible at 600ms duration.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/shared/AnimatedNumber.tsx
git commit -m "feat(ui): AnimatedNumber count-up component"
```

---

### Task 3: Sparkline component

**Files:**
- Create: `components/shared/Sparkline.tsx`

- [ ] **Step 1: Create the component**

```tsx
/**
 * FILE: components/shared/Sparkline.tsx
 *
 * WHAT THIS DOES:
 *   Tiny 7-bar flex chart for showing a week of values inside cards.
 *   Pure CSS bars — no chart library. Server-component friendly.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Dashboard hero profit card; reusable in report cards.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

interface Props {
  values: number[]
  labels?: string[]
}

export function Sparkline({ values, labels }: Props) {
  const max = Math.max(...values.map(Math.abs), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5 h-9">
        {values.map((v, i) => {
          const heightPct = Math.max((Math.abs(v) / max) * 100, 8)
          const isLast = i === values.length - 1
          const color =
            v < 0 ? "bg-red-200" : isLast ? "bg-emerald-500" : "bg-emerald-200"
          return (
            <div
              key={i}
              className={`flex-1 rounded-[3px] ${color}`}
              style={{ height: `${heightPct}%` }}
            />
          )
        })}
      </div>
      {labels && (
        <div className="flex justify-between mt-1">
          {labels.map((l, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[9px] font-semibold ${
                i === labels.length - 1 ? "text-emerald-700" : "text-emerald-400"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/shared/Sparkline.tsx
git commit -m "feat(ui): Sparkline 7-day mini chart component"
```

---

### Task 4: GreetingHeader component

**Files:**
- Create: `components/shared/GreetingHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
/**
 * FILE: components/shared/GreetingHeader.tsx
 *
 * WHAT THIS DOES:
 *   Dashboard header: time-of-day greeting + owner first name, store and
 *   date context line, and the brand ₹ avatar that links to /settings.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Top of the dashboard page. Server component (time = server render time).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

import Link from "next/link"

interface Props {
  ownerName: string
  storeName: string
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function GreetingHeader({ ownerName, storeName }: Props) {
  const firstName = ownerName.trim().split(/\s+/)[0] || "ji"
  const dateLine = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date())

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="mt-0.5 text-xs text-gray-400">
          {storeName} · {dateLine}
        </p>
      </div>
      <Link
        href="/settings"
        aria-label="Settings"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-base font-extrabold text-white shadow-md shadow-emerald-200 transition-transform hover:scale-105"
      >
        ₹
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/shared/GreetingHeader.tsx
git commit -m "feat(ui): GreetingHeader with time-aware greeting"
```

---

### Task 5: AttentionCard component

**Files:**
- Create: `components/shared/AttentionCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
/**
 * FILE: components/shared/AttentionCard.tsx
 *
 * WHAT THIS DOES:
 *   Consolidates low-stock + expiry alerts into ONE calm amber card
 *   (or a slim green "All good" strip when there is nothing to flag).
 *   Replaces the separate red/amber alert StatCards on the dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Dashboard below the stat row; same pattern reused on /inventory.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx, app/(dashboard)/inventory/page.tsx
 */

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react"

interface Props {
  lowStockCount: number
  expiryCount: number
  href?: string
}

export function AttentionCard({ lowStockCount, expiryCount, href = "/inventory" }: Props) {
  const total = lowStockCount + expiryCount

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <CheckCircle2 size={16} className="text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">
          All good — stock levels healthy, nothing expiring soon
        </p>
      </div>
    )
  }

  const parts: string[] = []
  if (lowStockCount > 0)
    parts.push(`${lowStockCount} item${lowStockCount > 1 ? "s" : ""} low on stock`)
  if (expiryCount > 0)
    parts.push(`${expiryCount} expiring within 7 days`)

  return (
    <Link
      href={href}
      className="card-lift flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-amber-900">
            {total} thing{total > 1 ? "s" : ""} need{total === 1 ? "s" : ""} attention
          </p>
          <p className="text-xs text-amber-700">{parts.join(" · ")}</p>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-amber-500" />
    </Link>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/shared/AttentionCard.tsx
git commit -m "feat(ui): consolidated AttentionCard for alerts"
```

---

### Task 6: EmptyState illustrations

**Files:**
- Modify: `components/shared/EmptyState.tsx`

- [ ] **Step 1: Replace the component with the illustrated version**

Full new file content (keep the existing file comment block, append to CHANGES):

```tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  illustration?: "box" | "customers" | "reports" | "chat" | "scan";
}

const STROKES = { main: "#047857", soft: "#a7f3d0", accent: "#f59e0b" }

function Illustration({ kind }: { kind: NonNullable<EmptyStateProps["illustration"]> }) {
  const common = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  switch (kind) {
    case "box":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 28 36 18l22 10v24L36 62 14 52z" stroke={STROKES.main} {...common} />
          <path d="M14 28l22 10 22-10M36 38v24" stroke={STROKES.soft} {...common} />
          <path d="M50 14l4-6M58 18l6-4" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "customers":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="28" cy="26" r="8" stroke={STROKES.main} {...common} />
          <path d="M12 56c0-9 7-14 16-14s16 5 16 14" stroke={STROKES.main} {...common} />
          <circle cx="50" cy="30" r="6" stroke={STROKES.soft} {...common} />
          <path d="M44 54c1-7 6-10 12-10" stroke={STROKES.soft} {...common} />
        </svg>
      )
    case "reports":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <rect x="14" y="14" width="44" height="44" rx="6" stroke={STROKES.soft} {...common} />
          <path d="M24 46V34M36 46V26M48 46v-8" stroke={STROKES.main} {...common} />
          <path d="M22 22h8" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "chat":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 20h44v26H30l-10 10V46h-6z" stroke={STROKES.main} {...common} />
          <path d="M26 30h20M26 37h12" stroke={STROKES.soft} {...common} />
          <path d="M56 12l2-4M62 16l4-2" stroke={STROKES.accent} {...common} />
        </svg>
      )
    case "scan":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 24v-8h8M58 24v-8h-8M14 48v8h8M58 48v8h-8" stroke={STROKES.main} {...common} />
          <rect x="26" y="26" width="20" height="24" rx="3" stroke={STROKES.soft} {...common} />
          <path d="M30 34h12M30 40h8" stroke={STROKES.soft} {...common} />
          <path d="M12 36h48" stroke={STROKES.accent} {...common} />
        </svg>
      )
  }
}

export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/30 py-14 text-center">
      {illustration && <div className="mb-4">{<Illustration kind={illustration} />}</div>}
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

Existing call sites keep working (`illustration` is optional). Where EmptyState is used in pages touched by later tasks, pass the matching variant (`scan` on /scan, `box` on /inventory and /products, `customers` on /customers, `reports` on /reports, `chat` on /advisor).

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/shared/EmptyState.tsx
git commit -m "feat(ui): illustrated empty states"
```

---

### Task 7: StatCard upgrade (icon chips + count-up)

**Files:**
- Modify: `components/reports/StatCard.tsx`

- [ ] **Step 1: Replace StatCard implementation**

Keep the file comment block (append CHANGES entry) and `formatINR` export unchanged. New component code:

```tsx
import type { LucideIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"

interface Props {
  label: string
  value: string
  sublabel?: string
  accent?: "green" | "red" | "amber" | "blue" | "slate"
  icon?: LucideIcon
  /** When provided, value animates with a count-up using `format` */
  rawValue?: number
  format?: (n: number) => string
  onClick?: () => void
}

const ACCENT_CLASSES: Record<string, string> = {
  green: "bg-emerald-50 border-emerald-100",
  red:   "bg-red-50 border-red-100",
  amber: "bg-amber-50 border-amber-100",
  blue:  "bg-blue-50 border-blue-100",
  slate: "bg-white border-gray-100 shadow-sm",
}

const VALUE_CLASSES: Record<string, string> = {
  green: "text-emerald-800",
  red:   "text-red-700",
  amber: "text-amber-800",
  blue:  "text-blue-800",
  slate: "text-gray-900",
}

const CHIP_CLASSES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  red:   "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  blue:  "bg-blue-100 text-blue-600",
  slate: "bg-emerald-50 text-emerald-700",
}

export function StatCard({
  label, value, sublabel, accent = "slate", icon: Icon, rawValue, format, onClick,
}: Props) {
  return (
    <div
      className={`card-lift rounded-xl border p-4 ${ACCENT_CLASSES[accent]} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${CHIP_CLASSES[accent]}`}>
            <Icon size={14} />
          </span>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      </div>
      <p className={`text-xl font-bold tracking-tight ${VALUE_CLASSES[accent]}`}>
        {rawValue !== undefined && format ? (
          <AnimatedNumber value={rawValue} format={format} />
        ) : (
          value
        )}
      </p>
      {sublabel && <p className="mt-1 text-xs text-gray-400">{sublabel}</p>}
    </div>
  )
}
```

Note `StatCard` stays a server-compatible component; `AnimatedNumber` is the client boundary.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors (existing callers pass `value` string — still supported).

```bash
git add components/reports/StatCard.tsx
git commit -m "feat(ui): StatCard icon chips, hover lift, count-up support"
```

---

### Task 8: BottomNav with center Scan FAB + Sidebar restyle

**Files:**
- Modify: `components/shared/BottomNav.tsx`
- Modify: `components/shared/Sidebar.tsx`

- [ ] **Step 1: Replace BottomNav**

Keep file comment block (append CHANGES). New body:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, PenLine, Package, Users } from 'lucide-react'

const LEFT_TABS = [
  { href: '/dashboard', label: 'Home',  Icon: Home    },
  { href: '/entry',     label: 'Entry', Icon: PenLine },
]
const RIGHT_TABS = [
  { href: '/inventory', label: 'Stock',     Icon: Package },
  { href: '/customers', label: 'Customers', Icon: Users   },
]

function Tab({ href, label, Icon, active }: {
  href: string; label: string; Icon: typeof Home; active: boolean
}) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-0.5 relative">
      {active && <span className="absolute top-1.5 w-5 h-0.5 rounded-full bg-emerald-600" />}
      <Icon size={20} strokeWidth={active ? 2.2 : 1.7}
        className={active ? 'text-emerald-700' : 'text-gray-400'} />
      <span className={`text-[10px] leading-none ${active ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
        {label}
      </span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {LEFT_TABS.map((t) => <Tab key={t.href} {...t} active={isActive(t.href)} />)}

        {/* Center elevated Scan FAB */}
        <div className="relative flex justify-center">
          <Link href="/scan" aria-label="Scan a bill"
            className={`absolute -top-6 flex h-[52px] w-[52px] items-center justify-center rounded-full
              bg-gradient-to-br from-emerald-500 to-emerald-700 text-white
              ring-4 ring-white shadow-lg shadow-emerald-300/50
              transition-transform active:scale-95 ${
                isActive('/scan') ? 'from-emerald-600 to-emerald-800' : ''
              }`}>
            <Camera size={22} />
          </Link>
          <span className={`self-end mb-1.5 text-[10px] leading-none ${
            isActive('/scan') ? 'text-emerald-700 font-semibold' : 'text-gray-400'
          }`}>Scan</span>
        </div>

        {RIGHT_TABS.map((t) => <Tab key={t.href} {...t} active={isActive(t.href)} />)}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Restyle Sidebar**

In `components/shared/Sidebar.tsx` (keep structure and nav arrays):

1. Replace the brand block with:
```tsx
      <div className="px-3 mb-6 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-extrabold text-white">₹</span>
        <span className="text-lg font-bold text-gray-900 tracking-tight">PakkaHisab</span>
      </div>
```
2. Replace both active/inactive className ternaries (nav links AND the Settings link) with:
```tsx
                active
                  ? 'bg-emerald-50 text-emerald-800 shadow-[inset_2px_0_0_#047857]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
```
(For the Settings link the condition is `isActive('/settings')` as it is now.)

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors. Check mobile viewport in dev tools: FAB floats above the bar, all 5 routes work.

```bash
git add components/shared/BottomNav.tsx components/shared/Sidebar.tsx
git commit -m "feat(ui): Scan FAB bottom nav + emerald sidebar"
```

---

### Task 9: Dashboard redesign

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/ai/InsightCard.tsx`

- [ ] **Step 1: Restyle InsightCard**

Keep the data fetching exactly as-is. Replace the two returned JSX blocks:

Loading state:
```tsx
    return (
      <div className="rounded-2xl border border-gray-100 border-l-[3px] border-l-emerald-500 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-3 w-32 rounded bg-emerald-100 mb-2" />
        <div className="h-4 w-full rounded bg-gray-100 mb-1" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
      </div>
    )
```

Loaded state:
```tsx
    <div className="rounded-2xl border border-gray-100 border-l-[3px] border-l-emerald-500 bg-white p-4 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <span aria-hidden>✨</span> Aaj ki salah · Today&apos;s tip
      </p>
      <p className="text-sm leading-relaxed text-gray-800">{insight}</p>
      <Link
        href="/advisor"
        className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800"
      >
        Tell me more →
      </Link>
    </div>
```

- [ ] **Step 2: Rewrite the dashboard page**

Replace `app/(dashboard)/dashboard/page.tsx` content below the file comment block (update CHANGES). Key changes from current version: 7-day transaction fetch replaces today-only; sparkline + vs-yesterday pill; GreetingHeader; AttentionCard; icon-chip StatCards.

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { StatCard, formatINR } from "@/components/reports/StatCard"
import { InsightCard } from "@/components/ai/InsightCard"
import { GreetingHeader } from "@/components/shared/GreetingHeader"
import { AttentionCard } from "@/components/shared/AttentionCard"
import { Sparkline } from "@/components/shared/Sparkline"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"
import Link from "next/link"
import { Camera, PenLine, Package, ShoppingCart, HandCoins } from "lucide-react"

function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d)
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_name")
    .eq("owner_id", user!.id)
    .maybeSingle()

  // Last 7 days (inclusive of today), IST
  const today = istDateString(new Date())
  const sevenDaysAgo = istDateString(new Date(Date.now() - 6 * 86400000))
  const yesterday = istDateString(new Date(Date.now() - 86400000))

  let salesToday = 0, purchasesToday = 0, txCountToday = 0
  let dailyFixedCost = 0, outstandingReceivables = 0, receivableCustomers = 0
  let lowStockCount = 0, expiryCount = 0
  let profitByDay: number[] = []
  let dayLabels: string[] = []

  if (store) {
    const [txResult, costsResult, customersResult, inventoryResult, expiryResult] =
      await Promise.all([
        supabase
          .from("transactions")
          .select("type, total_amount, date")
          .eq("store_id", store.id)
          .gte("date", sevenDaysAgo)
          .lte("date", today),
        supabase
          .from("fixed_costs")
          .select("amount, frequency")
          .eq("store_id", store.id)
          .eq("is_active", true),
        supabase
          .from("customers")
          .select("current_balance")
          .eq("store_id", store.id)
          .gt("current_balance", 0),
        supabase
          .from("inventory")
          .select("current_stock, reorder_point")
          .eq("store_id", store.id),
        supabase
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .lte("expiry_date", istDateString(new Date(Date.now() + 7 * 86400000)))
          .gt("current_stock", 0),
      ])

    dailyFixedCost = (costsResult.data ?? []).reduce((sum, c) => {
      const amt = Number(c.amount) || 0
      if (c.frequency === "daily") return sum + amt
      if (c.frequency === "weekly") return sum + amt / 7
      if (c.frequency === "monthly") return sum + amt / 30
      if (c.frequency === "yearly") return sum + amt / 365
      return sum
    }, 0)

    // Bucket transactions into the 7 calendar days
    const buckets = new Map<string, { sales: number; purchases: number; count: number }>()
    for (let i = 6; i >= 0; i--) {
      buckets.set(istDateString(new Date(Date.now() - i * 86400000)), {
        sales: 0, purchases: 0, count: 0,
      })
    }
    for (const tx of txResult.data ?? []) {
      const b = buckets.get(tx.date)
      if (!b) continue
      const amt = Number(tx.total_amount) || 0
      if (tx.type === "sale") { b.sales += amt; b.count++ }
      else if (tx.type === "purchase") { b.purchases += amt; b.count++ }
    }

    profitByDay = [...buckets.values()].map(
      (b) => b.sales - b.purchases - dailyFixedCost
    )
    dayLabels = [...buckets.keys()].map((d, i) =>
      i === 6 ? "Today"
        : new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })
            .format(new Date(`${d}T12:00:00`))
    )

    const todayBucket = buckets.get(today)!
    salesToday = todayBucket.sales
    purchasesToday = todayBucket.purchases
    txCountToday = todayBucket.count

    outstandingReceivables = (customersResult.data ?? []).reduce(
      (sum, c) => sum + (Number(c.current_balance) || 0), 0
    )
    receivableCustomers = (customersResult.data ?? []).length

    for (const inv of inventoryResult.data ?? []) {
      const stock = Number(inv.current_stock) || 0
      const reorder = Number(inv.reorder_point) || 0
      if (stock <= 0 || (reorder > 0 && stock <= reorder)) lowStockCount++
    }
    expiryCount = expiryResult.count ?? 0
  }

  const netProfitToday = Math.round(salesToday - purchasesToday - dailyFixedCost)
  const netProfitYesterday = Math.round(profitByDay[5] ?? 0)
  const trendPct =
    netProfitYesterday !== 0
      ? Math.round(((netProfitToday - netProfitYesterday) / Math.abs(netProfitYesterday)) * 100)
      : null

  return (
    <div className="page-enter px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      <div className="mb-5">
        <GreetingHeader
          ownerName={store?.owner_name ?? ""}
          storeName={store?.name ?? "Your store"}
        />
      </div>

      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-6">
        <div className="space-y-4">

          {/* Hero profit card */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-5">
            <div className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full bg-emerald-500/[0.08]" />
            <div className="pointer-events-none absolute -bottom-9 right-5 h-20 w-20 rounded-full bg-emerald-500/[0.06]" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Net profit today
            </p>
            <div className="mt-1 flex items-end gap-2.5">
              <p className={`text-3xl font-extrabold tracking-tight leading-none ${
                netProfitToday < 0 ? "text-red-700" : "text-emerald-950"
              }`}>
                <AnimatedNumber
                  value={netProfitToday}
                  format={(n) => `₹${n.toLocaleString("en-IN")}`}
                />
              </p>
              {trendPct !== null && (
                <span className={`mb-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  trendPct >= 0
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}>
                  {trendPct >= 0 ? "▲" : "▼"} {Math.abs(trendPct)}% vs yesterday
                </span>
              )}
            </div>
            <div className="mt-4">
              <Sparkline values={profitByDay} labels={dayLabels} />
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <Link href="/entry"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-emerald-700 py-3.5 text-white hover:bg-emerald-800 active:opacity-90 transition-colors">
              <PenLine size={18} />
              <span className="text-xs font-medium">Add Sale</span>
            </Link>
            <Link href="/scan"
              className="card-lift flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700">
              <Camera size={18} />
              <span className="text-xs font-medium">Scan Bill</span>
            </Link>
            <Link href="/inventory"
              className="card-lift flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700">
              <Package size={18} />
              <span className="text-xs font-medium">Stock</span>
            </Link>
          </div>

          {/* Sales + Udhaar */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Sales today"
              value={formatINR(Math.round(salesToday))}
              rawValue={Math.round(salesToday)}
              format={formatINR}
              sublabel={`${txCountToday} transaction${txCountToday === 1 ? "" : "s"}`}
              icon={ShoppingCart}
            />
            <Link href="/customers" className="contents">
              <StatCard
                label="Udhaar due"
                value={formatINR(Math.round(outstandingReceivables))}
                rawValue={Math.round(outstandingReceivables)}
                format={formatINR}
                sublabel={
                  receivableCustomers > 0
                    ? `from ${receivableCustomers} customer${receivableCustomers === 1 ? "" : "s"}`
                    : "no credit pending"
                }
                accent={outstandingReceivables > 0 ? "amber" : "slate"}
                icon={HandCoins}
              />
            </Link>
          </div>

          {/* Consolidated alerts */}
          <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} />
        </div>

        {/* Right rail (desktop) */}
        <div className="hidden md:flex flex-col gap-4">
          <InsightCard />
          <Link href="/reports"
            className="card-lift flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
            View full reports
          </Link>
          <Link href="/advisor"
            className="card-lift flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
            Ask the AI advisor
          </Link>
        </div>
      </div>

      {/* Mobile: insight + links */}
      <div className="md:hidden mt-4">
        <InsightCard />
      </div>
      <div className="md:hidden grid grid-cols-2 gap-3 mt-4 mb-8">
        <Link href="/reports"
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
          View reports
        </Link>
        <Link href="/advisor"
          className="flex items-center justify-center rounded-xl bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800">
          Ask advisor
        </Link>
      </div>
    </div>
  )
}
```

Notes for the implementer:
- The `DashboardSnapshot` type import is no longer needed — remove it. If `types/index.ts` exports it and nothing else uses it, leave the type in place (other files may use it; do not delete from types).
- Purchases-today card was removed per "one hero" rule (it lives in /reports). That is intentional.
- `buckets` keys use `tx.date` which is a `YYYY-MM-DD` string in the DB — matches `istDateString` output format (`en-CA` locale gives ISO format).

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors. In dev: dashboard shows greeting, hero with sparkline, trend pill, attention card.

```bash
git add "app/(dashboard)/dashboard/page.tsx" components/ai/InsightCard.tsx
git commit -m "feat(ui): Khata Green dashboard — greeting, hero sparkline, consolidated alerts"
```

---

### Task 10: Scan + Entry screens restyle

**Files:**
- Modify: `app/(dashboard)/scan/page.tsx`, `components/scan/ScanUpload.tsx`, `components/scan/ConfidenceBadge.tsx`, `components/scan/ExtractionReview.tsx`, `components/scan/LedgerReview.tsx`, `components/scan/ScanLoading.tsx`
- Modify: `app/(dashboard)/entry/page.tsx`, `components/entry/QuickEntry.tsx`, `components/entry/FullEntryForm.tsx`, `components/entry/ProductSearch.tsx`

- [ ] **Step 1: Scan screen**

Read each file, apply the GLOBAL CLASS MAPPING, plus these specifics:

1. `ScanUpload.tsx` dropzone container: replace its border/background classes with
   `rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 transition-colors`
   and add below the existing title text a subtitle line:
   `<p className="text-xs text-gray-400 mt-1">Photo kheencho, hisab ho gaya ✨</p>`
2. `ConfidenceBadge.tsx`: high → `bg-emerald-100 text-emerald-700`; medium → `bg-amber-100 text-amber-700`; low → `bg-red-100 text-red-700` (keep any dot/label structure).
3. Primary Save buttons in `ExtractionReview.tsx` / `LedgerReview.tsx`: ensure `bg-emerald-700 hover:bg-emerald-800` (mapping covers `bg-slate-900` cases).
4. If the page or upload component renders an `EmptyState`, pass `illustration="scan"`.

- [ ] **Step 2: Entry screen**

1. Apply the GLOBAL CLASS MAPPING to all four files.
2. `QuickEntry.tsx`: product tiles get `card-lift` added to their container className. The +/- stepper buttons: replace neutral colors with `bg-emerald-50 text-emerald-700 hover:bg-emerald-100` (minus) and `bg-emerald-700 text-white hover:bg-emerald-800` (plus). The running-total/save bar container: replace its background classes with `bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200/60`, and wrap the total amount in `<AnimatedNumber value={total} format={(n) => \`₹${n.toLocaleString("en-IN")}\`} />` (import from `@/components/shared/AnimatedNumber`; QuickEntry is already a client component).
3. `FullEntryForm.tsx` and `ProductSearch.tsx`: mapping only (shadcn inputs already pick up the emerald ring from Task 1).

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors. Dev check: /scan dropzone is emerald-dashed; /entry quick tiles lift, total bar is an emerald gradient.

```bash
git add "app/(dashboard)/scan" components/scan "app/(dashboard)/entry" components/entry
git commit -m "feat(ui): Khata Green restyle for scan + entry screens"
```

---

### Task 11: Inventory + Products screens restyle

**Files:**
- Modify: `app/(dashboard)/inventory/page.tsx`, `components/inventory/StockList.tsx`, `components/inventory/ConsumptionCard.tsx`, `components/inventory/ExpiryAlert.tsx`, `components/inventory/OrderSuggestionCard.tsx`
- Modify: `app/(dashboard)/products/page.tsx`, `components/products/ProductCard.tsx`, `components/products/VariantManager.tsx`

- [ ] **Step 1: Inventory**

1. Apply the GLOBAL CLASS MAPPING to all files.
2. At the top of the inventory page (below its header), render the consolidated status using `AttentionCard` (import from `@/components/shared/AttentionCard`) with the page's already-computed low-stock and expiry counts, replacing any existing separate alert banners *at the summary level* (keep per-row alerts inside the list). If counts aren't computed in the page, derive them from the same data the page already fetches for the list.
3. `StockList.tsx` rows: status dot colors → ok `bg-emerald-500`, low `bg-amber-500`, critical `bg-red-500`; add `card-lift` to row containers if they are cards.
4. Inventory page header: add a link to the catalog —
   `<Link href="/products" className="text-xs font-semibold text-emerald-700">Manage products →</Link>`
5. Any `EmptyState` → `illustration="box"`.

- [ ] **Step 2: Products**

1. Apply the GLOBAL CLASS MAPPING.
2. `ProductCard.tsx`: add `card-lift` to the card container; if the card shows a pinned/frequent badge, restyle to `bg-emerald-100 text-emerald-700`.
3. Any `EmptyState` → `illustration="box"`.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add "app/(dashboard)/inventory" components/inventory "app/(dashboard)/products" components/products
git commit -m "feat(ui): Khata Green restyle for inventory + products"
```

---

### Task 12: Customers + Reports + Advisor + Settings restyle

**Files:**
- Modify: `app/(dashboard)/customers/page.tsx`, `components/customers/CustomerLedger.tsx`, `components/customers/CreditBadge.tsx`
- Modify: `app/(dashboard)/reports/page.tsx`, `components/reports/PeriodToggle.tsx`, `components/reports/ProfitCard.tsx`, `components/reports/TaxSummary.tsx`, `components/reports/CashFlowChart.tsx`, `components/reports/SalesPurchasesChart.tsx`, `components/reports/TopProductsChart.tsx`
- Modify: `app/(dashboard)/advisor/page.tsx`, `components/ai/ChatInterface.tsx`
- Modify: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Customers**

1. GLOBAL CLASS MAPPING on all three files.
2. Customers page: if it shows a total-outstanding summary, restyle as the hero — `rounded-2xl border border-amber-200 bg-amber-50 p-4` when > 0, `border-emerald-100 bg-emerald-50/60` when 0; wrap the amount in `AnimatedNumber` only if the page/parent is a client component (if it's a server page, pass `rawValue`/`format` through `StatCard` instead).
3. Customer list rows: avatar initial circle → `bg-emerald-100 text-emerald-800 font-bold`; balances right-aligned with `tabular-nums`.
4. `EmptyState` → `illustration="customers"`.

- [ ] **Step 2: Reports**

1. GLOBAL CLASS MAPPING on all files.
2. In each chart component, find the hardcoded chart colors (hex strings or Tailwind stroke/fill props on recharts elements) and replace with this palette in order of prominence: `#047857`, `#10b981`, `#6ee7b7`, `#a7f3d0`, `#f59e0b`. Expense/negative series may keep red (`#dc2626`).
3. `PeriodToggle.tsx`: segmented control — container `inline-flex rounded-xl bg-gray-100 p-1`, active segment `bg-white text-emerald-800 shadow-sm rounded-lg font-semibold`, inactive `text-gray-500`.
4. Report summary cards: where `StatCard` is used, add appropriate `icon` props (`ShoppingCart` for sales, `Package` for purchases, `TrendingUp` for profit, `Landmark` for tax — all lucide-react).
5. `EmptyState` → `illustration="reports"`.

- [ ] **Step 3: Advisor**

1. GLOBAL CLASS MAPPING on both files.
2. `ChatInterface.tsx`: user message bubbles → `bg-emerald-700 text-white rounded-2xl rounded-br-md`; assistant bubbles → `bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-md shadow-sm`. Suggested-question chips (if present) → `rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100`.
3. Advisor page header: title becomes `✨ Your business advisor` (keep existing tag structure).
4. `EmptyState` → `illustration="chat"`.

- [ ] **Step 4: Settings**

GLOBAL CLASS MAPPING only. Section cards → `rounded-2xl` + `shadow-sm` if they are plain bordered boxes.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add "app/(dashboard)/customers" components/customers "app/(dashboard)/reports" components/reports "app/(dashboard)/advisor" components/ai "app/(dashboard)/settings"
git commit -m "feat(ui): Khata Green restyle for customers, reports, advisor, settings"
```

---

### Task 13: Auth pages restyle

**Files:**
- Modify: `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: Apply to all three pages**

1. GLOBAL CLASS MAPPING (buttons become emerald automatically via `--primary`; fix any hardcoded slate links → `text-emerald-700`).
2. Page wrapper: replace `bg-gray-50` with
   `bg-white [background-image:radial-gradient(ellipse_at_top,#ecfdf5_0%,transparent_55%)]`
3. Above the Card title, add the brand mark (login + signup only):
```tsx
<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-extrabold text-white shadow-md shadow-emerald-200">₹</div>
```
4. Keep `export const dynamic = "force-dynamic"` lines untouched.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add "app/(auth)"
git commit -m "feat(ui): Khata Green restyle for auth pages"
```

---

### Task 14: LandingReveal client component

**Files:**
- Create: `components/landing/LandingReveal.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors.

```bash
git add components/landing/LandingReveal.tsx
git commit -m "feat(landing): scroll-reveal observer component"
```

---

### Task 15: Landing page — Playful Bazaar

**Files:**
- Modify: `app/page.tsx` (replaces the `/login` redirect)

- [ ] **Step 1: Replace app/page.tsx entirely**

```tsx
/**
 * FILE: app/page.tsx
 *
 * WHAT THIS DOES:
 *   Public "Playful Bazaar" landing page — maximalist, animated,
 *   Hinglish marketing page. Replaces the old redirect-to-login.
 *   Logged-in visitors get an "Open app" header CTA.
 *
 * CHANGES THIS SESSION:
 *   - Replaced /login redirect with full landing page
 *
 * WHERE IT FITS:
 *   First touch for new visitors. CTAs lead to /signup; login in header.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js root route; components/landing/LandingReveal.tsx
 */

import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { LandingReveal } from "@/components/landing/LandingReveal"

export const dynamic = "force-dynamic"

/* ── Building blocks ─────────────────────────────────── */

function ComicCard({
  children, rotate = 0, className = "",
}: { children: React.ReactNode; rotate?: number; className?: string }) {
  return (
    <div
      className={`rounded-2xl border-2 border-stone-900 bg-white p-5 shadow-[5px_5px_0_#1c1917] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <span className="absolute bottom-1 left-0 right-0 -z-0 h-3 rounded-md bg-emerald-300/80" />
    </span>
  )
}

const FLOATERS = [
  { emoji: "🍪", className: "left-[6%] top-[12%]",  rot: -12, delay: 0 },
  { emoji: "🥤", className: "right-[8%] top-[10%]", rot: 10,  delay: 0.15 },
  { emoji: "🧴", className: "left-[4%] top-[58%]",  rot: 8,   delay: 0.3 },
  { emoji: "📦", className: "right-[10%] top-[55%]", rot: -8,  delay: 0.45 },
  { emoji: "🧾", className: "left-[16%] top-[34%]",  rot: 6,   delay: 0.6 },
  { emoji: "🫙", className: "right-[18%] top-[32%]", rot: -6,  delay: 0.75 },
]

const STEPS = [
  { emoji: "📸", step: "1", title: "Photo kheencho", desc: "Bill, parchi, khata page — kuch bhi. Bas ek photo.", rot: -2 },
  { emoji: "🤖", step: "2", title: "AI padhega",     desc: "Har item, har daam — AI khud nikaal lega. Aap sirf check karo.", rot: 1 },
  { emoji: "🎉", step: "3", title: "Hisab pakka!",   desc: "Stock update, profit ready, udhaar tracked. Done.", rot: -1 },
]

const FEATURES = [
  { emoji: "📸", title: "Bill Scan AI",     desc: "8 second mein poora bill entry. Handwritten bhi chalega.", rot: -1.5 },
  { emoji: "🤝", title: "Udhaar Tracker",   desc: "Kaun kitna due hai — ek nazar mein. Bhoolna band.", rot: 1 },
  { emoji: "📦", title: "Stock Alerts",     desc: "Maal khatam hone se pehle pata chal jayega.", rot: -1 },
  { emoji: "🧾", title: "GST Reports",      desc: "CA ko bhejne layak statement, ek tap mein.", rot: 1.5 },
  { emoji: "✨", title: "AI ki Salah",      desc: "“Tuesday ko sales kam hai, offer chalao” — roz ek smart tip.", rot: -1.5 },
  { emoji: "🗣️", title: "Apni Bhasha",     desc: "Hindi, English, Telugu, Tamil, Marathi — jo aapko aaye.", rot: 1 },
]

const MARQUEE_ITEMS = "🛒 KIRANA · 💊 MEDICAL · 🔧 HARDWARE · 👕 CLOTHING · 🍽️ RESTAURANT · 📱 ELECTRONICS · "

export default async function LandingPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-amber-50 to-emerald-50 font-sans text-stone-900 overflow-x-hidden">
      <LandingReveal />

      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-extrabold text-white">₹</span>
          <span className="text-lg font-extrabold tracking-tight">PakkaHisab</span>
        </div>
        <Link
          href={user ? "/dashboard" : "/login"}
          className="rounded-full border-2 border-stone-900 bg-white px-4 py-1.5 text-sm font-bold shadow-[3px_3px_0_#1c1917] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          {user ? "Open app →" : "Login"}
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative mx-auto max-w-5xl px-5 pb-20 pt-10 text-center md:pt-16">
        {FLOATERS.map((f, i) => (
          <span
            key={i}
            aria-hidden
            className={`landing-float pointer-events-none absolute text-3xl md:text-4xl ${f.className}`}
            style={{ "--float-rot": `${f.rot}deg`, animationDelay: `${f.delay}s, ${0.6 + f.delay}s` } as React.CSSProperties}
          >
            {f.emoji}
          </span>
        ))}

        <div className="inline-block -rotate-2 rounded-full border-2 border-dashed border-amber-500 bg-amber-100 px-4 py-1.5 text-xs font-extrabold tracking-wide text-amber-800">
          NAMASTE DUKANDAAR! 🙏
        </div>

        <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
          Kagaz ka jhanjhat <Highlight>khatam!</Highlight> 🎉
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base text-stone-500 md:text-lg">
          Phone se photo kheencho, hisab ho gaya. Profit, stock, udhaar — sab automatic.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-block rounded-full bg-emerald-700 px-8 py-3.5 text-base font-extrabold text-white shadow-[0_6px_0_#065f46] transition-all hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_#065f46]"
        >
          Shuru karo — FREE
        </Link>
        <p className="mt-3 text-xs text-stone-400">No card needed · 2 minute setup</p>

        <div className="mx-auto mt-12 max-w-xs" data-reveal style={{ "--reveal-rot": "-3deg", "--reveal-rot-final": "-1deg" } as React.CSSProperties}>
          <ComicCard rotate={0}>
            <p className="text-left text-[10px] font-bold tracking-wide text-stone-400">📷 SCAN → ✓ DONE</p>
            <p className="mt-1 text-left text-lg font-extrabold text-emerald-700">14 items in 8 seconds</p>
            <p className="text-left text-xs text-stone-500">Sharma ji ka aaj ka bill ✓</p>
          </ComicCard>
        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="overflow-hidden border-y-2 border-stone-900 bg-stone-900 py-2.5">
        <div className="landing-marquee flex w-max whitespace-nowrap text-sm font-extrabold tracking-widest text-amber-100">
          <span className="px-4">{MARQUEE_ITEMS.repeat(3)}</span>
          <span className="px-4" aria-hidden>{MARQUEE_ITEMS.repeat(3)}</span>
        </div>
      </div>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
          Sirf <Highlight>3 steps</Highlight> 👇
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.step} data-reveal
              style={{ "--reveal-delay": `${i * 0.12}s`, "--reveal-rot": `${s.rot * 3}deg`, "--reveal-rot-final": `${s.rot}deg` } as React.CSSProperties}>
              <ComicCard rotate={0} className="h-full text-center">
                <div className="text-5xl">{s.emoji}</div>
                <div className="mx-auto mt-3 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-sm font-extrabold text-white">{s.step}</div>
                <h3 className="mt-2 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-1 text-sm text-stone-500">{s.desc}</p>
              </ComicCard>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature carnival ── */}
      <section className="bg-emerald-50/70 px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
            Poora dukaan, <Highlight>ek app</Highlight> 🏪
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={f.title} data-reveal
                style={{ "--reveal-delay": `${(i % 3) * 0.1}s`, "--reveal-rot": `${f.rot * 3}deg`, "--reveal-rot-final": `${f.rot}deg` } as React.CSSProperties}
                className="transition-transform duration-200 hover:!rotate-0 hover:-translate-y-1">
                <ComicCard rotate={0} className="h-full">
                  <div className="text-3xl">{f.emoji}</div>
                  <h3 className="mt-2 text-base font-extrabold">{f.title}</h3>
                  <p className="mt-1 text-sm text-stone-500">{f.desc}</p>
                </ComicCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Numbers band ── */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <div className="grid grid-cols-1 gap-6 text-center sm:grid-cols-3">
          {[
            { big: "8 sec", small: "per bill scan" },
            { big: "₹0",    small: "to start — free hai" },
            { big: "5",     small: "languages supported" },
          ].map((n, i) => (
            <div key={n.big} data-reveal style={{ "--reveal-delay": `${i * 0.15}s` } as React.CSSProperties}>
              <p className="text-5xl font-black tracking-tight text-emerald-700">{n.big}</p>
              <p className="mt-1 text-sm font-semibold text-stone-500">{n.small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI teaser ── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-md" data-reveal>
          <ComicCard rotate={-1}>
            <p className="text-[10px] font-bold tracking-wide text-stone-400">✨ AAJ KI SALAH</p>
            <div className="mt-3 space-y-2">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-emerald-700 px-3.5 py-2 text-sm text-white">
                Is hafte kya order karu?
              </div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-stone-100 px-3.5 py-2 text-sm text-stone-800">
                Boss, garmi badh rahi hai — cold drinks 40% zyada bik rahi hai. Thums Up aur Sprite weekend se pehle stock kar lo. 🥤
              </div>
            </div>
            <p className="mt-3 text-xs font-bold text-emerald-700">Aapka AI advisor, 24×7 →</p>
          </ComicCard>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t-2 border-stone-900 bg-amber-50 px-5 py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl" data-reveal>
          Aaj se hisab <Highlight>pakka.</Highlight>
        </h2>
        <div data-reveal style={{ "--reveal-delay": "0.15s" } as React.CSSProperties}>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-full bg-emerald-700 px-10 py-4 text-lg font-extrabold text-white shadow-[0_6px_0_#065f46] transition-all hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_#065f46]"
          >
            Shuru karo — FREE 🚀
          </Link>
          <p className="mt-3 text-xs text-stone-400">2 minute mein setup. Koi card nahi chahiye.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-stone-900 px-5 py-8 text-center text-amber-50/70">
        <p className="text-sm font-bold text-amber-50">₹ PakkaHisab</p>
        <p className="mt-1 text-xs">Aapki dukaan ka smart hisab · <Link href="/login" className="underline">Login</Link></p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → 0 errors. Dev check at `/` (logged out): emojis drop in and float, marquee scrolls, cards reveal with rotation on scroll, CTA presses down. Logged in: header shows "Open app →".

```bash
git add app/page.tsx
git commit -m "feat(landing): Playful Bazaar animated landing page"
```

---

### Task 16: Final verification

- [ ] **Step 1: Type check + production build**

Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` → build succeeds, `/` is in the route list.

- [ ] **Step 2: Manual sweep (dev server)**

1. `/` logged out — full landing renders, animations play, both CTAs → /signup, Login → /login.
2. `/dashboard` — greeting, hero count-up + sparkline + trend pill, attention card, emerald everywhere.
3. Mobile viewport — bottom nav shows center Scan FAB; Home/Entry/Stock/Customers tabs work.
4. `/scan`, `/entry`, `/inventory`, `/products`, `/customers`, `/reports`, `/advisor`, `/settings` — emerald accents, no leftover slate-900 buttons or violet AI accents.
5. OS-level "reduce motion" on — landing renders fully without animation.

- [ ] **Step 3: Done**

Report changed-file list and proposed commit message to the user. Per CLAUDE.md, wait for "commit" before any final phase commit.
