/**
 * FILE: data/seeds/hardware.ts
 *
 * WHAT THIS DOES:
 *   Sample product catalog for a hardware store.
 *   ~60 common fasteners, tools, plumbing, electrical, and building materials.
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

export const HARDWARE_PRODUCTS: SeedProduct[] = [
  // ─── FASTENERS ───────────────────────────────────────────────────────────────
  { name: "Nails 2 inch (1kg)", category: "Fasteners", unit: "kg", purchase_price: 65, selling_price: 80, tax_rate: 18 },
  { name: "Nails 3 inch (1kg)", category: "Fasteners", unit: "kg", purchase_price: 65, selling_price: 80, tax_rate: 18 },
  { name: "Wood Screws Assorted Box 100pc", category: "Fasteners", unit: "box", purchase_price: 90, selling_price: 110, tax_rate: 18 },
  { name: "Nut Bolt M8 x 40mm (Pack 10)", category: "Fasteners", unit: "piece", purchase_price: 45, selling_price: 55, tax_rate: 18 },
  { name: "Rawl Plugs Pack 50", category: "Fasteners", unit: "piece", purchase_price: 35, selling_price: 45, tax_rate: 18 },
  { name: "Anchor Bolt M10 (Pack 4)", category: "Fasteners", unit: "piece", purchase_price: 55, selling_price: 68, tax_rate: 18 },

  // ─── HAND TOOLS ──────────────────────────────────────────────────────────────
  { name: "Hammer 500g", brand: "Stanley", category: "Hand Tools", unit: "piece", purchase_price: 185, selling_price: 225, tax_rate: 18 },
  { name: "Screwdriver Set 6pc", brand: "Taparia", category: "Hand Tools", unit: "piece", purchase_price: 220, selling_price: 270, tax_rate: 18 },
  { name: "Adjustable Spanner 12 inch", brand: "Taparia", category: "Hand Tools", unit: "piece", purchase_price: 350, selling_price: 425, tax_rate: 18 },
  { name: "Measuring Tape 5m", brand: "Stanley", category: "Hand Tools", unit: "piece", purchase_price: 145, selling_price: 175, tax_rate: 18 },
  { name: "Hacksaw Frame + Blade", category: "Hand Tools", unit: "piece", purchase_price: 95, selling_price: 118, tax_rate: 18 },
  { name: "Pliers Combination 8 inch", brand: "Taparia", category: "Hand Tools", unit: "piece", purchase_price: 175, selling_price: 215, tax_rate: 18 },
  { name: "Spirit Level 24 inch", category: "Hand Tools", unit: "piece", purchase_price: 180, selling_price: 220, tax_rate: 18 },
  { name: "Chisel Set 4pc", category: "Hand Tools", unit: "piece", purchase_price: 280, selling_price: 340, tax_rate: 18 },

  // ─── ELECTRICAL ──────────────────────────────────────────────────────────────
  { name: "MCB 6A Single Pole", brand: "Legrand", category: "Electrical", unit: "piece", purchase_price: 155, selling_price: 190, tax_rate: 18 },
  { name: "MCB 16A Single Pole", brand: "Legrand", category: "Electrical", unit: "piece", purchase_price: 165, selling_price: 200, tax_rate: 18 },
  { name: "Wire 1.5sqmm (50m Roll)", brand: "Polycab", category: "Electrical", unit: "piece", purchase_price: 680, selling_price: 820, tax_rate: 18 },
  { name: "Wire 2.5sqmm (50m Roll)", brand: "Polycab", category: "Electrical", unit: "piece", purchase_price: 950, selling_price: 1150, tax_rate: 18 },
  { name: "3-Pin Socket 6A", brand: "Anchor", category: "Electrical", unit: "piece", purchase_price: 55, selling_price: 68, tax_rate: 18 },
  { name: "Switch 6A", brand: "Anchor", category: "Electrical", unit: "piece", purchase_price: 35, selling_price: 44, tax_rate: 18 },
  { name: "LED Bulb 9W Warm White", brand: "Philips", category: "Electrical", unit: "piece", purchase_price: 65, selling_price: 80, tax_rate: 12 },
  { name: "Tube Light LED 20W 4ft", brand: "Syska", category: "Electrical", unit: "piece", purchase_price: 280, selling_price: 340, tax_rate: 12 },
  { name: "Extension Board 4 Socket 1.5m", brand: "Anchor", category: "Electrical", unit: "piece", purchase_price: 180, selling_price: 220, tax_rate: 18 },
  { name: "Electrical Tape (Roll)", brand: "3M", category: "Electrical", unit: "piece", purchase_price: 35, selling_price: 45, tax_rate: 18 },

  // ─── PLUMBING ────────────────────────────────────────────────────────────────
  { name: "CPVC Pipe 1 inch 3m", brand: "Astral", category: "Plumbing", unit: "piece", purchase_price: 165, selling_price: 200, tax_rate: 18 },
  { name: "CPVC Elbow 1 inch", category: "Plumbing", unit: "piece", purchase_price: 18, selling_price: 22, tax_rate: 18 },
  { name: "CPVC Tee 1 inch", category: "Plumbing", unit: "piece", purchase_price: 22, selling_price: 28, tax_rate: 18 },
  { name: "Ball Valve 1 inch", category: "Plumbing", unit: "piece", purchase_price: 95, selling_price: 118, tax_rate: 18 },
  { name: "Bib Cock Tap", brand: "Jaquar", category: "Plumbing", unit: "piece", purchase_price: 280, selling_price: 350, tax_rate: 18 },
  { name: "Teflon Thread Seal Tape", category: "Plumbing", unit: "piece", purchase_price: 15, selling_price: 20, tax_rate: 18 },
  { name: "Float Valve 1/2 inch", category: "Plumbing", unit: "piece", purchase_price: 65, selling_price: 80, tax_rate: 18 },
  { name: "PVC Pipe 4 inch 3m", category: "Plumbing", unit: "piece", purchase_price: 280, selling_price: 345, tax_rate: 18 },

  // ─── PAINTS ──────────────────────────────────────────────────────────────────
  { name: "Asian Paints Primer 1L", brand: "Asian Paints", category: "Paints", unit: "litre", purchase_price: 165, selling_price: 200, tax_rate: 18 },
  { name: "Asian Paints Emulsion 1L (White)", brand: "Asian Paints", category: "Paints", unit: "litre", purchase_price: 250, selling_price: 305, tax_rate: 18 },
  { name: "Berger Bison Paint 1L", brand: "Berger", category: "Paints", unit: "litre", purchase_price: 220, selling_price: 268, tax_rate: 18 },
  { name: "Putty 2kg (Wall Putty)", brand: "JK Cement", category: "Paints", unit: "piece", purchase_price: 145, selling_price: 176, tax_rate: 18 },
  { name: "Paint Brush 2 inch", category: "Paints", unit: "piece", purchase_price: 28, selling_price: 36, tax_rate: 18 },
  { name: "Paint Roller 9 inch Kit", category: "Paints", unit: "piece", purchase_price: 95, selling_price: 120, tax_rate: 18 },

  // ─── ADHESIVES & SEALANTS ─────────────────────────────────────────────────────
  { name: "Fevicol SH 1kg", brand: "Pidilite", category: "Adhesives", unit: "piece", purchase_price: 160, selling_price: 195, tax_rate: 18 },
  { name: "M-Seal Epoxy 50g", brand: "Pidilite", category: "Adhesives", unit: "piece", purchase_price: 38, selling_price: 46, tax_rate: 18 },
  { name: "Silicone Sealant 300ml", brand: "Sika", category: "Adhesives", unit: "piece", purchase_price: 155, selling_price: 190, tax_rate: 18 },
  { name: "Araldite Fast Set 90ml", brand: "Ciba", category: "Adhesives", unit: "piece", purchase_price: 78, selling_price: 95, tax_rate: 18 },

  // ─── SAFETY ──────────────────────────────────────────────────────────────────
  { name: "Safety Helmet", category: "Safety", unit: "piece", purchase_price: 120, selling_price: 150, tax_rate: 18 },
  { name: "Safety Gloves (Pair)", category: "Safety", unit: "piece", purchase_price: 35, selling_price: 45, tax_rate: 18 },
  { name: "Safety Goggles", category: "Safety", unit: "piece", purchase_price: 65, selling_price: 80, tax_rate: 18 },
  { name: "Dust Mask N95", category: "Safety", unit: "piece", purchase_price: 25, selling_price: 32, tax_rate: 12 },
  { name: "Fire Extinguisher 1kg ABC", category: "Safety", unit: "piece", purchase_price: 650, selling_price: 800, tax_rate: 18 },

  // ─── BUILDING MATERIALS ───────────────────────────────────────────────────────
  { name: "Cement 50kg Bag", brand: "Ultratech", category: "Building", unit: "piece", purchase_price: 375, selling_price: 420, tax_rate: 28 },
  { name: "M Sand (per 100kg)", category: "Building", unit: "piece", purchase_price: 450, selling_price: 560, tax_rate: 5 },
  { name: "Steel Rod 8mm (per kg)", brand: "SAIL", category: "Building", unit: "kg", purchase_price: 62, selling_price: 75, tax_rate: 18 },
  { name: "Plywood 8x4 ft 12mm", brand: "Greenply", category: "Building", unit: "piece", purchase_price: 950, selling_price: 1160, tax_rate: 18 },
  { name: "Ceramic Floor Tile 2x2 ft", category: "Building", unit: "piece", purchase_price: 35, selling_price: 44, tax_rate: 18 },
];

export const HARDWARE_FIXED_COSTS = [
  { name: "Shop rent", amount: 15000, frequency: "monthly", category: "rent" },
  { name: "Electricity bill", amount: 3000, frequency: "monthly", category: "electricity" },
  { name: "Staff salary", amount: 12000, frequency: "monthly", category: "salaries" },
  { name: "Transport / delivery", amount: 4000, frequency: "monthly", category: "transport" },
];
