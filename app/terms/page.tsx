/**
 * FILE: app/terms/page.tsx
 *
 * WHAT THIS DOES:
 *   Public Terms of Service page. Plain-language terms for using PakkaHisab.
 *   Linked from the landing page footer and the signup page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Public route /terms. No auth required.
 *
 * CALLED BY / IMPORTS FROM:
 *   Linked from app/page.tsx footer and app/(auth)/signup/page.tsx
 */

import Link from "next/link"

export const metadata = {
  title: "Terms of Service - PakkaHisab",
  description: "Terms of service for using PakkaHisab.",
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-base font-bold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-stone-600">{children}</p>
    </div>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-extrabold text-white">
            ₹
          </span>
          <span className="text-lg font-extrabold tracking-tight">PakkaHisab</span>
        </Link>
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Home
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-20 pt-6">
        <h1 className="text-3xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          By using PakkaHisab you agree to these terms. They are written in plain language
          so you know exactly what to expect.
        </p>

        <Item title="What PakkaHisab is">
          PakkaHisab is a business management tool for Indian SME owners. It helps you scan
          bills, track inventory, manage customers, and understand your profit. It is not a
          certified accounting system or a replacement for a Chartered Accountant.
        </Item>

        <Item title="Your account">
          You need a valid email address to create an account. One account manages one store.
          You are responsible for all activity under your account. Do not share your login
          credentials with others.
        </Item>

        <Item title="Your data">
          You own your business data. We store it securely on our servers to provide the
          service. We do not sell your data. See our{" "}
          <Link href="/privacy" className="font-semibold text-emerald-700 underline hover:text-emerald-800">
            privacy page
          </Link>{" "}
          for full details on how your data is handled.
        </Item>

        <Item title="AI features">
          PakkaHisab uses AI to read bills, suggest orders, and answer business questions.
          AI can make mistakes. Always review AI-generated data before making business
          decisions. We are not liable for errors in AI output.
        </Item>

        <Item title="Acceptable use">
          Use PakkaHisab for legitimate business purposes only. Do not use the service to
          store illegal content, attempt to access other users&apos; data, or overload the
          system with automated requests.
        </Item>

        <Item title="Service availability">
          We aim to keep PakkaHisab available at all times, but we cannot guarantee 100%
          uptime. We may perform maintenance that temporarily limits access. We will try to
          give advance notice when possible.
        </Item>

        <Item title="Termination">
          You can stop using PakkaHisab at any time. Contact us at{" "}
          <a
            href="mailto:harwaniroy@gmail.com"
            className="font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            harwaniroy@gmail.com
          </a>{" "}
          to request data export or account deletion. We may suspend accounts that violate
          these terms.
        </Item>

        <Item title="Changes to these terms">
          We may update these terms occasionally. Continued use of PakkaHisab after changes
          means you accept the updated terms.
        </Item>

        <p className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-400">
          Last updated: 20 June 2026.
        </p>
      </main>
    </div>
  )
}
