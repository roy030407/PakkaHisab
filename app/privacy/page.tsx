/**
 * FILE: app/privacy/page.tsx
 *
 * WHAT THIS DOES:
 *   Public "How your data is handled" page. Plain-language, honest statement of
 *   what PakkaHisab stores and does with a merchant's data. Linked from the
 *   landing page (trust block + footer) and the dashboard privacy card.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Model A: honest cloud-privacy messaging)
 *   - Back link follows ?from=dashboard (returns to dashboard vs home)
 *
 * IMPORTANT - truthfulness:
 *   Claims here must stay accurate for the current stack (Supabase cloud + a
 *   cloud AI provider on the free tier). Do NOT add "not used for training",
 *   "stored on your device", or "we never share your data" until the AI tier is
 *   upgraded to a no-train option. See the privacy messaging design spec.
 *
 * WHERE IT FITS:
 *   Public route /privacy. No auth.
 *
 * CALLED BY / IMPORTS FROM:
 *   Linked from app/page.tsx and components/shared/PrivacyCard.tsx
 */
import Link from "next/link"

export const metadata = {
  title: "How your data is handled · PakkaHisab",
  description: "Plain-language explanation of what PakkaHisab does with your business data.",
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-bold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{children}</p>
    </div>
  )
}

export default function PrivacyPage({
  searchParams,
}: {
  searchParams: { from?: string }
}) {
  // Merchants who open this from the dashboard card should land back on the
  // dashboard; everyone else (landing page, footer, direct visit) goes home.
  const fromDashboard = searchParams?.from === "dashboard"
  const backHref = fromDashboard ? "/dashboard" : "/"
  const backLabel = fromDashboard ? "← Dashboard" : "← Home"

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-extrabold text-white">₹</span>
          <span className="text-lg font-extrabold tracking-tight">PakkaHisab</span>
        </Link>
        <Link href={backHref} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">{backLabel}</Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <h1 className="text-3xl font-black tracking-tight">How your data is handled</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          Your business data belongs to you. Here is exactly what we do with it, in plain language.
        </p>

        <Item title="What we store">
          Only the business information you enter or scan - your products, sales, purchases,
          customers, and bills. We store it in a secure cloud database so you can use PakkaHisab
          from any device and never lose your books.
        </Item>

        <Item title="Only you see your books">
          Every store&apos;s data is walled off from every other store. Another shop owner can
          never see your data, and you can never see theirs.
        </Item>

        <Item title="Kept secure">
          Your data is encrypted on the way to our servers and while it is stored.
        </Item>

        <Item title="We do not sell your data">
          We do not sell your business data, and we do not share it with advertisers.
        </Item>

        <Item title="Reading your bills">
          When you scan a bill, the photo is sent securely to our AI provider so it can read the
          items and amounts for you. This is only used to read your bill.
        </Item>

        {/* TODO(privacy): replace [CONTACT_PLACEHOLDER] with a real support contact before launch. */}
        <Item title="Your control">
          Want a copy of your data, or want it deleted? Contact us at [CONTACT_PLACEHOLDER] and we
          will take care of it.
        </Item>

        <p className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-400">
          Last updated: 14 June 2026.
        </p>
      </main>
    </div>
  )
}
