/**
 * FILE: data/seeds/clothing.ts
 *
 * WHAT THIS DOES:
 *   Sample product catalog for a clothing / garment store.
 *   ~55 items covering men, women, kids, and accessories.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 template import
 *
 * WHERE IT FITS:
 *   Loaded via /api/import/template when store type is "clothing".
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/import/template/route.ts
 */

import type { SeedProduct } from "./kirana"

export const CLOTHING_FIXED_COSTS = [
  { name: "Shop Rent", amount: 25000, frequency: "monthly", category: "rent" },
  { name: "Staff Salary (2 people)", amount: 24000, frequency: "monthly", category: "salaries" },
  { name: "Electricity", amount: 3500, frequency: "monthly", category: "electricity" },
  { name: "Display & Mannequins Maintenance", amount: 1500, frequency: "monthly", category: "other" },
  { name: "Polybags & Packaging", amount: 2000, frequency: "monthly", category: "other" },
]

export const CLOTHING_PRODUCTS: SeedProduct[] = [
  // ─── MEN'S WEAR ──────────────────────────────────────────────────────────────
  { name: "Men's Cotton Shirt (solid)", category: "Men's Wear", subcategory: "Shirts", unit: "piece", purchase_price: 280, selling_price: 499, tax_rate: 5 },
  { name: "Men's Check Shirt", category: "Men's Wear", subcategory: "Shirts", unit: "piece", purchase_price: 320, selling_price: 599, tax_rate: 5 },
  { name: "Men's Formal Shirt", brand: "Arrow", category: "Men's Wear", subcategory: "Shirts", unit: "piece", purchase_price: 500, selling_price: 899, tax_rate: 5 },
  { name: "Men's Round Neck T-Shirt", category: "Men's Wear", subcategory: "T-Shirts", unit: "piece", purchase_price: 150, selling_price: 299, tax_rate: 5 },
  { name: "Men's Polo T-Shirt", category: "Men's Wear", subcategory: "T-Shirts", unit: "piece", purchase_price: 200, selling_price: 399, tax_rate: 5 },
  { name: "Men's Trousers (formal)", category: "Men's Wear", subcategory: "Trousers", unit: "piece", purchase_price: 400, selling_price: 799, tax_rate: 5 },
  { name: "Men's Chinos", category: "Men's Wear", subcategory: "Trousers", unit: "piece", purchase_price: 450, selling_price: 849, tax_rate: 5 },
  { name: "Men's Jeans (regular fit)", category: "Men's Wear", subcategory: "Jeans", unit: "piece", purchase_price: 500, selling_price: 999, tax_rate: 12 },
  { name: "Men's Slim Fit Jeans", category: "Men's Wear", subcategory: "Jeans", unit: "piece", purchase_price: 550, selling_price: 1099, tax_rate: 12 },
  { name: "Men's Kurta (cotton)", category: "Men's Wear", subcategory: "Ethnic", unit: "piece", purchase_price: 350, selling_price: 699, tax_rate: 5 },
  { name: "Men's Kurta Pyjama Set", category: "Men's Wear", subcategory: "Ethnic", unit: "piece", purchase_price: 600, selling_price: 1199, tax_rate: 5 },
  { name: "Men's Waistcoat", category: "Men's Wear", subcategory: "Ethnic", unit: "piece", purchase_price: 400, selling_price: 799, tax_rate: 5 },
  { name: "Men's Blazer", category: "Men's Wear", subcategory: "Formal", unit: "piece", purchase_price: 1200, selling_price: 2499, tax_rate: 12 },
  { name: "Men's Shorts", category: "Men's Wear", subcategory: "Shorts", unit: "piece", purchase_price: 180, selling_price: 349, tax_rate: 5 },
  { name: "Men's Track Pants", category: "Men's Wear", subcategory: "Sportswear", unit: "piece", purchase_price: 220, selling_price: 449, tax_rate: 5 },

  // ─── WOMEN'S WEAR ─────────────────────────────────────────────────────────────
  { name: "Women's Kurti (cotton)", category: "Women's Wear", subcategory: "Kurtis", unit: "piece", purchase_price: 280, selling_price: 599, tax_rate: 5 },
  { name: "Women's Kurti (printed)", category: "Women's Wear", subcategory: "Kurtis", unit: "piece", purchase_price: 320, selling_price: 699, tax_rate: 5 },
  { name: "Women's Kurti Palazzo Set", category: "Women's Wear", subcategory: "Sets", unit: "piece", purchase_price: 550, selling_price: 1099, tax_rate: 5 },
  { name: "Women's Salwar Kameez", category: "Women's Wear", subcategory: "Salwar Suit", unit: "piece", purchase_price: 600, selling_price: 1299, tax_rate: 5 },
  { name: "Women's Anarkali Suit", category: "Women's Wear", subcategory: "Salwar Suit", unit: "piece", purchase_price: 800, selling_price: 1799, tax_rate: 5 },
  { name: "Women's Saree (cotton)", category: "Women's Wear", subcategory: "Sarees", unit: "piece", purchase_price: 400, selling_price: 899, tax_rate: 5 },
  { name: "Women's Saree (synthetic)", category: "Women's Wear", subcategory: "Sarees", unit: "piece", purchase_price: 300, selling_price: 699, tax_rate: 5 },
  { name: "Women's Leggings", category: "Women's Wear", subcategory: "Bottoms", unit: "piece", purchase_price: 120, selling_price: 249, tax_rate: 5 },
  { name: "Women's Churidar", category: "Women's Wear", subcategory: "Bottoms", unit: "piece", purchase_price: 150, selling_price: 299, tax_rate: 5 },
  { name: "Women's Palazzo Pants", category: "Women's Wear", subcategory: "Bottoms", unit: "piece", purchase_price: 200, selling_price: 399, tax_rate: 5 },
  { name: "Women's Top (casual)", category: "Women's Wear", subcategory: "Tops", unit: "piece", purchase_price: 180, selling_price: 349, tax_rate: 5 },
  { name: "Women's Dupatta", category: "Women's Wear", subcategory: "Dupatta", unit: "piece", purchase_price: 100, selling_price: 199, tax_rate: 5 },
  { name: "Women's Nightwear Set", category: "Women's Wear", subcategory: "Nightwear", unit: "piece", purchase_price: 280, selling_price: 599, tax_rate: 5 },

  // ─── KIDS' WEAR ───────────────────────────────────────────────────────────────
  { name: "Boy's T-Shirt (age 2-12)", category: "Kids' Wear", subcategory: "T-Shirts", unit: "piece", purchase_price: 100, selling_price: 199, tax_rate: 5 },
  { name: "Boy's Shirt (age 2-12)", category: "Kids' Wear", subcategory: "Shirts", unit: "piece", purchase_price: 150, selling_price: 299, tax_rate: 5 },
  { name: "Boy's Jeans (age 2-12)", category: "Kids' Wear", subcategory: "Jeans", unit: "piece", purchase_price: 250, selling_price: 499, tax_rate: 5 },
  { name: "Boy's Shorts", category: "Kids' Wear", subcategory: "Shorts", unit: "piece", purchase_price: 120, selling_price: 249, tax_rate: 5 },
  { name: "Girl's Frock / Dress", category: "Kids' Wear", subcategory: "Dresses", unit: "piece", purchase_price: 200, selling_price: 399, tax_rate: 5 },
  { name: "Girl's Lehenga Set", category: "Kids' Wear", subcategory: "Ethnic", unit: "piece", purchase_price: 350, selling_price: 699, tax_rate: 5 },
  { name: "Girl's Kurti (age 6-14)", category: "Kids' Wear", subcategory: "Kurtis", unit: "piece", purchase_price: 180, selling_price: 349, tax_rate: 5 },
  { name: "Kids' Track Suit", category: "Kids' Wear", subcategory: "Sportswear", unit: "piece", purchase_price: 280, selling_price: 549, tax_rate: 5 },
  { name: "School Uniform Shirt (white)", category: "Kids' Wear", subcategory: "School", unit: "piece", purchase_price: 120, selling_price: 249, tax_rate: 5 },
  { name: "School Uniform Trousers (grey)", category: "Kids' Wear", subcategory: "School", unit: "piece", purchase_price: 150, selling_price: 299, tax_rate: 5 },

  // ─── ACCESSORIES ─────────────────────────────────────────────────────────────
  { name: "Men's Leather Belt", category: "Accessories", subcategory: "Belts", unit: "piece", purchase_price: 120, selling_price: 249, tax_rate: 12 },
  { name: "Women's Belt (fabric)", category: "Accessories", subcategory: "Belts", unit: "piece", purchase_price: 80, selling_price: 149, tax_rate: 12 },
  { name: "Men's Socks (pack of 3)", category: "Accessories", subcategory: "Socks", unit: "piece", purchase_price: 80, selling_price: 149, tax_rate: 12 },
  { name: "Women's Socks (pack of 3)", category: "Accessories", subcategory: "Socks", unit: "piece", purchase_price: 70, selling_price: 129, tax_rate: 12 },
  { name: "Men's Wallet", category: "Accessories", subcategory: "Wallets", unit: "piece", purchase_price: 150, selling_price: 299, tax_rate: 12 },
  { name: "Women's Handbag (small)", category: "Accessories", subcategory: "Handbags", unit: "piece", purchase_price: 250, selling_price: 499, tax_rate: 12 },
  { name: "Handkerchief (pack of 5)", category: "Accessories", subcategory: "Handkerchiefs", unit: "piece", purchase_price: 80, selling_price: 149, tax_rate: 5 },
  { name: "Men's Innerwear Vest", brand: "Rupa", category: "Innerwear", subcategory: "Men", unit: "piece", purchase_price: 80, selling_price: 149, tax_rate: 5 },
  { name: "Men's Brief (pack of 3)", brand: "Jockey", category: "Innerwear", subcategory: "Men", unit: "piece", purchase_price: 200, selling_price: 399, tax_rate: 5 },
  { name: "Women's Innerwear Set", brand: "Enamor", category: "Innerwear", subcategory: "Women", unit: "piece", purchase_price: 200, selling_price: 399, tax_rate: 5 },
]
