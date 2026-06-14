# Data Privacy Messaging (Model A) - Design Spec

Date: 2026-06-14
Status: Approved (pending spec review)
Owner: Roy Harwani

## Problem

Small business owners distrust apps that collect their data. PakkaHisab needs to
communicate, simply and honestly, that the owner's business data is private to
them - on the landing page and on the dashboard. The constraint is that the
current architecture is cloud-based (Supabase + a cloud AI provider), so the
messaging must be truthful about that and must NOT over-claim.

This is "Model A": honest cloud-privacy messaging. It does not change where data
is stored. It adds clear, accurate communication plus a privacy page.

## Goals

- A public, linkable privacy page that states only true claims.
- A short trust block on the landing page.
- A small, dismissible trust card on the dashboard home.
- All wording is accurate for the current stack and avoids any "not used for
  training" or "stored on your device" claims.

## Non-goals (explicitly out of scope for this build)

- Export-my-data button.
- Delete-my-data / delete-account button.
- Switching the AI provider/tier (deferred; see "Truthfulness constraints").
- Multi-language copy (English only for now).
- Any change to where or how data is stored.

## Decisions (from brainstorm)

| Topic | Decision |
| --- | --- |
| AI tier | Decide later. Copy must NOT claim "not used for training". Upgrade the tier before advertising that. |
| Scope | Messaging only: privacy page + landing block + dashboard card. No export/delete. |
| Language | English only. |
| Contact for data requests | Placeholder for now (no real email yet). |
| Structure | Approach A: one dedicated `/privacy` page as the source of truth; landing block and dashboard card link to it. |

## Truthfulness constraints (the whole point)

The app uses Gemini's FREE tier (lib/anthropic/client.ts), whose terms allow
Google to use prompts/images to improve their products. Therefore, until the
tier is changed:

- DO NOT claim: "your data is never used for training", "we never share your
  data", "your data stays on your device", "100% offline", "even we can't see
  it".
- It IS true and may be claimed: data is stored in a secure cloud database,
  each store is isolated from others, data is encrypted in transit and at rest
  (Supabase default), we do not sell your data, and bill photos are sent to an
  AI provider to read them.

These constraints are encoded directly in the copy below.

## Components

### 1. Privacy page - `app/privacy/page.tsx` (NEW, public route)

A plain, scannable page. Server component, no auth. Uses the app's existing
landing/typography styles for consistency. Sections and approved copy:

- Title: "How your data is handled"
- Intro: "Your business data belongs to you. Here is exactly what we do with it,
  in plain language."
- "What we store": "Only the business information you enter or scan - your
  products, sales, purchases, customers, and bills. We store it in a secure
  cloud database so you can use PakkaHisab from any device and never lose your
  books."
- "Only you see your books": "Every store's data is walled off from every other
  store. Another shop owner can never see your data, and you can never see
  theirs."
- "Kept secure": "Your data is encrypted on the way to our servers and while it
  is stored."
- "We do not sell your data": "We do not sell your business data, and we do not
  share it with advertisers."
- "Reading your bills": "When you scan a bill, the photo is sent securely to our
  AI provider so it can read the items and amounts for you. This is only used to
  read your bill."
- "Your control": "Want a copy of your data, or want it deleted? Contact us at
  [CONTACT_PLACEHOLDER] and we will take care of it."
- Footer: "Last updated: 14 June 2026."

Note: `[CONTACT_PLACEHOLDER]` stays literally as a clearly-marked placeholder
until a real contact exists.

### 2. Landing trust block - `app/page.tsx` (MODIFY)

A short section (reusing the existing comic/card visual style), placed near the
existing trust section. Copy:

- Heading: "Your shop's data stays yours"
- Three one-liners:
  - "Only you can see your books."
  - "We never sell your data."
  - "Your books, backed up safely in the cloud."
- Link: "Read our privacy promise ->" to `/privacy`.

### 3. Dashboard trust card - `components/shared/PrivacyCard.tsx` (NEW), rendered on `app/(dashboard)/dashboard/page.tsx` (MODIFY)

A small, dismissible card. Client component (needs localStorage for dismissal).

- Text: "Private to you - we never sell your data."
- Link: "How we handle your data ->" to `/privacy`.
- Dismiss: an x; dismissal is remembered in localStorage key
  `pakkahisab.privacyCardDismissed` so it does not nag every visit.
- Placement: in the dashboard right rail (desktop) and the mobile section,
  below the existing insight area, styled to match (rounded, subtle border).

## Files touched

- Create `app/privacy/page.tsx`
- Create `components/shared/PrivacyCard.tsx`
- Modify `app/page.tsx` (add the trust block + link)
- Modify `app/(dashboard)/dashboard/page.tsx` (render PrivacyCard)

## Error handling / edge cases

- Privacy page is static; no data fetching, so no error states.
- PrivacyCard: guard `localStorage` access for SSR (only read after mount) to
  avoid hydration mismatch; if storage is unavailable, the card simply always
  shows.

## Testing

- Manual: `/privacy` renders and is reachable from the landing link and the
  dashboard card; the dashboard card dismisses and stays dismissed on reload.
- No unit tests needed (static copy + a localStorage toggle); a future export/
  delete build will warrant route tests.

## Future (not now)

- Export + delete controls in Settings (the verifiable backing for "your
  control").
- Upgrade AI tier to a no-train option, then add the stronger "never used for
  training" line to the privacy page.
- Translate copy to the merchant's preferred language.

## Open questions

None. (Contact is an intentional placeholder; tier upgrade is intentionally
deferred.)
