/**
 * FILE: app/(dashboard)/dashboard/page.tsx
 *
 * WHAT THIS DOES:
 *   Placeholder dashboard page confirming Phase 1 is complete.
 *   Will be replaced with the full dashboard in Phase 4.
 *
 * CHANGES THIS SESSION:
 *   - Updated: businesses → stores table query
 *
 * WHERE IT FITS:
 *   Landing page after successful auth + onboarding.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, all auth success redirects
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/PageHeader";

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: store } = await supabase
    .from("stores")
    .select("name, owner_name, type, preferred_language")
    .eq("owner_id", user!.id)
    .single();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader
        title={`Welcome, ${store?.owner_name ?? "there"}`}
        subtitle={store?.name ?? "PakkaHisab — your business operating system"}
      />
      <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-800">
        Phase 1 complete. Auth and store setup are working. Dashboard coming next.
      </div>
    </div>
  );
}
