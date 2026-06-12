# PakkaHisab UI Redesign — "Khata Green" + "Playful Bazaar" Landing

**Date:** 2026-06-12
**Status:** Approved direction (via visual companion session)
**Scope:** All 9 app screens + navigation + auth pages + new public landing page

---

## 1. Goals

1. A small business owner must never feel overwhelmed — one hero element per screen, alerts consolidated, calm white surfaces.
2. The app must still feel special — personal greeting, sparklines, icon chips, micro-delight animations, Hinglish warmth.
3. A new public landing page at `/` that is the opposite of the app: loud, animated, maximalist — built to convert visitors.
4. Everything stays fast on a mid-range Android over slow 4G: CSS-only animations, no new animation libraries, no heavy assets on initial load.

---

## 2. Design System — "Khata Green"

### 2.1 Color tokens (added to `app/globals.css` as CSS variables + used via Tailwind classes)

| Token | Value | Use |
|---|---|---|
| Brand primary | `emerald-700 #047857` | Primary buttons, active nav, links |
| Brand deep | `emerald-900 #064e3b` | Hero numerals, headings on green |
| Brand bright | `emerald-500 #10b981` | FAB gradient end, accents, sparkline "today" bar |
| Hero surface | gradient `#ecfdf5 → #d1fae5`, border `#a7f3d0` | One hero card per screen |
| Positive chip | bg `#dcfce7`, border `#86efac`, text `#15803d` | Trend-up pills |
| Attention | bg `#fffbeb`, border `#fde68a`, text `#92400e` | The single consolidated attention card |
| Negative | `red-600` text only, never full red cards on dashboard | Trend-down, errors |
| Page background | white `#ffffff` (cards) on `#fafafa` page wash is allowed in layout gutter | Everything |

`--primary` in globals.css changes from near-black to emerald-700 so all shadcn buttons/inputs/focus rings pick up the brand automatically.

### 2.2 Shape & depth

- Card radius: `rounded-2xl` (16px) for hero cards, `rounded-xl` (12px) for stat cards. `--radius` bumps to `0.75rem`.
- Shadow: `0 1px 3px rgba(0,0,0,0.04)` resting; hover lifts to `0 4px 12px rgba(0,0,0,0.08)` + `-translate-y-0.5`.
- Decorative circles: hero cards get 1–2 absolutely-positioned translucent emerald circles (`rgba(16,185,129,0.06–0.08)`), overflow hidden.

### 2.3 Typography

- Numbers: `font-bold tracking-tight tabular-nums`. Hero number `text-3xl`, stat values `text-xl`.
- Labels: `text-[11px] uppercase tracking-wide font-semibold` in brand or gray-400.
- Hinglish microcopy where natural: "Udhaar due", "Aaj ki salah", greeting "Good morning, {ownerFirstName} 👋".

### 2.4 Motion (CSS only, all ≤300ms, respect `prefers-reduced-motion`)

- `page-enter` (existing) kept on all pages.
- `.count-up`: numbers animate via a small shared client component (`<AnimatedNumber>`) using rAF, 600ms ease-out, skipped under reduced motion.
- `.card-lift`: hover transform + shadow transition 200ms.
- `.save-pulse`: green ✓ scale-pulse keyframe used on successful saves (toast/icon).
- Landing page animations: CSS keyframes + `IntersectionObserver` reveal classes. **No framer-motion or other animation deps.**

---

## 3. The 9 Design Rules (apply to every screen)

1. **One hero, everything else calm.** Exactly one big number or primary action per screen.
2. **Alerts consolidated.** Low stock + expiry merge into a single amber "needs attention" card with a count and a chevron — never multiple red cards.
3. **Personal greeting.** Time-of-day greeting + owner first name on the dashboard header; other screens get a clear title + context line.
4. **Icon chips.** Every stat card gets a 26px soft-tinted rounded icon chip (lucide icon on `emerald-50`/`amber-50` etc.).
5. **Sparklines where they inform.** 7-day mini bar chart in dashboard hero; tiny trends in reports cards. Pure-CSS flex bars from server-fetched data — no chart lib for sparklines.
6. **Scan is the star.** Mobile bottom nav keeps its 5 routes but Scan becomes a **center elevated circular FAB** (52px, emerald gradient, white ring, shadow): Home, Entry, **[Scan FAB]**, Stock, Customers. Reports/Advisor reachable from dashboard links (existing); Settings via the header brand avatar (links to /settings); Products via a header link on the Inventory page.
7. **Friendly empty states.** `EmptyState` component upgraded with inline SVG illustrations (hand-drawn style, emerald/amber strokes) + one clear CTA button.
8. **Micro-delight.** Count-up numbers, card hover lift, save pulse. Never block interaction.
9. **Hinglish warmth.** Sprinkled in labels and the AI insight card header ("Aaj ki salah · Today's tip"), never in critical actions.

---

## 4. Screen-by-Screen Changes

### 4.1 Shared components (new/updated)

| Component | Change |
|---|---|
| `components/shared/GreetingHeader.tsx` (new) | Time-aware greeting, owner name, store + date line, brand avatar (₹ in emerald gradient rounded square, links to /settings) |
| `components/shared/AnimatedNumber.tsx` (new) | Client comp, rAF count-up, `tabular-nums`, reduced-motion safe |
| `components/shared/Sparkline.tsx` (new) | Server-friendly flex-bar 7-day chart, props: `values: number[]`, `labels: string[]` |
| `components/shared/AttentionCard.tsx` (new) | Consolidated amber card: count + up-to-2-line summary + link to /inventory |
| `components/reports/StatCard.tsx` | Add `icon` prop (LucideIcon) rendered in soft chip; hover lift; AnimatedNumber for value |
| `components/shared/EmptyState.tsx` | Add inline SVG illustration variants (`box`, `customers`, `reports`, `chat`, `scan`) |
| `components/shared/BottomNav.tsx` | 5 slots with center Scan FAB (elevated, gradient, white border ring) |
| `components/shared/Sidebar.tsx` | Brand mark (₹ square) + name; active pill becomes `emerald-50` bg + `emerald-800` text + left 2px emerald bar; hover states |

### 4.2 Dashboard (`/dashboard`)

- GreetingHeader replaces plain store-name header.
- Hero profit card: gradient surface, decorative circles, AnimatedNumber, trend pill vs yesterday, 7-day Sparkline. **Sparkline metric = daily net profit** (sales − purchases − daily fixed cost) per day. Data comes from ONE additional query: transactions of the last 7 days (`type, total_amount, date`), bucketed by date in JS; yesterday's profit for the trend pill falls out of the same bucketing — no extra round trip.
- Sales today + Udhaar due as two icon-chip stat cards with transaction count / customer count sublabels.
- AttentionCard replaces the separate low-stock and expiry StatCards.
- InsightCard restyled: white card, 3px emerald left border, "✨ Aaj ki salah · Today's tip" header, "Tell me more →" link to /advisor.
- Quick actions kept (Add Sale primary emerald, Scan, Stock) on mobile above stats.
- Desktop: same two-column layout, right rail = InsightCard + reports/advisor links restyled.

### 4.3 Scan (`/scan`)

- Hero = the upload dropzone: large rounded-2xl emerald-dashed border card with camera illustration, "Photo kheencho, hisab ho gaya" subtitle.
- Extraction review keeps current structure; confidence dots recolored (emerald/amber/red); Save button emerald.

### 4.4 Entry (`/entry`)

- Quick mode product grid: cards get hover lift + emerald +/- steppers; running total bar becomes sticky bottom emerald gradient bar with AnimatedNumber.
- Full mode form: shadcn inputs pick up emerald focus rings automatically via `--primary`.

### 4.5 Inventory (`/inventory`)

- Hero = single status strip: "X items low · Y expiring" amber card (same AttentionCard pattern) or green "All stocked up ✓".
- Stock list rows: status dot (emerald/amber/red) + hover lift; consumption card keeps logic, restyled surfaces.

### 4.6 Products (`/products`)

- Header + search restyle; product cards get icon chip by category and hover lift; "frequently used" pin badge in emerald.

### 4.7 Customers (`/customers`)

- Hero = total udhaar outstanding card (amber if > 0, green if clear) with AnimatedNumber.
- Customer rows: avatar initial in soft emerald circle, balance right-aligned tabular.

### 4.8 Reports (`/reports`)

- Stat summary cards get icon chips + AnimatedNumber.
- Recharts palette switches to emerald scale (`#047857 #10b981 #6ee7b7 #a7f3d0 #f59e0b`).
- PeriodToggle restyled as segmented control with emerald active segment.

### 4.9 Advisor (`/advisor`)

- Chat: user bubbles emerald-700 white text; assistant bubbles white bordered; header "✨ Your business advisor"; suggested-question chips restyled as emerald-50 pills.

### 4.10 Settings (`/settings`)

- Section cards restyle only (radius, shadows, emerald accents). No structural change.

### 4.11 Auth pages (`/login`, `/signup`, `/onboarding`)

- Centered card on white with subtle emerald radial glow top-center; brand mark; emerald buttons. No structural change.

---

## 5. Landing Page — "Playful Bazaar" (`app/page.tsx` replaces redirect)

Public, unauthenticated, maximalist. Server component shell + small client component for scroll-reveal observer. Auth-aware header CTA: if a session exists, "Open app →" instead of "Login".

### 5.1 Visual language

- Background: warm cream `#fffbeb` flowing into mint `#ecfdf5` section bands.
- Chunky "comic" cards: white bg, `2px solid #1c1917` border, hard offset shadow (`5px 5px 0 #1c1917`), slight rotations (−2° to 2°).
- Hand-drawn highlight: emerald `#86efac` marker-stroke behind key words (absolutely-positioned rounded div).
- Floating product emojis (🍪🥤🧴📦🧾) with gentle CSS float/wobble keyframes.
- Hinglish copy throughout. Dashed-border badge pills.

### 5.2 Sections (in order)

1. **Hero** — badge "NAMASTE DUKANDAAR! 🙏", headline "Kagaz ka jhanjhat **khatam!** 🎉", sub "Phone se photo kheencho, hisab ho gaya.", CTA "Shuru karo — FREE" (emerald pill, hard bottom shadow, press-down active state), floating emojis raining in on load (staggered `@keyframes drop-in`), comic card showing "📷 SCAN → ✓ DONE · 14 items in 8 seconds".
2. **Marquee strip** — infinite CSS scroll of store types: "🛒 Kirana · 💊 Medical · 🔧 Hardware · 👕 Clothing · 🍽️ Restaurant" on a dark `#1c1917` band with cream text.
3. **How it works** — 3 comic cards (Scan → Confirm → Done) that reveal with stagger + slight rotation snap as you scroll. Each has a big emoji, step number badge, 1-line Hinglish description.
4. **Feature carnival** — 2×3 grid of tilted comic cards: Bill Scan AI, Udhaar tracking, Stock alerts, GST reports, AI salah, Hindi+English. Hover: straighten + lift.
5. **Numbers band** — mint section with three count-up stats ("8 sec per bill", "₹0 to start", "5 languages") animating when scrolled into view.
6. **AI advisor teaser** — fake chat card typing out "Boss, Tuesday ko sales 30% kam hai..." with CSS typing animation.
7. **Final CTA** — big centered "Aaj se hisab pakka." + CTA + small print; confetti-dot CSS sprinkle around button on hover.
8. **Footer** — minimal: brand, login link, language note.

### 5.3 Animation implementation

- One small client component `LandingReveal` registers an `IntersectionObserver` adding `.revealed` to `[data-reveal]` elements; CSS handles transitions (translate/rotate/opacity, staggered via `transition-delay`).
- Float, marquee, typing, drop-in: pure CSS keyframes in a landing-scoped CSS block (globals or module).
- All animations gated by `@media (prefers-reduced-motion: reduce)`.
- No images/fonts beyond system + existing Inter; emojis are the illustration system → zero asset weight.

### 5.4 Routing

- `app/page.tsx` becomes the landing page (public).
- Logged-in users visiting `/` see the landing with "Open app →" header button (no forced redirect; cheap session check server-side).

---

## 6. Non-Goals / Out of Scope

- No dark mode work.
- No structural/data changes to API routes (except dashboard page fetching yesterday + 7-day aggregates — read-only additions to the existing server component).
- No new dependencies (no framer-motion, no confetti libs).
- Share page (`/share/[token]`) gets only token-level restyle (emerald accents) — not redesigned.

## 7. Success Criteria

1. Every screen passes the "one hero" test — a first-time user can say what the most important thing on screen is.
2. Dashboard shows greeting, animated hero profit with sparkline + vs-yesterday pill, consolidated attention card.
3. Mobile bottom nav has the elevated center Scan FAB; all 9 routes still reachable in ≤2 taps from home.
4. Landing page at `/` scores ≥90 Lighthouse performance on mobile (no new deps, CSS-only animation).
5. `npx tsc --noEmit` and `npm run build` pass.
6. All animations disabled under `prefers-reduced-motion`.
