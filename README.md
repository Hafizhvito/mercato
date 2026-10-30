# Mercato

Mercato is a production-grade, high-performance online store platform built with TypeScript, Next.js 16 (App Router), Drizzle ORM, PostgreSQL (Neon), Upstash Redis, and Tailwind CSS. It is inspired by modern commerce platforms such as Shopify and designed with a dual surface: a customer-facing storefront and a merchant-facing admin dashboard.

---

## Architecture Overview

Mercato is structured as a modular monolith inside a single repository and single Next.js application. Domains are partitioned into self-contained modules located in `src/modules/<domain>/`:

- **catalog:** Products, variants, collections, categories, Cartesian SKU matrices
- **inventory:** Stock counts, row-level locked reservations (`SELECT ... FOR UPDATE`), automated sweeping
- **cart:** Guest cart persistence, cookie security, line-item caps, customer session merging
- **checkout:** Single-page checkout, 5-digit postal code validation, Kemendagri cascading address lookups
- **orders:** Strictly typed state machine, immutable financial snapshots, timeline history, IDOR access protection
- **payments:** Swappable payment provider strategy (Midtrans Snap and Stripe Checkout) with automatic late-payment reconciliation
- **shipping:** Deterministic tiered rates and Kemendagri hierarchical administrative region adapters
- **customers:** Customer profiles, addresses, order history
- **discounts:** Coupon engine, percentage, fixed amount, spend thresholds, free shipping
- **analytics:** Merchant revenue, order, and stock metrics
- **settings:** Store configuration, taxes, shipping zones, staff access

The platform uses integer minor units for all money amounts to eliminate floating-point precision drift. Inventory concurrency uses row-level locking (`SELECT ... FOR UPDATE`) inside interactive transactions to guarantee stock integrity under concurrent checkouts.

---

## Tech Stack

- **Framework:** Next.js 16.4.3 (App Router, Turbopack, React 19)
- **Language:** TypeScript 7.0.2 with strict mode and `noUncheckedIndexedAccess`
- **Database:** PostgreSQL (Neon) with connection pooling via `node-postgres`
- **ORM:** Drizzle ORM 0.45.4 with Drizzle Kit migrations
- **Caching & Rate Limiting:** Upstash Redis (`@upstash/redis` and `@upstash/ratelimit`)
- **Styling:** Tailwind CSS 4.3.3 and shadcn/ui primitives
- **Form Management:** React Hook Form with Zod 4.6.7
- **Internationalization:** `next-intl` (Indonesian and English)
- **Logging:** Structured JSON logging via Pino
- **Testing:** Vitest for unit and integration testing, MSW for mock HTTP APIs, Playwright for end-to-end tests
- **Linting & Formatting:** Biome 2.6.4

---

## Getting Started

### Prerequisites

- Node.js current LTS (v24 or v22)
- pnpm package manager (`pnpm -v` >= 12.0.0)
- Neon PostgreSQL database instance (with connection pooling enabled)
- Upstash Redis database instance

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/<owner>/mercato.git
cd mercato
pnpm install
```

*Note for Windows PowerShell users:* If your system has script execution disabled, invoke `pnpm.cmd` directly or execute through `cmd.exe`.

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your configuration values:

1. **DATABASE_URL:** Your pooled connection string from Neon (development branch).
2. **TEST_DATABASE_URL:** An isolated Neon test branch or local test database connection string. Test runs strictly refuse to execute if `TEST_DATABASE_URL` matches `DATABASE_URL`.
3. **UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN:** REST credentials from your Upstash Redis console. In production, the application will refuse to boot if Upstash credentials are missing or set to dummy values.
4. **BETTER_AUTH_SECRET:** A random 32-character string for signing session tokens.
5. **BETTER_AUTH_URL & NEXT_PUBLIC_APP_URL:** Defaults to `http://localhost:3000` for local development.
6. **SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD:** Required credentials for provisioning the initial store owner account. Minimum 12 characters with mixed uppercase, lowercase, numbers, and symbols.
7. **MIDTRANS_SERVER_KEY & NEXT_PUBLIC_MIDTRANS_CLIENT_KEY:** Midtrans Sandbox API keys.
8. **STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET:** Stripe test API keys.
9. **RESEND_API_KEY:** Resend API key for transactional emails. If unset or containing test keys, Mercato automatically falls back to `ConsoleEmailService` (printing email bodies and links to stdout).

### 3. Database Migrations and Regional Dataset

Generate and execute migrations using Drizzle Kit:

```bash
# Migrate primary development database
pnpm db:generate
pnpm db:migrate

# Migrate isolated test branch database
pnpm db:migrate:test

# Import complete Indonesian administrative regions (38 prov, 514 reg, 7,265 dist)
pnpm db:import-regions
```

To seed development catalog and promotional coupons:

```bash
pnpm db:seed
```

To purge legacy dummy accounts from earlier phases:

```bash
pnpm db:cleanup-legacy-admin --confirm
```

### 4. Development Server

Start the Next.js development server with Turbopack:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application automatically directs to the default locale (`/id` or `/en`).

---

## Local Background Tasks & Webhook Testing

### Local Background Automations with Inngest

Mercato uses Inngest for asynchronous background tasks (inventory reservation sweeping, abandoned checkout cleanup):

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

This launches the local Inngest dev dashboard at [http://localhost:8288](http://localhost:8288), where you can inspect events, triggers, and scheduled cron jobs.

### Local Webhook Testing

1. **Stripe Webhooks:**
   Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and forward events locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Set the printed signing secret into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

2. **Midtrans Webhooks:**
   Expose your local development server using Ngrok:
   ```bash
   ngrok http 3000
   ```
   Configure the forwarding URL in your Midtrans Sandbox Dashboard -> *Settings* -> *Configuration* -> *Payment Notification URL*:
   `https://<your-subdomain>.ngrok-free.app/api/webhooks/midtrans`

---

## Demo Data & Features

### Seeded Promotional Discounts

The following promotional coupons are pre-seeded in the database:

| Coupon Code | Discount Type | Value | Minimum Spend | Details |
| :--- | :--- | :--- | :--- | :--- |
| `MERCATO10` | Percentage | 10% | None | 10% off entire order subtotal |
| `HEMAT10` | Percentage | 10% | Rp 50.000 | 10% off for orders >= Rp 50.000 |
| `HEMAT20RB` | Fixed Amount | Rp 20.000 | Rp 100.000 | Rp 20.000 off for orders >= Rp 100.000 |
| `GRATISONGKIR`| Free Shipping| Up to Rp 25.000 | Rp 150.000 | Free standard shipping for orders >= Rp 150.000 |

### Cart Quantity Limits & Integrity

To protect stock integrity and prevent hoarding during flash sales:
- **Maximum per item:** Capped at `MAX_CART_ITEM_QUANTITY = 10` per variant.
- **Cart Alerts:** When adding or updating items, if an item is clamped, a UI warning informs the customer whether it was capped due to `MAX_ORDER_LIMIT` (per-order limit) or `INSUFFICIENT_STOCK`.
- **Cart Cookie Security:** Cart sessions are tracked via the `mercato_cart_id` cookie configured with `HttpOnly: true`, `SameSite: "Lax"`, `Secure: process.env.NODE_ENV === "production"`, `Path: "/"`.

### Complete Indonesian Administrative Regions

Mercato incorporates the complete, authoritative administrative boundary dataset adhering strictly to **Kepmendagri No 300.2.2-2138 Tahun 2025** (sourced via `cahyadsn/wilayah` under the MIT License):
- **38 Provinces** (including all 4 new Papua provinces: Papua Selatan, Papua Tengah, Papua Pegunungan, Papua Barat Daya)
- **514 Regencies and Municipalities**
- **7,265 Districts**
- Strict 5-digit postal code validation with automated reset when changing higher-level administrative boundaries.

---

## Verification and Quality Commands

Mercato enforces strict quality standards before any code is committed or merged:

```bash
# Run unit and integration test suite (Vitest + MSW)
pnpm test

# Type-check TypeScript files with strict flags
pnpm typecheck

# Check formatting and code linting with Biome
pnpm lint

# Automatically fix linting and formatting issues
pnpm lint:fix

# Create an optimized production build
pnpm build
```

---

## Project Structure

```
mercato/
├── .github/workflows/         # CI/CD pipelines (Vitest, Biome, Gitleaks)
├── data/                      # Kepmendagri 2025 authoritative region dataset
├── docs/                      # Architectural decisions and roadmap
│   ├── DECISIONS.md           # Architecture Decision Records (ADRs 0001 - 0022)
│   └── ROADMAP.md             # Deferred features and milestones
├── messages/                  # Internationalization translation dictionaries
│   ├── en.json
│   └── id.json
├── src/
│   ├── app/                   # App Router pages, layouts, and route handlers
│   │   ├── (admin)/           # Merchant administrative portal
│   │   ├── (auth)/            # Customer authentication flows
│   │   ├── [locale]/          # Localized storefront routes (/cart, /checkout, /orders)
│   │   ├── api/webhooks/      # Midtrans & Stripe transactional webhook endpoints
│   │   ├── globals.css        # Tailwind CSS v4 styling rules
│   │   └── layout.tsx         # Root HTML layout
│   ├── components/            # UI components (storefront, admin, shared)
│   ├── lib/                   # Infrastructure helpers (db, email, logger, money, cache)
│   │   ├── email/             # Resend adapter + React Email templates
│   │   └── shipping/          # Kemendagri region dataset importer
│   ├── modules/               # Domain-driven feature modules
│   │   ├── cart/              # Cart state management and quantity limits
│   │   ├── catalog/           # Product and variant catalog
│   │   ├── discounts/         # Discount and coupon engine
│   │   ├── inventory/         # Row-level locked stock reservations
│   │   ├── orders/            # Order state machine and IDOR access verification
│   │   ├── payments/          # Midtrans Snap & Stripe Checkout adapters
│   │   └── shipping/          # Tiered logistics and region lookups
│   ├── proxy.ts               # Next.js 16 request proxy layer
│   └── server/                # Server-only authorization and transaction helpers
└── tests/                     # Unit, integration, and concurrency test suites
```

---

## License

Private and proprietary. All rights reserved.
