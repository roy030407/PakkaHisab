/**
 * FILE: app/api/stores/seed/route.ts
 *
 * WHAT THIS DOES:
 *   POST: seeds the calling user's store with sample products and fixed costs
 *   appropriate for their store type. Called after store creation when the
 *   merchant opts in to sample data during onboarding.
 *   Safe to call only once - if the store already has products, it returns
 *   without inserting duplicates.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1b (sample store feature)
 *
 * WHERE IT FITS:
 *   Called by app/(auth)/onboarding/page.tsx when wantsSampleStore = true.
 *   Uses data/seeds/*.ts as the source - no Kaggle API at runtime.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(auth)/onboarding/page.tsx (POST after store creation)
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KIRANA_PRODUCTS, KIRANA_FIXED_COSTS } from "@/data/seeds/kirana";
import { MEDICAL_PRODUCTS, MEDICAL_FIXED_COSTS } from "@/data/seeds/medical";
import { HARDWARE_PRODUCTS, HARDWARE_FIXED_COSTS } from "@/data/seeds/hardware";
import type { SeedProduct } from "@/data/seeds/kirana";

type SeedCost = {
  name: string;
  amount: number;
  frequency: string;
  category: string;
};

const SEED_MAP: Record<
  string,
  { products: SeedProduct[]; costs: SeedCost[] }
> = {
  kirana: { products: KIRANA_PRODUCTS, costs: KIRANA_FIXED_COSTS },
  medical: { products: MEDICAL_PRODUCTS, costs: MEDICAL_FIXED_COSTS },
  pharmacy: { products: MEDICAL_PRODUCTS, costs: MEDICAL_FIXED_COSTS },
  hardware: { products: HARDWARE_PRODUCTS, costs: HARDWARE_FIXED_COSTS },
};

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, type")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // If the store already has products, skip seeding
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ skipped: true, reason: "Store already has products" });
  }

  const seed = SEED_MAP[store.type];
  if (!seed) {
    return NextResponse.json({ skipped: true, reason: "No sample data for this store type" });
  }

  // Insert products in batches of 20 to stay within Supabase limits
  const BATCH = 20;
  let inserted = 0;

  for (let i = 0; i < seed.products.length; i += BATCH) {
    const batch = seed.products.slice(i, i + BATCH).map((p) => ({
      store_id: store.id,
      item_number: 0, // trigger assigns sequential number
      name: p.name,
      brand: p.brand ?? null,
      category: p.category ?? null,
      subcategory: p.subcategory ?? null,
      unit: p.unit,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      tax_rate: p.tax_rate,
      shelf_life_days: p.shelf_life_days ?? null,
    }));

    const { error } = await supabase.from("products").insert(batch);
    if (error) {
      // Log but don't fail - partial seed is better than none
      console.error("Seed batch error:", error.message);
    } else {
      inserted += batch.length;
    }
  }

  // Insert fixed costs
  let costsInserted = 0;
  if (seed.costs.length > 0) {
    const costsPayload = seed.costs.map((c) => ({
      store_id: store.id,
      ...c,
    }));
    const { error: costErr } = await supabase
      .from("fixed_costs")
      .insert(costsPayload);
    if (!costErr) costsInserted = seed.costs.length;
  }

  return NextResponse.json({
    seeded: true,
    productsInserted: inserted,
    costsInserted,
  });
}
