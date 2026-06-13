# PakkaHisab - Project Source of Truth

Read this file at the start of every single task. This is the authoritative reference for every decision.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT: PAKKAHISAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What it is:
A complete business operating system for Indian SME owners.
Scan bills, manage inventory, track customers, understand profit,
pay taxes correctly, and get AI-powered suggestions - all in one place.
Designed to feel like a smart assistant, not accounting software.

Core principle:
Every feature must feel faster than doing it on paper.
If it feels like a task, the design is wrong.

Target users:
Kirana stores, medical shops, hardware stores, distributors,
small manufacturers, and anyone who tracks daily business manually.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING & STYLE RULES (apply to ALL output)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER use em dashes (—) anywhere. Not in UI copy, code comments,
   file headers, commit messages, AI system prompts, AI-generated text,
   or this file. Use a comma, a period, parentheses, or a plain
   hyphen (-) with spaces instead. This is non-negotiable.
2. Every clickable element must use cursor: pointer (hand cursor).
   Disabled controls use cursor: not-allowed.
3. Every interactive element (button, card, nav item, list row) must
   have a visible hover state. The chosen feedback style is LIFT + SHADOW:
   element rises a couple px with a soft shadow on hover and presses down
   on click. Shared utilities live in app/globals.css:
   .btn-lift (buttons / nav / links), .row-lift (list rows),
   .card-lift (cards). Respect prefers-reduced-motion (already handled).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TECH STACK - exact, do not deviate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Framework:      Next.js 14, App Router, TypeScript strict
Styling:        Tailwind CSS + shadcn/ui
Database:       Supabase (PostgreSQL + RLS)
Auth:           Supabase Auth (email OTP, magic link)
ORM:            Prisma
File storage:   Supabase Storage (private, RLS enforced)
AI extraction:  Anthropic Claude API (claude-sonnet-4-20250514, Vision)
AI advisor:     Anthropic Claude API (same model, tool use)
Voice (v2):     Web Speech API first, Gemini Audio API if needed
Deployment:     Vercel
Package mgr:    npm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       ← server only, never NEXT_PUBLIC_
ANTHROPIC_API_KEY               ← server only
NEXT_PUBLIC_APP_URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASES - build in strict order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

════════════════════════════════════════
PHASE 1 - Foundation and Store Setup
════════════════════════════════════════

Goal: merchant can sign up, set up their store, and have a
product catalog ready before scanning a single bill.

1a. Auth
    Supabase Auth: email OTP signup and login.
    No passwords. Simple and fast.

1b. Store onboarding
    Fields: store name, store type (kirana / medical / hardware /
    restaurant / clothing / pharmacy / electronics / other),
    owner name, city, GST number (optional), preferred language
    (English / Hindi / Telugu / Tamil / Marathi).

    After store type is selected, ask:
    "Would you like to start with a sample store?"
    If yes: pre-load the product catalog, common categories,
    and suggested fixed costs for that store type.
    Sample data comes from a curated Kaggle-sourced product database
    (see DATA SOURCES below).

1c. Product catalog
    Each product has:
      id (auto), item_number (sequential, per store),
      name, brand (optional), category, subcategory,
      unit (kg / litre / piece / box / dozen / other),
      variants (e.g. "Thums Up 200ml", "Thums Up 500ml", "Thums Up 2L" - stored as child records under a parent product),
      purchase_price, selling_price, tax_rate (GST %),
      is_active, is_frequently_used (auto-calculated),
      created_at, updated_at.

    Rules:
    - Merchant can add any product manually.
    - When a product is added, ask: "Does this come in multiple
      sizes or variants?" If yes, prompt to add variants.
    - Variants share a parent product but have their own prices.
    - Frequently used = ordered or sold in the last 7 days.
      Auto-sort these to the top in all product lists.
    - Product search: by name, brand, item number, or category.
      Search must work with partial matches and typos (fuzzy).
    - Per-product pricing: purchase price and selling price
      stored separately. Margin calculated automatically.

1d. Fixed costs setup
    Fields: cost name, amount, frequency (daily / weekly /
    monthly / yearly), category (rent / salaries / electricity /
    transport / other).
    These are used in profit calculations throughout the product.

1e. Tax configuration
    Store's applicable GST slabs (0%, 5%, 12%, 18%, 28%).
    Each product can have its own GST rate.
    IGST vs CGST+SGST toggle (for inter-state vs intra-state).

════════════════════════════════════════
PHASE 2 - Bill Scanning and Transaction Entry
════════════════════════════════════════

Goal: the core loop. A bill comes in, it gets scanned,
the merchant confirms, inventory updates automatically.
This is the primary daily action in the app.

2a. Bill scanning (primary input)
    Merchant uploads or photographs:
      printed receipt, printed invoice, GST bill, delivery
      challan, handwritten bill, handwritten ledger page,
      or a page from a khata/account book.

    Processing pipeline:
    1. Client-side compression before upload (max 2MB)
    2. Upload to Supabase Storage (private bucket)
    3. Claude Vision extracts structured data
       (see EXTRACTION SPEC below)
    4. Extracted items are matched against the product catalog - exact match first, then fuzzy match
    5. Unmatched items are flagged: "This item is not in your
       catalog. Add it?"
    6. Duplicate detection: if the same bill (same vendor,
       same amount, within 24 hours) was already entered
       manually, show warning: "This looks like it was already
       added on [date]. Add again?"
    7. Quick confirm screen shown (see UX SPEC below)

    Handwriting learning:
    Every time a merchant corrects an extracted field
    (e.g. fixes a misread amount or product name), that
    correction is stored in extraction_corrections table.
    Future extractions from the same store use these corrections
    as few-shot examples in the Claude Vision prompt.
    Over time, Claude's extraction accuracy improves per merchant.

    Kaggle training data:
    On app startup, the extraction prompt includes 3-5 few-shot
    examples of correctly extracted Indian bills from the
    curated examples database (varies by bill type detected).
    These examples are stored in the app's own database,
    curated from open Kaggle bill datasets.

2b. Quick confirm UX
    After extraction, show a confirm screen:

    For a single bill (one transaction):
      Large amount display, vendor name, date, list of line items.
      Each line item shows: [product name] [qty] [price]
        with [+] and [-] buttons to adjust quantity inline.
      If a line item matches a catalog product, show the
      catalog name (not the raw extracted name).
      "Save" button (primary) and "Edit all details" link.

    For a ledger page (multiple transactions):
      Scrollable list of rows.
      Each row: [checkbox] [date] [party] [amount] [type]
        with inline tap-to-edit.
      "Save X transactions" at the bottom.
      Unchecked rows are excluded.

    Low-confidence extractions:
      Yellow dot on the field. Warning banner.
      "Edit" is equally prominent as "Save".

2c. Manual transaction entry
    For any transaction without a document (cash sale,
    verbal deal, informal expense).

    Two modes:
    QUICK mode (for frequent transactions):
      Show frequently used products at the top.
      Each product shows [name] [price] with [+] and [-] buttons.
      No form to fill. Tap +, set quantity, done.
      A running total is shown as items are added.
      One "Save" button at the bottom.

    FULL mode (for new or complex entries):
      Full form: date, type (sale / purchase / expense /
      income), product search, quantity, price, customer/vendor,
      payment method (cash / UPI / credit), notes.

    Frequently used products:
      Auto-calculated based on the last 7 days of transactions.
      Shown at the top of all product selection screens.
      Remaining products below in alphabetical order.
      Merchant can also manually pin products to the top.

2d. Customer management
    Some transactions have no bill (credit sales, regular
    customers who buy on account).

    Customer record:
      id, name, phone (optional), type (walk-in / regular /
      wholesale), credit_limit, current_balance,
      notes, created_at.

    During a transaction, merchant can:
      Select an existing customer or add a new one inline.
      Mark the transaction as "on credit" (no immediate payment).

    Customer ledger:
      Per-customer view showing all transactions and balance.

2e. Inventory auto-update
    Every confirmed purchase transaction increases stock.
    Every confirmed sale decreases stock.
    Manual adjustments allowed at any time with a reason field.

════════════════════════════════════════
PHASE 3 - Inventory Management
════════════════════════════════════════

Goal: merchant knows exactly what they have, what's running low,
what might expire, and what to order next.

3a. Stock tracker
    Per product: current stock level, unit, last restocked date,
    reorder point (merchant sets this, or AI suggests it).
    Colour coding: green (ok), amber (low), red (critical).
    Frequently low products shown at top of inventory list.

3b. Consumption tracking and intelligence
    For each product, track:
      ordered_quantity, current_quantity, days_since_order.
    Calculate: daily consumption rate = (ordered - current) / days.
    Predict: days until stockout = current / daily rate.
    Show: "At this rate, [Product] will run out in X days."

    Example shown in the UI:
      "Ordered 100 units 5 days ago. 10 remaining.
       Consumption: ~18/day. Runs out in ~0.5 days. Order now?"

3c. Expiry tracking
    Products can have an expiry date or shelf life (days).
    Show warning when stock is within 7 days of expiry.
    AI suggestion: "You have 20 units of [X] expiring in 5 days.
    Consider running a discount or using them first."

3d. AI ordering suggestions
    Every morning (or on demand), generate:
      "Order today" list - products below reorder point
        or predicted to run out within 3 days.
      "Reduce ordering" list - products with low consumption
        rate where stock will last more than 30 days.
      "Watch for expiry" list - products expiring within 7 days.
    These are suggestions, not automated orders.
    Merchant can tap any item to log a purchase directly.

3e. Upload schedule
    Merchant can upload transactions daily or weekly.
    The app remembers the last upload date and prompts:
    "You haven't added transactions since [date]. Upload now?"
    Bulk CSV or Excel upload supported for historical data.

════════════════════════════════════════
PHASE 4 - Reporting and Financial Intelligence
════════════════════════════════════════

Goal: merchant can answer any business question in seconds,
without a CA and without waiting for month-end.

4a. Dashboard (home screen)
    Always shown on login. Shows today's data by default.
    Cards:
      Today's sales total, today's purchases total,
      today's net profit (sales - purchases - fixed costs for today),
      outstanding receivables total,
      low stock alerts count,
      expiry alerts count.
    All cards tap to drill down.

4b. Sales and profit reports
    Toggleable: daily / weekly / monthly / yearly.
    Shows:
      Total sales, total purchases, gross margin,
      fixed costs allocated for the period,
      net profit after costs and estimated tax,
      top selling products (by revenue and by quantity),
      slowest moving products,
      sales by customer type,
      payment method breakdown (cash / UPI / credit).

4c. Graphs
    Cash flow over time (line chart).
    Sales vs purchases (bar chart).
    Top 5 products by revenue (horizontal bar).
    Expense category breakdown (pie/donut chart).
    All graphs respond to the daily/weekly/monthly/yearly toggle.

4d. Tax calculation
    GST liability calculated automatically from transactions.
    CGST + SGST (intra-state) or IGST (inter-state) based on
    store configuration.
    Output: GST collected on sales, GST paid on purchases,
    net GST payable for the period.
    Exportable as a simple statement for the CA.

4e. Fixed costs integration
    Fixed costs entered in Phase 1 are distributed across
    reporting periods (daily cost = monthly cost / 30).
    Always shown in profit calculations so merchant sees
    true net profit, not just gross margin.

4f. Periodic reports
    Weekly report: generated every Monday automatically.
    Monthly report: generated on the 1st of each month.
    Yearly report: available on demand.
    Each report includes: sales summary, top products,
    profit, tax estimate, inventory status, and an
    AI-written plain-language summary in the merchant's language.
    Downloadable as PDF or shareable as a link.

════════════════════════════════════════
PHASE 5 - AI Advisor
════════════════════════════════════════

Goal: a conversational AI that knows the merchant's business
and answers questions the way a trusted CFO or senior
employee would.

5a. Chat interface
    Merchant types or (in future) speaks any question.
    Context: last 90 days of transactions, current inventory,
    fixed costs, tax config, store type.
    Claude answers in the merchant's preferred language.

    Example questions and what Claude should do:
    "Why is cash low?" → compare sales vs purchases + fixed costs,
      identify the gap, explain in plain language.
    "What should I order this week?" → pull from ordering
      suggestions (Phase 3d) and explain reasoning.
    "Am I making money on cold drinks?" → calculate margin
      on that category specifically.
    "Which customer owes the most?" → pull from receivables,
      rank, suggest follow-up action.
    "Is this month better than last month?" → compare periods,
      highlight what changed and why.

5b. Proactive suggestions
    Claude generates one daily insight shown as a card
    on the dashboard. Not a generic tip - must be based on
    that merchant's actual data.
    Examples:
    "Your Tuesday sales are consistently 30% lower than
    other days. Consider a Tuesday offer."
    "You bought ₹8,000 of [product] this month but only
    sold ₹2,000 worth. Check your pricing."
    Merchant can tap "Tell me more" to open the full chat.

════════════════════════════════════════
PHASE 6 - Data Import and Migration
════════════════════════════════════════

Goal: a merchant with existing data should not have to
start from zero.

6a. Excel and CSV import
    On onboarding (and any time after), offer:
    "Do you have existing data? Upload an Excel or CSV."
    Accepted: product list, customer list, transaction history,
    inventory snapshot.
    Claude parses the uploaded file and maps columns
    intelligently (e.g. "Price" maps to selling_price,
    "Stock" maps to current_quantity).
    Merchant reviews mapping before confirming import.

6b. Sample store templates
    Available at onboarding and in settings.
    Types: kirana, medical shop, hardware store,
    restaurant (basic), clothing store, electronics shop.
    Each template includes:
      Pre-populated product catalog (~50-100 common products)
      Suggested categories and subcategories
      Common fixed costs for that store type
      Example customers (demo data, clearly labelled)
    Data sourced from curated Kaggle open datasets of
    Indian product catalogs (FMCG, retail, pharmacy).
    Merchant can delete or edit any template item.

6c. Handwriting correction database
    Every extraction correction is stored per store.
    When Claude Vision processes a new document from
    that store, the last 5 corrections are included
    as few-shot examples in the prompt.
    This is the primary mechanism for improving per-merchant
    accuracy over time without any model fine-tuning.

════════════════════════════════════════
PHASE 7 - Voice Entry (future reference)
════════════════════════════════════════

Do not build this now. Design all interfaces so voice can
be added as an input layer without structural changes.

Future implementation plan (for reference):
  Trigger: microphone button on the quick entry screen.
  Step 1: Web Speech API (browser-native, free, works offline).
    Converts spoken words to text.
    "Added 5 Thums Up, 2 biscuits, 3 bread" →
    parsed into line items via Claude.
  Step 2: If complex or ambiguous, escalate to Gemini Audio API
    (or Claude with audio input when available) for richer
    understanding of Hindi/regional language mixed input.
  All voice input goes through the same confirm screen
  as bill scanning. Merchant reviews before saving.
  Voice assistant responses (reading out the balance,
  confirming saves) use the browser's speech synthesis API.

Design requirement now:
  Every action that will support voice must have a
  corresponding structured API endpoint that accepts
  plain-language intent JSON, not just form data.
  This makes Phase 7 a UI addition, not an architectural change.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE SCHEMA - Prisma models
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

stores
  id, owner_id (FK auth.users),
  name, type, owner_name, city,
  gst_number, preferred_language,
  is_interstate, created_at

products
  id, store_id, item_number (sequential per store),
  parent_product_id (null if not a variant),
  name, brand, category, subcategory,
  unit, purchase_price, selling_price,
  tax_rate, shelf_life_days,
  is_active, is_pinned,
  created_at, updated_at

inventory
  id, store_id, product_id,
  current_stock, reorder_point,
  last_restocked_at, expiry_date,
  updated_at

stock_movements
  id, store_id, product_id,
  movement_type (purchase | sale | adjustment | waste),
  quantity, unit_price,
  transaction_id, reason,
  created_at

customers
  id, store_id, name, phone,
  type (walk_in | regular | wholesale),
  credit_limit, current_balance,
  notes, created_at

transactions
  id, store_id, user_id,
  date, type (sale | purchase | expense | income),
  total_amount, payment_method,
  customer_id, vendor_name,
  source (manual_quick | manual_full | bill_scan |
          csv_import | excel_import),
  source_document_id,
  tax_amount, tax_type,
  notes, created_at, updated_at

transaction_items
  id, transaction_id, product_id,
  product_name_raw (what was on the bill),
  quantity, unit_price, total_price,
  tax_rate, is_confirmed

document_uploads
  id, store_id, user_id,
  storage_path, file_type,
  document_type (single_bill | ledger_page | bank_statement
                 | excel | csv),
  extraction_status, raw_extraction_json,
  confidence, created_at

extraction_corrections
  id, store_id, document_upload_id,
  field_name, original_value, corrected_value,
  created_at

fixed_costs
  id, store_id, name, amount,
  frequency, category, is_active,
  created_at

ai_conversations
  id, store_id, messages (JSONB), created_at

periodic_reports
  id, store_id, report_type (daily|weekly|monthly|yearly),
  period_start, period_end,
  summary_text, report_json, created_at

kaggle_products (seed table, read-only)
  id, store_type, name, brand, category,
  subcategory, unit, typical_price_range,
  common_gst_rate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/app
  /(auth)
    /login              page.tsx
    /signup             page.tsx
    /onboarding         page.tsx - store setup + sample import
  /(dashboard)          layout.tsx - session guard here only
    /dashboard          page.tsx - home, today's snapshot
    /scan               page.tsx - bill scanner
    /entry              page.tsx - quick + full manual entry
    /inventory          page.tsx - stock list + alerts
    /products           page.tsx - catalog management
    /customers          page.tsx - customer list + ledgers
    /reports            page.tsx - all reports + graphs
    /advisor            page.tsx - AI chat
    /settings           page.tsx - store config, tax, fixed costs
  /api
    /scan               route.ts - upload + extract
    /scan/confirm       route.ts - save confirmed items
    /entry/quick        route.ts - quick +/- transaction
    /entry/full         route.ts - full transaction form
    /products           route.ts - CRUD
    /inventory          route.ts - stock levels + movements
    /inventory/suggest  route.ts - AI ordering suggestions
    /customers          route.ts - CRUD + balance
    /reports            route.ts - generate reports
    /ai/chat            route.ts - advisor chat (streaming)
    /ai/insight         route.ts - daily proactive insight
    /import/excel       route.ts - Excel/CSV upload + parse
    /import/confirm     route.ts - bulk import confirm

/components
  /scan
    ScanUpload.tsx
    ExtractionReview.tsx     single bill confirm
    LedgerReview.tsx         multi-row confirm
    ConfidenceBadge.tsx
    DuplicateWarning.tsx
  /entry
    QuickEntry.tsx           +/- grid of frequent products
    FullEntryForm.tsx
    ProductSearch.tsx        fuzzy search with item numbers
    VariantSelector.tsx      dropdown for product variants
  /inventory
    StockList.tsx
    ConsumptionCard.tsx      shows rate + days-until-stockout
    ExpiryAlert.tsx
    OrderSuggestionCard.tsx
  /products
    ProductCard.tsx
    VariantManager.tsx
    CategoryBrowser.tsx
  /customers
    CustomerLedger.tsx
    CreditBadge.tsx
  /reports
    PeriodToggle.tsx         daily/weekly/monthly/yearly
    CashFlowChart.tsx
    SalesPurchasesChart.tsx
    TopProductsChart.tsx
    TaxSummary.tsx
    ProfitCard.tsx
  /ai
    ChatInterface.tsx
    InsightCard.tsx
  /shared
    QuickStatCard.tsx
    AlertBanner.tsx
    EmptyState.tsx
    LoadingState.tsx

/lib
  /supabase
    server.ts
    browser.ts
  /anthropic
    client.ts
    prompts.ts           all system prompts as named exports
    extraction.ts        Vision extraction + few-shot logic
    advisor.ts           chat context builder
    insight.ts           daily insight generator
  /parsers
    excel.ts             xlsx parsing for import
    csv.ts               CSV parsing for import
    amounts.ts           Indian amount format normalizer
    dates.ts             Indian date format normalizer
  /inventory
    consumption.ts       rate calculation + stockout prediction
    suggestions.ts       ordering suggestion logic
  /reports
    profit.ts            net profit calculation with fixed costs
    tax.ts               GST calculation (CGST+SGST / IGST)
    periods.ts           period boundary helpers
  /utils
    fuzzy.ts             fuzzy product name matching
    formatting.ts        INR, dates, percentages

/data
  /seeds
    kirana.ts            sample kirana product catalog
    medical.ts           sample medical shop catalog
    hardware.ts          sample hardware store catalog
    restaurant.ts        sample restaurant catalog
    clothing.ts          sample clothing store catalog

/prisma
  schema.prisma
  /migrations
  /seeds
    kaggle_products.ts   seed script for product reference data

/types
  index.ts
  supabase.ts

/hooks
  useProducts.ts
  useInventory.ts
  useTransactions.ts
  useReports.ts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTRACTION SPEC - Claude Vision
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The extraction prompt must:

1. Include 3 few-shot examples of correctly extracted
   Indian bills (loaded from the kaggle_examples table,
   filtered by document type detected).

2. Include the last 5 extraction_corrections for this store
   as additional few-shot examples.
   Format: "In a previous scan for this store,
   '[original]' was corrected to '[corrected]'."

3. Ask Claude to:
   a. Identify: single_bill or ledger_page
   b. For single_bill return one transaction object
   c. For ledger_page return an array of transaction objects
   d. Match each line item to a product_id from the store's
      catalog if possible (pass top 20 products by frequency
      as context)
   e. Flag any item not found in catalog as needs_catalog_add
   f. Return confidence per field: high / medium / low
   g. Handle Indian formats: "Rs.", "₹", Devanagari numerals,
      Dr/Cr columns, "only" suffix, partial dates

4. Return ONLY valid JSON. No preamble, no markdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA SOURCES - Kaggle integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these Kaggle datasets (publicly available, open licence)
to seed the product database and extraction examples:

For product catalog seeding:
  "Indian Grocery Store Dataset" - FMCG product names,
  categories, common prices for kirana context.
  "Indian Retail Products Dataset" - broader retail coverage.
  Manually curate top 100-200 products per store type.
  Store in /data/seeds/ as TypeScript constants.
  Run once via prisma seed to populate kaggle_products table.

For extraction few-shot examples:
  Curate 10-15 examples of correctly parsed Indian bills
  (GST invoices, handwritten bills, delivery challans).
  Store in a bill_examples table with:
    image description, extracted JSON (ground truth).
  These are passed as few-shot context in the extraction prompt,
  not used for model training.

Do not call the Kaggle API at runtime.
All Kaggle data is preprocessed, curated, and stored locally
in the app's own database. Static, not dynamic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UX PRINCIPLES - apply to every screen
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Every primary action must be reachable in 2 taps from home.
2. Frequently used products always appear first in every list.
3. +/- buttons on any quantity field. Never make the user type
   a number when tapping is faster.
4. Confirm before any destructive or irreversible action.
5. All confirmations show exactly what will be saved.
   No surprises after saving.
6. Empty states are helpful, not blank.
   "No products yet - add your first product" with a button.
7. All error messages are in plain language.
   Never show technical errors to the merchant.
8. Loading states always show something useful.
   Never a blank screen.
9. Every list is searchable. Search icon always visible.
10. The app must be fully usable on a mid-range Android phone
    with a slow 4G connection. No heavy assets on initial load.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKFLOW - same for every feature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 - THINK
  Invoke superpowers:brainstorming before any decision.
  Surface tradeoffs, alternatives, hidden constraints.

STEP 2 - PLAN
  Invoke superpowers:writing-plans.
  Output: numbered tasks, dependencies, files touched,
  success criteria, what done looks like.

STEP 3 - STOP AND SHOW
  Present full plan. Do not write application code until
  user types "approved" or "go".
  Revise if requested. Show again. Repeat until approved.

STEP 4 - BUILD
  Invoke superpowers:executing-plans.
  Any task touching more than one file:
    invoke superpowers:subagent-driven-development.
    One subagent per task. Never batch.

STEP 5 - SECURITY CHECK
  End of every phase: invoke vibe-security.
  Fix all Critical and High findings before next phase.
  Show findings as: Severity | Issue | File:Line | Fix

STEP 6 - COMMIT GATE
  Phase complete: list changed files, write commit message.
  STOP. Wait for "commit" before running git commit.
  Never auto-commit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE COMMENT BLOCK - every file touched
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FILE: [path from root]
 *
 * WHAT THIS DOES:
 *   [Single responsibility of this file]
 *
 * CHANGES THIS SESSION:
 *   - [change 1]
 *   - [change 2]
 *
 * WHERE IT FITS:
 *   [How it connects to the rest of the app]
 *
 * CALLED BY / IMPORTS FROM:
 *   [Key consumers or dependencies]
 */

No file is committed without this block.
If the file already has the block, update CHANGES only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECURITY REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.  Every table has RLS. Verify after every migration.
2.  No secrets in NEXT_PUBLIC_ variables.
3.  Rate limits:
      Auth: 5 req/min/IP
4.  Every API route: check session, scope queries to store_id.
5.  File uploads: validate MIME type server-side, max 10MB.
6.  Never SELECT *. Always name columns.
7.  All DB writes via Prisma parameterised queries.
8.  Storage buckets are private. RLS on all file access.
9.  Before any auth/upload route:
    invoke fullstack-dev-skills:secure-code-guardian.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SKILLS - invoke at these triggers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before any UI component:
  → ui-ux-pro-max:ui-ux-pro-max
  → frontend-design:frontend-design

Before visual decisions:
  → design-taste-frontend

Before auth/upload routes:
  → fullstack-dev-skills:secure-code-guardian

End of each phase:
  → vibe-security

When something is broken:
  → superpowers:systematic-debugging

Landing page or public UI:
  → high-end-visual-design

Animations or transitions:
  → emil-design-eng

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHEMA DESIGN DECISIONS (from brainstorm)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- store_id is the primary tenant key on all data tables
- stores.owner_id = auth.uid() for v1 (one user = one store)
- RLS policy pattern: store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
- kaggle_products has no RLS - it is a public read-only seed table
- Prisma used for migrations; API routes use Supabase client with user JWT for RLS
- Migration order: stores → products → inventory → customers → transactions →
  transaction_items → stock_movements → document_uploads → extraction_corrections →
  fixed_costs → ai_conversations → periodic_reports → kaggle_products

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION LEARNINGS (UI/UX polish pass)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- snake_case vs camelCase trap: Supabase/PostgREST returns snake_case
  (current_balance, selling_price, is_pinned). Several components read
  camelCase and silently rendered NaN/undefined. When a value shows as
  ₹NaN, suspect this first. Fixes applied: QuickEntry (selling_price),
  customers page (current_balance, normalized in the fetch), and
  CreditBadge now guards with Number.isFinite as a safety net.
  Rule: when consuming a Supabase response, normalize to the camelCase
  type at the fetch boundary, do not assume the field name matches.

- Sale / Purchase / Expense: all three are required for true profit and
  correct inventory (Sale = goods out / cash in, decreases stock;
  Purchase = stock in / cash out, increases stock; Expense = cash out,
  no stock). Sale is ~90% of daily use, so the quick-entry screen is
  Sale-first: Sale is the default, Purchase/Expense tuck behind a
  "Recording something else?" toggle.

- Products discoverability: the catalog (/products) is reached via a
  [Stock | Products] segmented tab (components/shared/StockTabs.tsx)
  shown on both /inventory and /products, so it works on mobile too.

- Logout lives in components/shared/LogoutButton.tsx (variants: "nav"
  for the Sidebar, "button" for Settings). It signs out of Supabase and
  always returns to "/" (landing), even if sign-out errors.

- Reports per-item: buildReport now returns itemsSold (full revenue-sorted
  list); topProducts stays capped at 10 for the charts. The Reports page
  shows a collapsed ItemsSoldCard preview (top 3) that expands to the full
  list, respecting the period toggle.

- Landing motion lives in components/landing/LandingReveal.tsx (scroll
  reveal + count-up + mouse parallax) and app/globals.css (hero-aurora,
  cta-shine, parallax, reveal keyframes). All motion respects
  prefers-reduced-motion.

- Em dashes were swept from app/, components/, lib/, types/ and this file
  via a Node script (replace /\s*—\s*/g with " - "). Keep them out.
