/**
 * FILE: data/seeds/index.ts
 *
 * WHAT THIS DOES:
 *   Single export point for all store template seed data.
 *   Maps store type strings to their product catalog + fixed costs.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 template import
 *
 * WHERE IT FITS:
 *   Imported by /api/import/template to load the right template.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/import/template/route.ts
 */

import { KIRANA_PRODUCTS, KIRANA_FIXED_COSTS } from "./kirana"
import { MEDICAL_PRODUCTS, MEDICAL_FIXED_COSTS } from "./medical"
import { HARDWARE_PRODUCTS, HARDWARE_FIXED_COSTS } from "./hardware"
import { RESTAURANT_PRODUCTS, RESTAURANT_FIXED_COSTS } from "./restaurant"
import { CLOTHING_PRODUCTS, CLOTHING_FIXED_COSTS } from "./clothing"
import type { SeedProduct } from "./kirana"

export interface FixedCostSeed {
  name: string
  amount: number
  frequency: string
  category: string
}

export interface StoreTemplate {
  products: SeedProduct[]
  fixedCosts: FixedCostSeed[]
}

export const STORE_TEMPLATES: Record<string, StoreTemplate> = {
  kirana: { products: KIRANA_PRODUCTS, fixedCosts: KIRANA_FIXED_COSTS },
  medical: { products: MEDICAL_PRODUCTS, fixedCosts: MEDICAL_FIXED_COSTS },
  hardware: { products: HARDWARE_PRODUCTS, fixedCosts: HARDWARE_FIXED_COSTS },
  restaurant: { products: RESTAURANT_PRODUCTS, fixedCosts: RESTAURANT_FIXED_COSTS },
  clothing: { products: CLOTHING_PRODUCTS, fixedCosts: CLOTHING_FIXED_COSTS },
  pharmacy: { products: MEDICAL_PRODUCTS, fixedCosts: MEDICAL_FIXED_COSTS },
}

export const TEMPLATE_NAMES: Record<string, string> = {
  kirana: "Kirana Store",
  medical: "Medical Shop",
  hardware: "Hardware Store",
  restaurant: "Restaurant / Dhaba",
  clothing: "Clothing Store",
  pharmacy: "Pharmacy",
}
