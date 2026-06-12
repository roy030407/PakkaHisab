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
