/**
 * FILE: data/seeds/medical.ts
 *
 * WHAT THIS DOES:
 *   Sample product catalog for a medical / pharmacy store.
 *   ~60 common OTC medicines, health supplements, and medical supplies.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1b sample store feature
 *
 * WHERE IT FITS:
 *   Read by app/api/stores/seed/route.ts at onboarding.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/stores/seed/route.ts
 */

import type { SeedProduct } from "./kirana";

export const MEDICAL_PRODUCTS: SeedProduct[] = [
  // ─── PAIN & FEVER ────────────────────────────────────────────────────────────
  { name: "Crocin 500mg (Strip 10)", brand: "GSK", category: "Pain & Fever", unit: "piece", purchase_price: 20, selling_price: 24, tax_rate: 12 },
  { name: "Dolo 650mg (Strip 10)", brand: "Micro Labs", category: "Pain & Fever", unit: "piece", purchase_price: 28, selling_price: 33, tax_rate: 12 },
  { name: "Combiflam (Strip 10)", brand: "Sanofi", category: "Pain & Fever", unit: "piece", purchase_price: 30, selling_price: 36, tax_rate: 12 },
  { name: "Brufen 400mg (Strip 10)", brand: "Abbott", category: "Pain & Fever", unit: "piece", purchase_price: 22, selling_price: 27, tax_rate: 12 },
  { name: "Volini Pain Relief Spray 100g", brand: "Ranbaxy", category: "Pain & Fever", unit: "piece", purchase_price: 135, selling_price: 162, tax_rate: 12 },
  { name: "Moov Strong Cream 50g", brand: "Reckitt", category: "Pain & Fever", unit: "piece", purchase_price: 85, selling_price: 102, tax_rate: 12 },

  // ─── COLD & COUGH ────────────────────────────────────────────────────────────
  { name: "Sinarest (Strip 10)", brand: "Centaur", category: "Cold & Cough", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 12 },
  { name: "Cetirizine 10mg (Strip 10)", category: "Cold & Cough", unit: "piece", purchase_price: 18, selling_price: 22, tax_rate: 12 },
  { name: "Benadryl Cough Syrup 100ml", brand: "Pfizer", category: "Cold & Cough", unit: "piece", purchase_price: 68, selling_price: 82, tax_rate: 12 },
  { name: "Corex Cough Syrup 100ml", brand: "Pfizer", category: "Cold & Cough", unit: "piece", purchase_price: 62, selling_price: 74, tax_rate: 12 },
  { name: "Zandu Balm 25ml", brand: "Zandu", category: "Cold & Cough", unit: "piece", purchase_price: 38, selling_price: 46, tax_rate: 12 },
  { name: "Vicks VapoRub 25ml", brand: "P&G", category: "Cold & Cough", unit: "piece", purchase_price: 52, selling_price: 62, tax_rate: 12 },

  // ─── DIGESTION ───────────────────────────────────────────────────────────────
  { name: "Eno Fruit Salt 5g", brand: "GSK", category: "Digestion", unit: "piece", purchase_price: 8, selling_price: 10, tax_rate: 12 },
  { name: "Digene Gel 200ml", brand: "Abbott", category: "Digestion", unit: "piece", purchase_price: 82, selling_price: 99, tax_rate: 12 },
  { name: "Pudin Hara Pearls (Bottle 30)", brand: "Dabur", category: "Digestion", unit: "piece", purchase_price: 45, selling_price: 55, tax_rate: 12 },
  { name: "Metformin 500mg (Strip 10)", category: "Diabetes", unit: "piece", purchase_price: 22, selling_price: 26, tax_rate: 5 },
  { name: "Norflox 400mg (Strip 10)", category: "Antibiotics", unit: "piece", purchase_price: 35, selling_price: 42, tax_rate: 12 },
  { name: "Pan 40mg (Strip 10)", brand: "Alkem", category: "Digestion", unit: "piece", purchase_price: 55, selling_price: 66, tax_rate: 12 },
  { name: "ORS Sachet Lemon (10 Pack)", brand: "Electral", category: "Digestion", unit: "piece", purchase_price: 30, selling_price: 36, tax_rate: 5 },

  // ─── VITAMINS & SUPPLEMENTS ──────────────────────────────────────────────────
  { name: "Becosules Capsules 20", brand: "Pfizer", category: "Vitamins", unit: "piece", purchase_price: 42, selling_price: 50, tax_rate: 5 },
  { name: "Revital H (Strip 10)", brand: "Reckitt", category: "Vitamins", unit: "piece", purchase_price: 75, selling_price: 90, tax_rate: 5 },
  { name: "Vitamin C 500mg (Strip 10)", category: "Vitamins", unit: "piece", purchase_price: 28, selling_price: 34, tax_rate: 5 },
  { name: "Calcium Sandoz Forte (Strip 10)", brand: "Sandoz", category: "Vitamins", unit: "piece", purchase_price: 65, selling_price: 78, tax_rate: 5 },
  { name: "Livogen (Strip 10)", brand: "Merck", category: "Vitamins", unit: "piece", purchase_price: 48, selling_price: 58, tax_rate: 5 },
  { name: "D-Rise 60k (Strip 4)", brand: "USV", category: "Vitamins", unit: "piece", purchase_price: 52, selling_price: 62, tax_rate: 5 },

  // ─── SKIN CARE ───────────────────────────────────────────────────────────────
  { name: "Betadine Ointment 15g", brand: "Win Medicare", category: "Wound Care", unit: "piece", purchase_price: 68, selling_price: 82, tax_rate: 12 },
  { name: "Soframycin Skin Cream 25g", brand: "Roussel", category: "Wound Care", unit: "piece", purchase_price: 72, selling_price: 87, tax_rate: 12 },
  { name: "Band-Aid (10 pieces)", brand: "J&J", category: "Wound Care", unit: "piece", purchase_price: 38, selling_price: 46, tax_rate: 12 },
  { name: "Cotton Bandage 5cm x 5m", category: "Wound Care", unit: "piece", purchase_price: 18, selling_price: 22, tax_rate: 12 },
  { name: "Dettol Antiseptic 250ml", brand: "Reckitt", category: "Wound Care", unit: "piece", purchase_price: 120, selling_price: 144, tax_rate: 18 },

  // ─── BLOOD PRESSURE / HEART ──────────────────────────────────────────────────
  { name: "Amlodipine 5mg (Strip 10)", category: "Cardiology", unit: "piece", purchase_price: 25, selling_price: 30, tax_rate: 5 },
  { name: "Telmisartan 40mg (Strip 10)", category: "Cardiology", unit: "piece", purchase_price: 45, selling_price: 54, tax_rate: 5 },
  { name: "Ecosprin 75mg (Strip 14)", brand: "USV", category: "Cardiology", unit: "piece", purchase_price: 18, selling_price: 22, tax_rate: 5 },

  // ─── BABY & MOTHER CARE ──────────────────────────────────────────────────────
  { name: "Johnson Baby Powder 100g", brand: "J&J", category: "Baby Care", unit: "piece", purchase_price: 68, selling_price: 82, tax_rate: 18 },
  { name: "Pampers S (30 pcs)", brand: "P&G", category: "Baby Care", unit: "piece", purchase_price: 340, selling_price: 410, tax_rate: 18 },
  { name: "Nestlé NAN Pro 1 400g", brand: "Nestlé", category: "Baby Care", unit: "piece", purchase_price: 430, selling_price: 515, tax_rate: 18 },

  // ─── MEDICAL DEVICES ─────────────────────────────────────────────────────────
  { name: "Glucometer Test Strip (25 pcs)", brand: "Accu-Chek", category: "Devices", unit: "piece", purchase_price: 320, selling_price: 385, tax_rate: 12 },
  { name: "Digital Thermometer", category: "Devices", unit: "piece", purchase_price: 125, selling_price: 150, tax_rate: 12 },
  { name: "BP Monitor Wrist Type", category: "Devices", unit: "piece", purchase_price: 900, selling_price: 1100, tax_rate: 12 },
  { name: "Nebulizer Kit", category: "Devices", unit: "piece", purchase_price: 1600, selling_price: 1950, tax_rate: 12 },
  { name: "Syringes 2ml (Box 10)", category: "Consumables", unit: "box", purchase_price: 28, selling_price: 35, tax_rate: 12 },
  { name: "Surgical Gloves Medium (Pair)", category: "Consumables", unit: "piece", purchase_price: 12, selling_price: 15, tax_rate: 12 },
  { name: "N95 Mask (Pack 5)", category: "Consumables", unit: "piece", purchase_price: 75, selling_price: 95, tax_rate: 12 },

  // ─── EYE & EAR ──────────────────────────────────────────────────────────────
  { name: "Visine Eye Drops 10ml", brand: "J&J", category: "Eye & Ear", unit: "piece", purchase_price: 85, selling_price: 102, tax_rate: 12 },
  { name: "Cineraria Maritima Eye Drops", brand: "SBL", category: "Eye & Ear", unit: "piece", purchase_price: 55, selling_price: 66, tax_rate: 12 },
  { name: "Otrivin Nasal Spray 10ml", brand: "Novartis", category: "Eye & Ear", unit: "piece", purchase_price: 95, selling_price: 115, tax_rate: 12 },

  // ─── HEALTH FOODS ────────────────────────────────────────────────────────────
  { name: "Ensure Powder 200g", brand: "Abbott", category: "Health Food", unit: "piece", purchase_price: 350, selling_price: 425, tax_rate: 18 },
  { name: "Protinex Original 250g", brand: "Danone", category: "Health Food", unit: "piece", purchase_price: 290, selling_price: 352, tax_rate: 18 },
  { name: "Zandu Chyawanprash 450g", brand: "Zandu", category: "Health Food", unit: "piece", purchase_price: 155, selling_price: 188, tax_rate: 5 },
  { name: "Dabur Chyawanprash 500g", brand: "Dabur", category: "Health Food", unit: "piece", purchase_price: 168, selling_price: 202, tax_rate: 5 },
];

export const MEDICAL_FIXED_COSTS = [
  { name: "Shop rent", amount: 18000, frequency: "monthly", category: "rent" },
  { name: "Electricity bill", amount: 2500, frequency: "monthly", category: "electricity" },
  { name: "Pharmacist salary", amount: 25000, frequency: "monthly", category: "salaries" },
  { name: "Helper salary", amount: 10000, frequency: "monthly", category: "salaries" },
  { name: "Delivery expenses", amount: 1500, frequency: "monthly", category: "transport" },
];
