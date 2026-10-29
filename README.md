# Mercato

Mercato is a production-grade, high-performance online store platform built with TypeScript, Next.js 16 (App Router), Drizzle ORM, PostgreSQL (Neon), Upstash Redis, and Tailwind CSS. It is inspired by modern commerce platforms such as Shopify and designed with a dual surface: a customer-facing storefront and a merchant-facing admin dashboard.

---

## Architecture Overview

Mercato is structured as a modular monolith inside a single repository and single Next.js application. Domains are partitioned into self-contained modules located in `src/modules/<domain>/`:

- **catalog:** Products, variants, collections, categories
- **inventory:** Stock counts, reservations, adjustments
- **cart:** Guest cart persistence, customer session merging
- **checkout:** Checkout sessions, address collection, shipping selection
- **orders:** Order state machine, fulfillment, timeline
- **payments:** Swappable payment provider strategy (Midtrans and Stripe)
- **shipping:** Courier rates, flat rate, and regional adapters
- **customers:** Customer profiles, addresses, order history
- **discounts:** Coupon engine, percentage, fixed, spend thresholds
- **analytics:** Merchant revenue, order, and stock metrics
- **settings:** Store configuration, taxes, shipping zones, staff access

The platform uses integer minor units for all money amounts to eliminate floating-point precision drift. Inventory concurrency uses row-level locking (`SELECT ... FOR UPDATE`) to guarantee stock integrity under concurrent checkouts.

---

## Tech Stack

- **Framework:** Next.js 16.4.3 (App Router, Turbopack, Cache Components, React 19)
- **Language:** TypeScript 7.0.2 with strict mode and `noUncheckedIndexedAccess`
- **Database:** PostgreSQL (Neon) with connection pooling via `node-postgres`
- **ORM:** Drizzle ORM 0.45.4 with Drizzle Kit migrations
- **Caching & Rate Limiting:** Upstash Redis (`@upstash/redis` and `@upstash/ratelimit`)
- **Styling:** Tailwind CSS 4.3.3 and shadcn/ui primitives
- **Form Management:** React Hook Form with Zod 4.6.7
- **Internationalization:** `next-intl` (Indonesian and English)
- **Logging:** Structured JSON logging via Pino
- **Testing:** Vitest for unit and integration testing, Playwright for end-to-end tests
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

Note for Windows PowerShell users: If your system has script execution disabled, invoke `pnpm.cmd` directly or run through the command prompt (`cmd.exe`).

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your configuration values:

1. **DATABASE_URL:** Your pooled connection string from Neon (development branch). Example: `postgresql://user:password@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/mercato?sslmode=require`
2. **TEST_DATABASE_URL:** An isolated Neon test branch or local test database connection string. Test runs strictly refuse to run if `TEST_DATABASE_URL` matches `DATABASE_URL`.
3. **UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN:** REST credentials from your Upstash Redis database console.
4. **BETTER_AUTH_SECRET:** A random 32-character string for signing session tokens.
5. **BETTER_AUTH_URL & NEXT_PUBLIC_APP_URL:** Defaults to `http://localhost:3000` for local development.

### 3. Database Migrations

Generate and execute migrations using Drizzle Kit:

```bash
# Migrate primary development database
pnpm db:generate
pnpm db:migrate

# Migrate isolated test branch database
pnpm db:migrate:test
```

To inspect database records interactively, open Drizzle Studio:

```bash
pnpm db:studio
```

### 4. Development Server

Start the Next.js development server with Turbopack:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application automatically directs to the default locale (`/id` or `/en`).

---

## Verification and Quality Commands

Mercato enforces strict quality standards before any code is committed or merged:

```bash
# Run unit and integration test suite
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
├── .github/workflows/         # CI/CD automation pipelines
├── docs/                      # Architectural decisions and roadmap
│   ├── DECISIONS.md           # Architecture Decision Records (ADRs)
│   └── ROADMAP.md             # Deferred features and milestones
├── messages/                  # Internationalization translation files
│   ├── en.json
│   └── id.json
├── src/
│   ├── app/                   # App Router pages and layouts
│   │   ├── (admin)/           # Merchant administrative portal
│   │   ├── (auth)/            # Customer authentication flows
│   │   ├── (storefront)/      # Customer-facing shopping interface
│   │   ├── [locale]/          # Localized storefront routes
│   │   ├── api/               # Webhooks, Inngest, and auth handlers
│   │   ├── globals.css        # Tailwind CSS v4 styling rules
│   │   ├── layout.tsx         # Root HTML layout
│   │   └── not-found.tsx      # Global 404 handler
│   ├── components/            # UI components (shared, storefront, admin)
│   ├── i18n/                  # Routing and message loader configuration
│   ├── lib/                   # Infrastructure helpers (db, cache, env, money, logger)
│   ├── modules/               # Domain-driven feature modules
│   ├── proxy.ts               # Next.js 16 request proxy layer
│   └── server/                # Server-only authorization and transaction helpers
└── tests/                     # Unit, integration, and end-to-end tests
```

---

## License

Private and proprietary. All rights reserved.
