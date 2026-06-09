/**
 * FILE: types/index.ts
 *
 * WHAT THIS DOES:
 *   Global TypeScript type definitions for PakkaHisab — all phases.
 *
 * CHANGES THIS SESSION:
 *   - Complete rewrite: replaced Business/Industry/RevenueRange/TeamSize
 *     with Store, StoreType, Product, Customer, and Transaction types
 *
 * WHERE IT FITS:
 *   Shared types imported across components, API routes, and hooks.
 *
 * CALLED BY / IMPORTS FROM:
 *   Everywhere in the app
 */

// ─── STORE ───────────────────────────────────────────────────────────────────

export type StoreType =
  | "kirana"
  | "medical"
  | "hardware"
  | "restaurant"
  | "clothing"
  | "pharmacy"
  | "electronics"
  | "other";

export type PreferredLanguage = "en" | "hi" | "te" | "ta" | "mr";

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  type: StoreType;
  ownerName: string;
  city: string;
  gstNumber?: string;
  preferredLanguage: PreferredLanguage;
  isInterstate: boolean;
  createdAt: string;
}

export interface StoreOnboardingFormData {
  name: string;
  type: StoreType;
  ownerName: string;
  city: string;
  gstNumber?: string;
  preferredLanguage: PreferredLanguage;
  wantsSampleStore: boolean;
}

// ─── PRODUCT ─────────────────────────────────────────────────────────────────

export type ProductUnit =
  | "kg"
  | "litre"
  | "piece"
  | "box"
  | "dozen"
  | "other";

export interface Product {
  id: string;
  storeId: string;
  itemNumber: number;
  parentProductId?: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  unit: ProductUnit;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  shelfLifeDays?: number;
  isActive: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  variants?: Product[];
}

// ─── INVENTORY ───────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  storeId: string;
  productId: string;
  currentStock: number;
  reorderPoint: number;
  lastRestockedAt?: string;
  expiryDate?: string;
  updatedAt: string;
}

// ─── CUSTOMER ────────────────────────────────────────────────────────────────

export type CustomerType = "walk_in" | "regular" | "wholesale";

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  phone?: string;
  type: CustomerType;
  creditLimit: number;
  currentBalance: number;
  notes?: string;
  createdAt: string;
}

// ─── FIXED COSTS ─────────────────────────────────────────────────────────────

export type CostFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type CostCategory =
  | "rent"
  | "salaries"
  | "electricity"
  | "transport"
  | "other";

export interface FixedCost {
  id: string;
  storeId: string;
  name: string;
  amount: number;
  frequency: CostFrequency;
  category: CostCategory;
  isActive: boolean;
  createdAt: string;
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export type TransactionType = "sale" | "purchase" | "expense" | "income";
export type TransactionSource =
  | "manual_quick"
  | "manual_full"
  | "bill_scan"
  | "csv_import"
  | "excel_import";
export type PaymentMethod = "cash" | "upi" | "credit";
export type TaxType = "cgst_sgst" | "igst";

export interface TransactionItem {
  id: string;
  transactionId: string;
  productId?: string;
  productNameRaw: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  isConfirmed: boolean;
}

export interface Transaction {
  id: string;
  storeId: string;
  userId: string;
  date: string;
  type: TransactionType;
  totalAmount: number;
  paymentMethod?: PaymentMethod;
  customerId?: string;
  vendorName?: string;
  source: TransactionSource;
  sourceDocumentId?: string;
  taxAmount: number;
  taxType?: TaxType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: TransactionItem[];
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}
