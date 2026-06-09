/**
 * FILE: data/seeds/kirana.ts
 *
 * WHAT THIS DOES:
 *   Sample product catalog for a kirana (general store).
 *   ~80 common FMCG products across staples, beverages, snacks,
 *   personal care, and household. Curated from Indian retail datasets.
 *   Used when a new merchant selects "Kirana" and wants sample data.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1b sample store feature
 *
 * WHERE IT FITS:
 *   Read by app/api/stores/seed/route.ts and loaded into the products
 *   table when a new merchant opts in to sample data at onboarding.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/stores/seed/route.ts
 */

export type SeedProduct = {
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  tax_rate: number;
  shelf_life_days?: number;
};

export const KIRANA_PRODUCTS: SeedProduct[] = [
  // ─── STAPLES ────────────────────────────────────────────────────────────────
  { name: "Basmati Rice 1kg", brand: "India Gate", category: "Staples", subcategory: "Rice", unit: "kg", purchase_price: 80, selling_price: 95, tax_rate: 0 },
  { name: "Wheat Flour (Atta) 5kg", brand: "Aashirvaad", category: "Staples", subcategory: "Flour", unit: "kg", purchase_price: 200, selling_price: 230, tax_rate: 0 },
  { name: "Toor Dal 1kg", brand: "Tata Sampann", category: "Staples", subcategory: "Pulses", unit: "kg", purchase_price: 120, selling_price: 140, tax_rate: 0 },
  { name: "Moong Dal 1kg", category: "Staples", subcategory: "Pulses", unit: "kg", purchase_price: 110, selling_price: 130, tax_rate: 0 },
  { name: "Chana Dal 1kg", category: "Staples", subcategory: "Pulses", unit: "kg", purchase_price: 90, selling_price: 108, tax_rate: 0 },
  { name: "Sugar 1kg", brand: "Uttam", category: "Staples", subcategory: "Sugar & Salt", unit: "kg", purchase_price: 42, selling_price: 50, tax_rate: 0 },
  { name: "Salt 1kg", brand: "Tata", category: "Staples", subcategory: "Sugar & Salt", unit: "kg", purchase_price: 18, selling_price: 22, tax_rate: 0 },
  { name: "Sunflower Oil 1L", brand: "Fortune", category: "Staples", subcategory: "Edible Oil", unit: "litre", purchase_price: 130, selling_price: 148, tax_rate: 5 },
  { name: "Groundnut Oil 1L", brand: "Dhara", category: "Staples", subcategory: "Edible Oil", unit: "litre", purchase_price: 145, selling_price: 165, tax_rate: 5 },
  { name: "Poha 500g", category: "Staples", subcategory: "Breakfast", unit: "piece", purchase_price: 28, selling_price: 35, tax_rate: 0 },
  { name: "Sooji (Rava) 500g", category: "Staples", subcategory: "Breakfast", unit: "piece", purchase_price: 22, selling_price: 28, tax_rate: 0 },
  { name: "Besan 500g", category: "Staples", subcategory: "Flour", unit: "piece", purchase_price: 40, selling_price: 50, tax_rate: 0 },

  // ─── BEVERAGES ──────────────────────────────────────────────────────────────
  { name: "Thums Up 600ml", brand: "Coca-Cola", category: "Beverages", subcategory: "Soft Drinks", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 28 },
  { name: "Sprite 600ml", brand: "Coca-Cola", category: "Beverages", subcategory: "Soft Drinks", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 28 },
  { name: "Pepsi 600ml", brand: "PepsiCo", category: "Beverages", subcategory: "Soft Drinks", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 28 },
  { name: "Limca 600ml", brand: "Coca-Cola", category: "Beverages", subcategory: "Soft Drinks", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 28 },
  { name: "Maaza Mango 200ml", brand: "Coca-Cola", category: "Beverages", subcategory: "Juices", unit: "piece", purchase_price: 18, selling_price: 22, tax_rate: 12 },
  { name: "Real Orange Juice 1L", brand: "Dabur", category: "Beverages", subcategory: "Juices", unit: "litre", purchase_price: 95, selling_price: 115, tax_rate: 12 },
  { name: "Bisleri Water 1L", brand: "Bisleri", category: "Beverages", subcategory: "Water", unit: "piece", purchase_price: 15, selling_price: 20, tax_rate: 12 },
  { name: "Tata Tea Gold 500g", brand: "Tata", category: "Beverages", subcategory: "Tea & Coffee", unit: "piece", purchase_price: 200, selling_price: 235, tax_rate: 5 },
  { name: "Nescafe Classic 50g", brand: "Nestlé", category: "Beverages", subcategory: "Tea & Coffee", unit: "piece", purchase_price: 195, selling_price: 230, tax_rate: 5 },
  { name: "Boost 500g", brand: "HUL", category: "Beverages", subcategory: "Health Drinks", unit: "piece", purchase_price: 230, selling_price: 265, tax_rate: 18 },
  { name: "Horlicks 500g", brand: "HUL", category: "Beverages", subcategory: "Health Drinks", unit: "piece", purchase_price: 195, selling_price: 225, tax_rate: 18 },

  // ─── SNACKS & BISCUITS ───────────────────────────────────────────────────────
  { name: "Parle-G 200g", brand: "Parle", category: "Snacks", subcategory: "Biscuits", unit: "piece", purchase_price: 15, selling_price: 18, tax_rate: 12 },
  { name: "Hide & Seek 100g", brand: "Parle", category: "Snacks", subcategory: "Biscuits", unit: "piece", purchase_price: 22, selling_price: 28, tax_rate: 12 },
  { name: "Good Day 250g", brand: "Britannia", category: "Snacks", subcategory: "Biscuits", unit: "piece", purchase_price: 38, selling_price: 45, tax_rate: 12 },
  { name: "Marie Gold 250g", brand: "Britannia", category: "Snacks", subcategory: "Biscuits", unit: "piece", purchase_price: 28, selling_price: 35, tax_rate: 12 },
  { name: "Lays Classic 26g", brand: "PepsiCo", category: "Snacks", subcategory: "Chips", unit: "piece", purchase_price: 17, selling_price: 20, tax_rate: 12 },
  { name: "Kurkure Masala 90g", brand: "PepsiCo", category: "Snacks", subcategory: "Chips", unit: "piece", purchase_price: 28, selling_price: 35, tax_rate: 12 },
  { name: "Maggi Noodles 70g", brand: "Nestlé", category: "Snacks", subcategory: "Noodles", unit: "piece", purchase_price: 12, selling_price: 14, tax_rate: 12 },
  { name: "Yippee Noodles 75g", brand: "Sunfeast", category: "Snacks", subcategory: "Noodles", unit: "piece", purchase_price: 12, selling_price: 14, tax_rate: 12 },
  { name: "Haldiram Aloo Bhujia 200g", brand: "Haldiram", category: "Snacks", subcategory: "Namkeen", unit: "piece", purchase_price: 55, selling_price: 65, tax_rate: 12 },
  { name: "Cadbury Dairy Milk 13g", brand: "Cadbury", category: "Snacks", subcategory: "Chocolates", unit: "piece", purchase_price: 9, selling_price: 10, tax_rate: 18 },
  { name: "Eclairs Toffee (Pack)", brand: "Cadbury", category: "Snacks", subcategory: "Chocolates", unit: "piece", purchase_price: 50, selling_price: 60, tax_rate: 18 },

  // ─── DAIRY ──────────────────────────────────────────────────────────────────
  { name: "Amul Butter 500g", brand: "Amul", category: "Dairy", subcategory: "Butter", unit: "piece", purchase_price: 245, selling_price: 280, tax_rate: 12 },
  { name: "Amul Cheese Slices 200g", brand: "Amul", category: "Dairy", subcategory: "Cheese", unit: "piece", purchase_price: 90, selling_price: 105, tax_rate: 12 },
  { name: "Nestlé Munch 13.5g", brand: "Nestlé", category: "Dairy", subcategory: "Chilled", unit: "piece", purchase_price: 9, selling_price: 10, tax_rate: 18 },
  { name: "Mother Dairy Curd 400g", brand: "Mother Dairy", category: "Dairy", subcategory: "Curd", unit: "piece", purchase_price: 40, selling_price: 48, tax_rate: 5 },

  // ─── PERSONAL CARE ───────────────────────────────────────────────────────────
  { name: "Lifebuoy Soap 100g", brand: "HUL", category: "Personal Care", subcategory: "Soap", unit: "piece", purchase_price: 24, selling_price: 29, tax_rate: 18 },
  { name: "Dove Soap 100g", brand: "HUL", category: "Personal Care", subcategory: "Soap", unit: "piece", purchase_price: 40, selling_price: 48, tax_rate: 18 },
  { name: "Dettol Original 250ml", brand: "Reckitt", category: "Personal Care", subcategory: "Soap", unit: "piece", purchase_price: 58, selling_price: 70, tax_rate: 18 },
  { name: "Colgate MaxFresh 150g", brand: "Colgate", category: "Personal Care", subcategory: "Toothpaste", unit: "piece", purchase_price: 65, selling_price: 78, tax_rate: 18 },
  { name: "Pepsodent 150g", brand: "HUL", category: "Personal Care", subcategory: "Toothpaste", unit: "piece", purchase_price: 55, selling_price: 66, tax_rate: 18 },
  { name: "Head & Shoulders 340ml", brand: "P&G", category: "Personal Care", subcategory: "Shampoo", unit: "piece", purchase_price: 225, selling_price: 265, tax_rate: 18 },
  { name: "Clinic Plus Shampoo 80ml", brand: "HUL", category: "Personal Care", subcategory: "Shampoo", unit: "piece", purchase_price: 55, selling_price: 65, tax_rate: 18 },
  { name: "Nihar Naturals Hair Oil 200ml", brand: "Marico", category: "Personal Care", subcategory: "Hair Oil", unit: "piece", purchase_price: 70, selling_price: 83, tax_rate: 18 },
  { name: "Parachute Coconut Oil 200ml", brand: "Marico", category: "Personal Care", subcategory: "Hair Oil", unit: "piece", purchase_price: 95, selling_price: 112, tax_rate: 18 },
  { name: "Fair & Lovely 50g", brand: "HUL", category: "Personal Care", subcategory: "Skin Care", unit: "piece", purchase_price: 55, selling_price: 65, tax_rate: 18 },
  { name: "Vaseline Petroleum Jelly 50ml", brand: "HUL", category: "Personal Care", subcategory: "Skin Care", unit: "piece", purchase_price: 68, selling_price: 80, tax_rate: 18 },
  { name: "Gillette Mach3 Razor", brand: "P&G", category: "Personal Care", subcategory: "Shaving", unit: "piece", purchase_price: 95, selling_price: 115, tax_rate: 18 },

  // ─── HOUSEHOLD ───────────────────────────────────────────────────────────────
  { name: "Ariel Powder 500g", brand: "P&G", category: "Household", subcategory: "Detergent", unit: "piece", purchase_price: 95, selling_price: 115, tax_rate: 18 },
  { name: "Surf Excel 500g", brand: "HUL", category: "Household", subcategory: "Detergent", unit: "piece", purchase_price: 80, selling_price: 98, tax_rate: 18 },
  { name: "Rin Powder 500g", brand: "HUL", category: "Household", subcategory: "Detergent", unit: "piece", purchase_price: 42, selling_price: 50, tax_rate: 18 },
  { name: "Vim Dish Wash Bar 200g", brand: "HUL", category: "Household", subcategory: "Dishwash", unit: "piece", purchase_price: 20, selling_price: 25, tax_rate: 18 },
  { name: "Pril Dish Wash 500ml", brand: "Henkel", category: "Household", subcategory: "Dishwash", unit: "piece", purchase_price: 88, selling_price: 105, tax_rate: 18 },
  { name: "Colin Glass Cleaner 500ml", brand: "Reckitt", category: "Household", subcategory: "Cleaners", unit: "piece", purchase_price: 95, selling_price: 112, tax_rate: 18 },
  { name: "Harpic Toilet Cleaner 500ml", brand: "Reckitt", category: "Household", subcategory: "Cleaners", unit: "piece", purchase_price: 80, selling_price: 95, tax_rate: 18 },
  { name: "Good Knight Jumbo 45N", brand: "Godrej", category: "Household", subcategory: "Insect Repellent", unit: "piece", purchase_price: 48, selling_price: 58, tax_rate: 18 },
  { name: "All Out Liquid 45N", brand: "SC Johnson", category: "Household", subcategory: "Insect Repellent", unit: "piece", purchase_price: 110, selling_price: 130, tax_rate: 18 },
  { name: "Tata Tissue Box 100 pulls", brand: "Tata", category: "Household", subcategory: "Paper Products", unit: "piece", purchase_price: 60, selling_price: 72, tax_rate: 12 },

  // ─── CONDIMENTS & SPICES ─────────────────────────────────────────────────────
  { name: "Maggi Ketchup 500g", brand: "Nestlé", category: "Condiments", subcategory: "Sauces", unit: "piece", purchase_price: 68, selling_price: 80, tax_rate: 12 },
  { name: "Kissan Jam 200g", brand: "HUL", category: "Condiments", subcategory: "Jams", unit: "piece", purchase_price: 62, selling_price: 74, tax_rate: 12 },
  { name: "Everest Garam Masala 50g", brand: "Everest", category: "Condiments", subcategory: "Masala", unit: "piece", purchase_price: 35, selling_price: 42, tax_rate: 5 },
  { name: "MDH Chana Masala 100g", brand: "MDH", category: "Condiments", subcategory: "Masala", unit: "piece", purchase_price: 45, selling_price: 55, tax_rate: 5 },
  { name: "Priya Mango Pickle 300g", brand: "Priya", category: "Condiments", subcategory: "Pickles", unit: "piece", purchase_price: 55, selling_price: 68, tax_rate: 12 },
  { name: "Nilgiris Honey 250g", brand: "Nilgiris", category: "Condiments", subcategory: "Honey", unit: "piece", purchase_price: 90, selling_price: 108, tax_rate: 12 },

  // ─── INCIDENTALS ─────────────────────────────────────────────────────────────
  { name: "Eno Fruit Salt Lemon 5g", brand: "GSK", category: "Health", subcategory: "Antacids", unit: "piece", purchase_price: 8, selling_price: 10, tax_rate: 12 },
  { name: "Chings Schezwan Sauce 250g", brand: "Ching's", category: "Condiments", subcategory: "Sauces", unit: "piece", purchase_price: 58, selling_price: 70, tax_rate: 12 },
  { name: "Aashirvaad Pasta 400g", brand: "ITC", category: "Snacks", subcategory: "Pasta", unit: "piece", purchase_price: 45, selling_price: 55, tax_rate: 12 },
];

export const KIRANA_FIXED_COSTS = [
  { name: "Shop rent", amount: 12000, frequency: "monthly", category: "rent" },
  { name: "Electricity bill", amount: 3500, frequency: "monthly", category: "electricity" },
  { name: "Shop assistant salary", amount: 10000, frequency: "monthly", category: "salaries" },
  { name: "Transport / delivery", amount: 2000, frequency: "monthly", category: "transport" },
];
