/**
 * FILE: types/index.ts
 *
 * WHAT THIS DOES:
 *   Global TypeScript type definitions for PakkaHisab — all phases.
 *
 * CHANGES THIS SESSION:
 *   - Complete rewrite: replaced Business/Industry/RevenueRange/TeamSize
 *     with Store, StoreType, Product, Customer, and Transaction types
 *   - Added Phase 2 types: ConfidenceLevel, DocumentType, StockMovementType,
 *     ExtractionStatus, ExtractionItem, ExtractionResult, DocumentUpload,
 *     QuickEntryItem, QuickEntryPayload, FullEntryItem, FullEntryPayload
 *   - Added Phase 3 types: StockStatus, AdjustmentReason, SuggestionType,
 *     ConsumptionData, StockItemWithConsumption, OrderSuggestion,
 *     InventorySuggestionsResult, StockAdjustmentPayload
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

// ─── Phase 2: Bill Scanning ───────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low";
export type DocumentType = "single_bill" | "ledger_page";
export type StockMovementType = "purchase" | "sale" | "adjustment" | "waste";
export type ExtractionStatus =
  | "pending"
  | "extracted"
  | "confirmed"
  | "failed";

export interface ExtractionItem {
  productNameRaw: string;
  matchedProductId?: string;
  matchedProductName?: string;
  needsCatalogAdd: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  fieldConfidence: Record<
    "quantity" | "unitPrice" | "totalPrice",
    ConfidenceLevel
  >;
}

export interface ExtractionResult {
  documentType: DocumentType;
  vendorName?: string;
  date?: string;
  totalAmount?: number;
  confidence: ConfidenceLevel;
  items: ExtractionItem[];
}

export interface DocumentUpload {
  id: string;
  storeId: string;
  userId: string;
  storagePath: string;
  fileType: string;
  documentType: DocumentType;
  extractionStatus: ExtractionStatus;
  rawExtractionJson?: ExtractionResult;
  confidence?: ConfidenceLevel;
  createdAt: string;
}

// ─── Phase 2: Manual Entry ────────────────────────────────────────────────

export interface QuickEntryItem {
  productId: string;
  quantity: number;
}

export interface QuickEntryPayload {
  type: TransactionType;
  paymentMethod: PaymentMethod;
  customerId?: string;
  items: QuickEntryItem[];
}

export interface FullEntryItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface FullEntryPayload {
  date: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  customerId?: string;
  vendorName?: string;
  notes?: string;
  items: FullEntryItem[];
}

// ─── Phase 3: Inventory ───────────────────────────────────────────────────

export type StockStatus = 'ok' | 'low' | 'critical' | 'out'
export type AdjustmentReason = 'damaged' | 'expired' | 'theft' | 'correction' | 'waste' | 'other'
export type SuggestionType = 'order_today' | 'reduce_ordering' | 'watch_expiry'

export interface ConsumptionData {
  orderedQty: number         // total units received in last 30 days
  daysSinceOrder: number     // days since the most recent purchase movement
  dailyRate: number          // (orderedQty - currentStock) / daysSinceOrder; 0 if nothing consumed
  daysUntilStockout: number  // currentStock / dailyRate; use Infinity for zero-rate products
}

export interface StockItemWithConsumption {
  productId: string
  productName: string
  brand?: string
  category: string
  unit: string
  currentStock: number
  reorderPoint: number
  lastRestockedAt?: string
  expiryDate?: string
  stockStatus: StockStatus
  consumption?: ConsumptionData
}

export interface OrderSuggestion {
  productId: string
  productName: string
  unit: string
  currentStock: number
  reorderPoint: number
  reason: string
  suggestionType: SuggestionType
  expiryDate?: string
  daysUntilExpiry?: number
}

export interface InventorySuggestionsResult {
  orderToday: OrderSuggestion[]
  reduceOrdering: OrderSuggestion[]
  watchExpiry: OrderSuggestion[]
  generatedAt: string
}

export interface StockAdjustmentPayload {
  productId: string
  delta: number         // positive = add, negative = remove
  reason: AdjustmentReason
  notes?: string
}
