/**
 * FILE: lib/supabase/server.ts
 *
 * WHAT THIS DOES:
 *   Creates Supabase server clients for use in API routes and Server
 *   Components - one with the user's JWT (RLS enforced), one with the
 *   service role (webhook handler only).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Used in all /app/api/** route.ts files and Server Components to
 *   access authenticated user data with RLS enforced.
 *
 * CALLED BY / IMPORTS FROM:
 *   All API routes, dashboard layout, auth callback
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component - cookies are read-only in RSC. Ignored safely.
          }
        },
      },
    }
  );
}

// Use ONLY in server-side webhook handlers. Never in user-facing routes.
export function createSupabaseServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    }
  );
}
