/**
 * FILE: app/page.tsx
 *
 * WHAT THIS DOES:
 *   Root route — immediately redirects to /login.
 *   The app has no public landing page; all entry is through auth.
 *
 * CHANGES THIS SESSION:
 *   - Replaced default Next.js starter page with auth redirect
 *
 * WHERE IT FITS:
 *   Handles direct navigation to "/". Unauthenticated → /login.
 *   Authenticated users will be handled by the dashboard layout.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (root route)
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
