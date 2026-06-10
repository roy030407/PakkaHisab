/**
 * FILE: scripts/seed-demo.ts
 *
 * WHAT THIS DOES:
 *   Creates 3 demo auth users (kirana, medical, hardware) and fully
 *   populates each store with products, inventory in every stock state,
 *   purchase stock-movements (so consumption tracking works), expiring
 *   items, customers with credit balances, and ~30 days of transactions.
 *   Idempotent: re-running wipes and rebuilds each demo store's data.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for email+password demo accounts
 *
 * WHERE IT FITS:
 *   Standalone dev/seed script. Run with: npm run seed:demo
 *   Uses the Supabase service role key (server-side only, never bundled).
 *
 * CALLED BY / IMPORTS FROM:
 *   data/seeds/*.ts catalogs; @supabase/supabase-js admin API.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { KIRANA_PRODUCTS, KIRANA_FIXED_COSTS } from "../data/seeds/kirana";
import { MEDICAL_PRODUCTS, MEDICAL_FIXED_COSTS } from "../data/seeds/medical";
import { HARDWARE_PRODUCTS, HARDWARE_FIXED_COSTS } from "../data/seeds/hardware";
import type { SeedProduct } from "../data/seeds/kirana";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_PASSWORD = "demo1234";

type SeedCost = {
  name: string;
  amount: number;
  frequency: string;
  category: string;
};

type Demo = {
  email: string;
  storeName: string;
  type: string;
  ownerName: string;
  city: string;
  products: SeedProduct[];
  costs: SeedCost[];
};

const DEMOS: Demo[] = [
  {
    email: "demo.kirana@pakkahisab.com",
    storeName: "Sharma Kirana Store",
    type: "kirana",
    ownerName: "Rajesh Sharma",
    city: "Pune",
    products: KIRANA_PRODUCTS,
    costs: KIRANA_FIXED_COSTS,
  },
  {
    email: "demo.medical@pakkahisab.com",
    storeName: "Apollo Medical & General",
    type: "medical",
    ownerName: "Priya Nair",
    city: "Hyderabad",
    products: MEDICAL_PRODUCTS,
    costs: MEDICAL_FIXED_COSTS,
  },
  {
    email: "demo.hardware@pakkahisab.com",
    storeName: "Verma Hardware & Paints",
    type: "hardware",
    ownerName: "Amit Verma",
    city: "Delhi",
    products: HARDWARE_PRODUCTS,
    costs: HARDWARE_FIXED_COSTS,
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const NOW_ISO = new Date().toISOString();

function dateOnly(offsetDays: number): string {
  // offsetDays positive = future, negative = past
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Find an existing auth user by email, or create one with confirmed email. */
async function ensureUser(email: string): Promise<string> {
  // listUsers paginates; the demo project has few users so page 1 is enough.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const existing = list.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed for ${email}: ${error?.message}`);
  }
  return data.user.id;
}

// Inventory profiles — each makes a different part of the UI light up.
type Profile = "out" | "order_today" | "low" | "expiring" | "reduce" | "healthy";

function profileFor(index: number): Profile {
  if (index < 2) return "out";
  if (index < 5) return "order_today";
  if (index < 10) return "low";
  if (index < 16) return "expiring";
  if (index < 23) return "reduce";
  return "healthy";
}

// Returns the inventory row + the backing purchase movement for a product.
function inventoryPlan(profile: Profile): {
  reorderPoint: number;
  currentStock: number;
  orderedQty: number;
  orderedDaysAgo: number;
  expiryOffsetDays: number | null;
} {
  switch (profile) {
    case "out":
      return { reorderPoint: 15, currentStock: 0, orderedQty: 60, orderedDaysAgo: 12, expiryOffsetDays: null };
    case "order_today":
      return { reorderPoint: 15, currentStock: 5, orderedQty: 100, orderedDaysAgo: 5, expiryOffsetDays: null };
    case "low":
      return { reorderPoint: 15, currentStock: 12, orderedQty: 40, orderedDaysAgo: 9, expiryOffsetDays: null };
    case "expiring":
      return { reorderPoint: 15, currentStock: 30, orderedQty: 50, orderedDaysAgo: 4, expiryOffsetDays: 3 + Math.floor(Math.random() * 4) };
    case "reduce":
      return { reorderPoint: 15, currentStock: 95, orderedQty: 100, orderedDaysAgo: 10, expiryOffsetDays: null };
    case "healthy":
    default:
      return { reorderPoint: 15, currentStock: 45, orderedQty: 60, orderedDaysAgo: 6, expiryOffsetDays: null };
  }
}

const CUSTOMERS = [
  { name: "Suresh Patil", phone: "9822012345", type: "regular", balance: 1450 },
  { name: "Lakshmi Stores", phone: "9890054321", type: "wholesale", balance: 8600 },
  { name: "Walk-in", phone: null, type: "walk_in", balance: 0 },
  { name: "Anita Desai", phone: "9011122233", type: "regular", balance: 320 },
  { name: "Hotel Annapurna", phone: "9700099887", type: "wholesale", balance: 0 },
];

// ─── per-store seeding ────────────────────────────────────────────────────────

async function seedStore(demo: Demo): Promise<void> {
  console.log(`\n▶ ${demo.storeName} (${demo.email})`);

  const userId = await ensureUser(demo.email);

  // Idempotency: wipe any existing store for this owner (cascade clears children).
  await admin.from("stores").delete().eq("owner_id", userId);

  // Store — id generated client-side (no DB default on uuid columns).
  const storeId = randomUUID();
  const { error: storeErr } = await admin.from("stores").insert({
    id: storeId,
    owner_id: userId,
    name: demo.storeName,
    type: demo.type,
    owner_name: demo.ownerName,
    city: demo.city,
    gst_number: null,
    preferred_language: "en",
    is_interstate: false,
  });
  if (storeErr) throw new Error(`store insert failed: ${storeErr.message}`);

  // Products — explicit ids; item_number 0 lets the DB trigger assign numbers.
  const products = demo.products.map((p) => ({
    id: randomUUID(),
    name: p.name,
    selling_price: p.selling_price,
  }));
  const productRows = demo.products.map((p, i) => ({
    id: products[i].id,
    store_id: storeId,
    item_number: 0,
    name: p.name,
    brand: p.brand ?? null,
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    unit: p.unit,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    tax_rate: p.tax_rate,
    shelf_life_days: p.shelf_life_days ?? null,
    updated_at: NOW_ISO,
  }));

  for (let i = 0; i < productRows.length; i += 50) {
    const { error } = await admin.from("products").insert(productRows.slice(i, i + 50));
    if (error) throw new Error(`product insert failed: ${error.message}`);
  }

  // Inventory + purchase movements
  const inventoryRows: Record<string, unknown>[] = [];
  const movementRows: Record<string, unknown>[] = [];

  products.forEach((prod, index) => {
    const plan = inventoryPlan(profileFor(index));
    inventoryRows.push({
      id: randomUUID(),
      store_id: storeId,
      product_id: prod.id,
      current_stock: plan.currentStock,
      reorder_point: plan.reorderPoint,
      last_restocked_at: daysAgoISO(plan.orderedDaysAgo),
      expiry_date: plan.expiryOffsetDays !== null ? dateOnly(plan.expiryOffsetDays) : null,
      updated_at: NOW_ISO,
    });
    movementRows.push({
      id: randomUUID(),
      store_id: storeId,
      product_id: prod.id,
      movement_type: "purchase",
      quantity: plan.orderedQty,
      unit_price: prod.selling_price,
      reason: "Initial stock",
      created_at: daysAgoISO(plan.orderedDaysAgo),
    });
  });

  for (let i = 0; i < inventoryRows.length; i += 50) {
    const { error } = await admin.from("inventory").insert(inventoryRows.slice(i, i + 50));
    if (error) throw new Error(`inventory insert failed: ${error.message}`);
  }
  for (let i = 0; i < movementRows.length; i += 50) {
    const { error } = await admin.from("stock_movements").insert(movementRows.slice(i, i + 50));
    if (error) throw new Error(`movement insert failed: ${error.message}`);
  }

  // Fixed costs
  if (demo.costs.length > 0) {
    const { error } = await admin
      .from("fixed_costs")
      .insert(demo.costs.map((c) => ({ id: randomUUID(), store_id: storeId, ...c })));
    if (error) throw new Error(`fixed_cost insert failed: ${error.message}`);
  }

  // Customers
  const customers = CUSTOMERS.map((c) => ({ id: randomUUID(), name: c.name }));
  const { error: custErr } = await admin.from("customers").insert(
    CUSTOMERS.map((c, i) => ({
      id: customers[i].id,
      store_id: storeId,
      name: c.name,
      phone: c.phone,
      type: c.type,
      credit_limit: c.balance > 0 ? c.balance * 2 : 0,
      current_balance: c.balance,
    }))
  );
  if (custErr) throw new Error(`customer insert failed: ${custErr.message}`);

  // ~30 days of sale transactions with line items
  const paymentMethods = ["cash", "upi", "credit"];
  let txCount = 0;
  for (let d = 0; d < 30; d++) {
    const perDay = 1 + (d % 3); // 1–3 sales per day
    for (let n = 0; n < perDay; n++) {
      const lineCount = 1 + Math.floor(Math.random() * 3);
      const chosen = Array.from({ length: lineCount }, () => pick(products));
      let total = 0;
      const items = chosen.map((prod) => {
        const qty = 1 + Math.floor(Math.random() * 4);
        const unit = Number(prod.selling_price);
        const line = unit * qty;
        total += line;
        return {
          product_id: prod.id,
          product_name_raw: prod.name,
          quantity: qty,
          unit_price: unit,
          total_price: line,
          tax_rate: 0,
          is_confirmed: true,
        };
      });

      const txId = randomUUID();
      const { error: txErr } = await admin.from("transactions").insert({
        id: txId,
        store_id: storeId,
        user_id: userId,
        date: dateOnly(-d),
        type: "sale",
        total_amount: Math.round(total),
        payment_method: pick(paymentMethods),
        customer_id: Math.random() < 0.4 ? pick(customers).id : null,
        source: "manual_quick",
        tax_amount: 0,
        created_at: daysAgoISO(d),
        updated_at: daysAgoISO(d),
      });
      if (txErr) throw new Error(`transaction insert failed: ${txErr.message}`);

      const { error: itemErr } = await admin
        .from("transaction_items")
        .insert(items.map((it) => ({ id: randomUUID(), ...it, transaction_id: txId })));
      if (itemErr) throw new Error(`transaction_item insert failed: ${itemErr.message}`);
      txCount++;
    }
  }

  console.log(
    `  ✓ ${products.length} products, ${inventoryRows.length} inventory rows, ` +
      `${customers.length} customers, ${txCount} transactions`
  );
}

async function main() {
  console.log("Seeding demo accounts...");
  for (const demo of DEMOS) {
    await seedStore(demo);
  }
  console.log("\n✅ Done. Log in with password:", DEMO_PASSWORD);
  console.log("   demo.kirana@pakkahisab.com");
  console.log("   demo.medical@pakkahisab.com");
  console.log("   demo.hardware@pakkahisab.com");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
