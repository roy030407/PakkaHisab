/**
 * FILE: app/(dashboard)/layout.tsx
 *
 * WHAT THIS DOES:
 *   Session guard for all dashboard routes. Redirects unauthenticated
 *   users to /login. Redirects authenticated users with no store
 *   record to /onboarding. This check exists ONCE here, not per page.
 *
 * CHANGES THIS SESSION:
 *   - Updated: businesses → stores table query
 *   - Added BottomNav import and wrapper layout with pb-16 content padding
 *   - Added desktop Sidebar (md+), BottomNav hidden md+, content takes remaining width
 *
 * WHERE IT FITS:
 *   Wraps all pages under (dashboard)/*. The single point of auth
 *   enforcement for the entire app interior.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (auto-applied to all routes in (dashboard))
 */

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/shared/BottomNav";
import { Sidebar } from "@/components/shared/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
