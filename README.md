# PakkaHisab

A complete business operating system for Indian SME owners. Scan bills, manage inventory, track customers, understand profit, and get AI-powered suggestions - all in one place.

**Live:** [pakka-hisab.vercel.app](https://pakka-hisab.vercel.app)

## What it does

PakkaHisab replaces the paper khata (ledger) that millions of Indian shopkeepers still use. Every feature is designed to feel faster than doing it on paper.

### Core Features

- **Voice-first sales** - Speak items in Hinglish ("2 doodh, 3 Parle-G"), watch them land in a live cart. Commands: "agla" (save and next), "khatam" (finish), "balance batao" (read total aloud). Supports udhaar (credit) by voice.

- **Bill scanning** - Photograph a printed receipt, GST invoice, handwritten bill, or khata page. AI extracts items, matches them to your catalog, and learns from corrections over time.

- **Quick entry** - Tap +/- on products to log a sale in seconds. Frequently sold items float to the top automatically.

- **Inventory management** - Real-time stock levels with color-coded alerts (green/amber/red). AI suggests what to order, what to reduce, and what's expiring soon. Consumption rate tracking predicts days until stockout.

- **Customer credit (Udhaar)** - Track who owes what. Per-customer ledger with full transaction history. One-tap WhatsApp reminders with customizable templates.

- **Reports and profit** - Daily, weekly, monthly, yearly views. Cash flow charts, sales vs purchases, top products, payment method breakdown. True net profit includes fixed costs (rent, salaries, electricity). GST calculation built in.

- **AI Business Advisor** - Ask any question about your business in plain language. "Why is cash low?" "Which customer owes the most?" "Is this month better than last?" Gets a data-backed answer in seconds.

- **Transaction history** - Every sale, purchase, and expense tracked on the dashboard. Tap to expand, void mistakes with automatic stock restoration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (email OTP, magic link) |
| AI | Google Gemini (bill extraction, voice parsing, advisor) |
| Voice | Web Speech API + VAD (voice activity detection) |
| Deployment | Vercel |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in your Supabase and API keys

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```

## Project Structure

```
app/               Next.js App Router pages and API routes
components/        React components organized by feature
lib/               Business logic, AI prompts, utilities
hooks/             Custom React hooks
types/             TypeScript type definitions
prisma/            Database schema and migrations
data/seeds/        Product catalog templates by store type
```

## Target Users

Kirana stores, medical shops, hardware stores, distributors, small manufacturers - anyone who tracks daily business manually in India.

## License

Private - All rights reserved.
