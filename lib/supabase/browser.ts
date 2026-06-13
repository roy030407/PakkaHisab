/**
 * FILE: lib/supabase/browser.ts
 *
 * WHAT THIS DOES:
 *   Creates a Supabase browser client for use in Client Components.
 *   Call this function to get a client - do not share a singleton across
 *   renders to avoid stale session state.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Used in Client Components for auth operations (OTP send/verify)
 *   and client-side data hooks.
 *
 * CALLED BY / IMPORTS FROM:
 *   Login page, signup page, hooks/
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
