/**
 * FILE: data/seeds/restaurant.ts
 *
 * WHAT THIS DOES:
 *   Sample product/ingredient catalog for a small restaurant or dhaba.
 *   ~55 items: raw ingredients, packaged goods, packaging supplies, beverages.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 template import
 *
 * WHERE IT FITS:
 *   Loaded via /api/import/template when store type is "restaurant".
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/import/template/route.ts
 */

import type { SeedProduct } from "./kirana"

export const RESTAURANT_FIXED_COSTS = [
  { name: "Shop Rent", amount: 18000, frequency: "monthly", category: "rent" },
  { name: "Cook / Staff Salary", amount: 22000, frequency: "monthly", category: "salaries" },
  { name: "Electricity (cooking + AC)", amount: 6000, frequency: "monthly", category: "electricity" },
  { name: "Gas / LPG Cylinders", amount: 4000, frequency: "monthly", category: "other" },
  { name: "Swiggy / Zomato Commission", amount: 3000, frequency: "monthly", category: "other" },
]

export const RESTAURANT_PRODUCTS: SeedProduct[] = [
  // ─── GRAINS & STAPLES ───────────────────────────────────────────────────────
  { name: "Basmati Rice 25kg", brand: "India Gate", category: "Grains", subcategory: "Rice", unit: "kg", purchase_price: 1800, selling_price: 1800, tax_rate: 0 },
  { name: "Regular Rice 25kg", category: "Grains", subcategory: "Rice", unit: "kg", purchase_price: 900, selling_price: 900, tax_rate: 0 },
  { name: "Wheat Flour (Atta) 10kg", brand: "Aashirvaad", category: "Grains", subcategory: "Flour", unit: "kg", purchase_price: 400, selling_price: 400, tax_rate: 0 },
  { name: "Maida 5kg", category: "Grains", subcategory: "Flour", unit: "kg", purchase_price: 180, selling_price: 180, tax_rate: 0 },
  { name: "Sooji / Rava 1kg", category: "Grains", subcategory: "Flour", unit: "kg", purchase_price: 50, selling_price: 50, tax_rate: 0 },
  { name: "Besan 1kg", category: "Grains", subcategory: "Flour", unit: "kg", purchase_price: 70, selling_price: 70, tax_rate: 0 },
  { name: "Poha 1kg", category: "Grains", subcategory: "Other", unit: "kg", purchase_price: 50, selling_price: 50, tax_rate: 0 },

  // ─── PULSES & DAL ────────────────────────────────────────────────────────────
  { name: "Toor Dal 5kg", brand: "Tata Sampann", category: "Pulses", subcategory: "Dal", unit: "kg", purchase_price: 600, selling_price: 600, tax_rate: 0 },
  { name: "Moong Dal 1kg", category: "Pulses", subcategory: "Dal", unit: "kg", purchase_price: 115, selling_price: 115, tax_rate: 0 },
  { name: "Chana Dal 1kg", category: "Pulses", subcategory: "Dal", unit: "kg", purchase_price: 95, selling_price: 95, tax_rate: 0 },
  { name: "Rajma 1kg", category: "Pulses", subcategory: "Legumes", unit: "kg", purchase_price: 140, selling_price: 140, tax_rate: 0 },
  { name: "Chole (Kabuli Chana) 1kg", category: "Pulses", subcategory: "Legumes", unit: "kg", purchase_price: 130, selling_price: 130, tax_rate: 0 },

  // ─── OILS & GHEE ─────────────────────────────────────────────────────────────
  { name: "Sunflower Oil 15L", brand: "Fortune", category: "Oils", subcategory: "Cooking Oil", unit: "litre", purchase_price: 1700, selling_price: 1700, tax_rate: 5 },
  { name: "Mustard Oil 5L", brand: "Dhara", category: "Oils", subcategory: "Cooking Oil", unit: "litre", purchase_price: 750, selling_price: 750, tax_rate: 5 },
  { name: "Ghee 1L", brand: "Amul", category: "Oils", subcategory: "Ghee", unit: "litre", purchase_price: 550, selling_price: 550, tax_rate: 12 },

  // ─── SPICES & MASALAS ────────────────────────────────────────────────────────
  { name: "Turmeric Powder 500g", brand: "MDH", category: "Spices", subcategory: "Ground Spices", unit: "piece", purchase_price: 80, selling_price: 80, tax_rate: 5 },
  { name: "Red Chilli Powder 500g", brand: "Everest", category: "Spices", subcategory: "Ground Spices", unit: "piece", purchase_price: 90, selling_price: 90, tax_rate: 5 },
  { name: "Coriander Powder 500g", category: "Spices", subcategory: "Ground Spices", unit: "piece", purchase_price: 70, selling_price: 70, tax_rate: 5 },
  { name: "Cumin Seeds 250g", category: "Spices", subcategory: "Whole Spices", unit: "piece", purchase_price: 65, selling_price: 65, tax_rate: 5 },
  { name: "Garam Masala 100g", brand: "MDH", category: "Spices", subcategory: "Blended Masala", unit: "piece", purchase_price: 55, selling_price: 55, tax_rate: 5 },
  { name: "Chicken Masala 100g", brand: "Everest", category: "Spices", subcategory: "Blended Masala", unit: "piece", purchase_price: 60, selling_price: 60, tax_rate: 5 },
  { name: "Biryani Masala 50g", brand: "MDH", category: "Spices", subcategory: "Blended Masala", unit: "piece", purchase_price: 40, selling_price: 40, tax_rate: 5 },
  { name: "Salt 1kg", brand: "Tata", category: "Spices", subcategory: "Salt", unit: "kg", purchase_price: 20, selling_price: 20, tax_rate: 0 },

  // ─── VEGETABLES (bulk purchase) ──────────────────────────────────────────────
  { name: "Onion (bulk)", category: "Vegetables", subcategory: "Alliums", unit: "kg", purchase_price: 30, selling_price: 30, tax_rate: 0 },
  { name: "Tomato (bulk)", category: "Vegetables", subcategory: "Nightshades", unit: "kg", purchase_price: 25, selling_price: 25, tax_rate: 0 },
  { name: "Potato (bulk)", category: "Vegetables", subcategory: "Root Veg", unit: "kg", purchase_price: 22, selling_price: 22, tax_rate: 0 },
  { name: "Garlic 1kg", category: "Vegetables", subcategory: "Alliums", unit: "kg", purchase_price: 80, selling_price: 80, tax_rate: 0 },
  { name: "Ginger 1kg", category: "Vegetables", subcategory: "Root Veg", unit: "kg", purchase_price: 90, selling_price: 90, tax_rate: 0 },
  { name: "Green Chilli 500g", category: "Vegetables", subcategory: "Chillies", unit: "kg", purchase_price: 30, selling_price: 30, tax_rate: 0 },
  { name: "Capsicum 1kg", category: "Vegetables", subcategory: "Nightshades", unit: "kg", purchase_price: 50, selling_price: 50, tax_rate: 0 },
  { name: "Peas (frozen) 1kg", category: "Vegetables", subcategory: "Frozen", unit: "kg", purchase_price: 80, selling_price: 80, tax_rate: 5 },

  // ─── DAIRY ───────────────────────────────────────────────────────────────────
  { name: "Full Cream Milk 5L", brand: "Amul", category: "Dairy", subcategory: "Milk", unit: "litre", purchase_price: 280, selling_price: 280, tax_rate: 0, shelf_life_days: 3 },
  { name: "Paneer 500g", brand: "Amul", category: "Dairy", subcategory: "Paneer", unit: "piece", purchase_price: 120, selling_price: 120, tax_rate: 5, shelf_life_days: 7 },
  { name: "Curd 1kg", brand: "Amul", category: "Dairy", subcategory: "Curd", unit: "piece", purchase_price: 70, selling_price: 70, tax_rate: 5, shelf_life_days: 5 },
  { name: "Butter 500g", brand: "Amul", category: "Dairy", subcategory: "Butter", unit: "piece", purchase_price: 230, selling_price: 230, tax_rate: 12, shelf_life_days: 30 },

  // ─── BEVERAGES ───────────────────────────────────────────────────────────────
  { name: "Tea Leaves 1kg", brand: "Brooke Bond", category: "Beverages", subcategory: "Tea", unit: "kg", purchase_price: 350, selling_price: 350, tax_rate: 5 },
  { name: "Coffee Powder 500g", brand: "Bru", category: "Beverages", subcategory: "Coffee", unit: "piece", purchase_price: 280, selling_price: 280, tax_rate: 12 },
  { name: "Sugar 25kg", brand: "Uttam", category: "Beverages", subcategory: "Sweeteners", unit: "kg", purchase_price: 950, selling_price: 950, tax_rate: 0 },
  { name: "Mineral Water 1L (case of 12)", brand: "Bisleri", category: "Beverages", subcategory: "Water", unit: "box", purchase_price: 180, selling_price: 240, tax_rate: 12 },
  { name: "Soft Drink 2L (Pepsi/Coke)", category: "Beverages", subcategory: "Carbonated", unit: "piece", purchase_price: 80, selling_price: 100, tax_rate: 28 },

  // ─── PACKAGING ───────────────────────────────────────────────────────────────
  { name: "Parcel Containers (50 pcs)", category: "Packaging", subcategory: "Containers", unit: "box", purchase_price: 120, selling_price: 120, tax_rate: 18 },
  { name: "Plastic Covers / Carry Bags (100 pcs)", category: "Packaging", subcategory: "Bags", unit: "box", purchase_price: 80, selling_price: 80, tax_rate: 18 },
  { name: "Foil Rolls (standard)", category: "Packaging", subcategory: "Wrapping", unit: "piece", purchase_price: 60, selling_price: 60, tax_rate: 18 },
  { name: "Tissue Paper (50 sheets)", category: "Packaging", subcategory: "Napkins", unit: "piece", purchase_price: 30, selling_price: 30, tax_rate: 12 },
  { name: "Disposable Plates (50 pcs)", category: "Packaging", subcategory: "Crockery", unit: "box", purchase_price: 90, selling_price: 90, tax_rate: 12 },
  { name: "Paper Cups 150ml (100 pcs)", category: "Packaging", subcategory: "Cups", unit: "box", purchase_price: 70, selling_price: 70, tax_rate: 12 },

  // ─── CLEANING ────────────────────────────────────────────────────────────────
  { name: "Dishwash Liquid 1L", brand: "Vim", category: "Cleaning", subcategory: "Dishwash", unit: "piece", purchase_price: 100, selling_price: 100, tax_rate: 18 },
  { name: "Floor Cleaner 1L", brand: "Lizol", category: "Cleaning", subcategory: "Floor", unit: "piece", purchase_price: 120, selling_price: 120, tax_rate: 18 },
  { name: "Scrubber / Sponge (pack of 5)", category: "Cleaning", subcategory: "Scrubbers", unit: "piece", purchase_price: 50, selling_price: 50, tax_rate: 18 },

  // ─── GAS ─────────────────────────────────────────────────────────────────────
  { name: "LPG Cylinder 19kg (commercial)", brand: "HP Gas", category: "Fuel", subcategory: "LPG", unit: "piece", purchase_price: 1800, selling_price: 1800, tax_rate: 5 },
]
