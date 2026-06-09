/**
 * FILE: app/api/auth/callback/route.ts
 *
 * WHAT THIS DOES:
 *   Handles Supabase email OTP and magic link callbacks. Exchanges the
 *   auth code for a session then redirects to onboarding or dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Supabase Auth sends the user here after they click the magic link
 *   or enter the OTP. This bridges the email link and a live session.
 *
 * CALLED BY / IMPORTS FROM:
 *   Supabase Auth redirect URL (set in Supabase dashboard)
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
