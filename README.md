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
- **Internationalization:** `next-intl` (Indonesian and English) with 100% key parity
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

1. **DATABASE_URL:** Your pooled connection string from Neon (development branch). Use `?sslmode=verify-full` to ensure strict TLS verification while eliminating Node `pg` alias warnings.
2. **TEST_DATABASE_URL:** An isolated Neon test branch or local test database connection string with `?sslmode=verify-full`. Test runs strictly refuse to execute if `TEST_DATABASE_URL` matches `DATABASE_URL`.
3. **UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN:** REST credentials from your Upstash Redis console. In production runtime, the application will refuse to boot if Upstash credentials are missing or set to dummy values.
4. **BETTER_AUTH_SECRET:** A random 32-character string for signing session tokens.
5. **BETTER_AUTH_URL & NEXT_PUBLIC_APP_URL:** Defaults to `http://localhost:3000` for local development.
6. **SEED_ADMIN_EMAIL & SEED_ADMIN_PASSWORD:** Required credentials for provisioning the initial store owner account. Minimum 12 characters with mixed uppercase, lowercase, numbers, and symbols.
7. **MIDTRANS_SERVER_KEY & NEXT_PUBLIC_MIDTRANS_CLIENT_KEY:** Midtrans Sandbox API keys.
8. **STRIPE_SECRET_KEY & STRIPE_WEBHOOK_SECRET:** Stripe test API keys.
9. **RESEND_API_KEY:** Resend API key for transactional emails. If unset or containing test keys, Mercato automatically falls back to `ConsoleEmailService` (printing email bodies and links to stdout).

> [!CAUTION]
> **Production Hosting Guard:** `SKIP_ENV_VALIDATION` must **never** be set on hosting platforms (such as Vercel, Railway, or Fly.io). It is reserved strictly for build-time compilation inside isolated CI runners. In production runtime, Mercato's rate limiter and environment guards enforce strict Upstash Redis credentials and database URLs to protect against unmetered traffic and misconfiguration.

### 3. Safe Database Migrations, Seeding, and Scripts

Mercato includes safety guards on all mutating data scripts (`seed`, `seed-catalog`, `rewrite-legacy-images`, and `cleanup-legacy-admin`). To prevent accidental execution against production branches or incorrect databases:
1. Scripts refuse to run if `NODE_ENV === "production"`.
2. Running a script without parameters displays the masked target (e.g. `ep-sw***tech/neondb`) and prompts for explicit confirmation.
3. Execution requires the exact masked target flag:

```bash
# Migrate primary development database
pnpm db:generate
pnpm db:migrate

# Migrate isolated test branch database
pnpm db:migrate:test

# Import complete Indonesian administrative regions (38 prov, 514 reg, 7,265 dist)
pnpm db:import-regions

# Seed development users and store owner (requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local)
pnpm db:seed --confirm-target=ep-sw***tech/neondb

# Seed catalog categories, collections, and products
pnpm db:seed-catalog --confirm-target=ep-sw***tech/neondb

# Rewrite any legacy external image URLs to self-hosted placeholders
pnpm db:rewrite-legacy-images --confirm-target=ep-sw***tech/neondb

# Purge legacy dummy admin accounts from earlier prototype phases
pnpm db:cleanup-legacy-admin --confirm-target=ep-sw***tech/neondb
```

### 4. Development Server

Start the Next.js development server with Turbopack:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The application automatically directs to the default locale (`/id` or `/en`).

---

## External Services & Account Setup

### 1. Midtrans Sandbox Setup (Indonesian Gateway)

Mercato integrates **Midtrans Snap** for domestic Indonesian payment methods (QRIS, GoPay, ShopeePay, BCA/Mandiri/BNI/BRI Virtual Accounts).

#### Obtaining Keys:
1. Register or log in at the [Midtrans Portal](https://dashboard.midtrans.com/).
2. In the top navigation bar, ensure the environment toggle is set to **Sandbox** (not Production).
3. Navigate to **Settings** -> **Access Keys**.
4. Copy the **Server Key** and **Client Key** into `.env.local`:
   ```bash
   MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXXX
   NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXXX
   ```

#### Key Differences & Mismatch Pitfall:
- **Sandbox Keys:** Usually prefixed with `SB-Mid-server-...` and `SB-Mid-client-...` (though some older client keys may omit `SB-`).
- **Production Keys:** Prefixed with `Mid-server-...` and `Mid-client-...`.
- **Environment Mismatch Warning:** If you mix a Sandbox Server Key with a Production Client Key (or vice versa), or generate keys in Production mode while requesting the Sandbox API endpoint, Midtrans will reject payment token creation with:
  ```
  HTTP 401 Unauthorized / Access Denied: Midtrans server rejected request
  ```
  Both keys must originate from the exact same Midtrans dashboard environment.

#### Required API Permissions:
Ensure your Midtrans Server Key has the following features enabled under **Settings** -> **Payment Channels** and **Snap Preferences**:
- Snap Checkout (Popup / Redirect)
- Core API access
- Permission to **Cancel**, **Expire**, and **Refund** transactions (required for automated expiration and admin order refunds).

---

### 2. Resend Setup (Transactional Emails)

Mercato uses **Resend** and `@react-email/components` for sending order confirmations, shipping updates, payment receipts, password resets, and verification emails.

#### Obtaining Keys:
1. Create a free account at [Resend](https://resend.com/).
2. Navigate to **API Keys** -> **Create API Key** (with *Full Access* or *Sending access*).
3. Set the key in `.env.local`:
   ```bash
   RESEND_API_KEY=re_123456789...
   EMAIL_FROM="Mercato <onboarding@resend.dev>"
   ```

#### Free Tier Restrictions & Fallback Behavior:
- **Sandbox / Free Tier Limit:** On Resend's free tier without a verified custom domain, emails can **only** be delivered to the single email address registered as the Resend account owner, and must be sent from `onboarding@resend.dev`. Attempting to send to any other recipient results in:
  ```
  HTTP 403 Forbidden: You can only send testing emails to your own email address
  ```
- **Console Email Fallback:** For local development and testing with arbitrary email addresses, Mercato provides `ConsoleEmailService`. If `RESEND_API_KEY` is omitted, set to a dummy value, or in test environments, Mercato automatically routes emails to the local console output (printing the subject, recipient, token, and clickable verification/reset links), preventing blocked development workflows.

---

### 3. Step-by-Step Local Webhook & Service Testing

#### Testing Midtrans Webhooks Locally:
1. Start your local Mercato server: `pnpm dev` (runs on `http://localhost:3000`).
2. Start a local HTTPS tunnel using `cloudflared` or `untun` (no account required):
   ```bash
   npx untun tunnel http://localhost:3000
   # Or using cloudflared:
   # cloudflared tunnel --url http://localhost:3000
   ```
3. Copy the public HTTPS URL (e.g. `https://xxxx.untun.dev`).
4. In the **Midtrans Sandbox Dashboard**, navigate to **Settings** -> **Configuration** -> **Payment Notification URL**.
5. Set the URL to:
   `https://xxxx.untun.dev/api/webhooks/midtrans`
6. Complete a test payment using the Midtrans Payment Simulator (QRIS scan or Virtual Account simulation). The webhook will hit `/api/webhooks/midtrans`, verify SHA-512 signatures, transition the order state, and record an audit log.

#### Testing Stripe Webhooks Locally:
1. Run the Stripe CLI via `npx`:
   ```bash
   npx stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
2. The Stripe CLI will output a webhook signing secret: `whsec_...`
3. Copy that secret into `STRIPE_WEBHOOK_SECRET` in `.env.local`.
4. Trigger test events via:
   ```bash
   npx stripe trigger checkout.session.completed
   ```

#### Running Inngest Background Sweepers Locally:
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```
Open [http://localhost:8288](http://localhost:8288) to inspect and trigger the `inventory-sweeper` cron job.

---

## Payments, Late Payments, and Status Synchronization

- **Provider Enablement Guard:** Providers only appear in the checkout interface if their API keys are real (rejecting default placeholders like `SB-Mid-server-sample_server_key` or `sk_test_sample_stripe_secret_key`). If no gateway is configured, a helpful notice informs customers to contact store administration.
- **Late Payment Handling (Manual Review Default):** In domestic e-commerce, customers often complete bank Virtual Account transfers after the 15-minute reservation window has expired. If stock is still available, the order is automatically revived to `paid`. If stock has been exhausted by another customer, Mercato flags the order with `paymentStatus = "needs_review"`, records an audit log, and neutrally notifies the customer. Automatic provider refunds are **not** triggered unless explicitly enabled via `AUTO_REFUND_ON_STOCK_EXHAUSTED=true` (off by default).
- **Payment Status Synchronization:** Customers and merchants can click **"Check payment status"** on the order page (`/orders/[orderNumber]`). It calls `getPaymentStatus` and applies the result through the exact same transition and idempotency path as webhooks, protected by rate limiting and guest token authorization.

---

## Indonesian Regional Dataset & Courier Mapping

Mercato embeds the complete administrative hierarchy of Indonesia:
- **38 Provinces**, **514 Regencies/Cities**, and **7,265 Districts**.
- **Dataset License:** Compilation and SQL scripts by `cahyadsn/wilayah` are MIT Licensed.
- **Statutory Origin:** Administrative boundaries, names, and hierarchical codes are statutory government data promulgated by the Ministry of Home Affairs (Kemendagri decrees: Kepmendagri No. 050-145 Tahun 2022, Kepmendagri 100.1.1-6117 Tahun 2022, Permendagri No. 72/2019, Kepmendagri 300.2.2-2138 Tahun 2025). Under **UU No. 28 Tahun 2014 tentang Hak Cipta Pasal 42 huruf b**, official laws, government decrees, and public administrative designations reside permanently in the public domain.
- **RajaOngkir Courier Mapping:** RajaOngkir's Starter API uses internal sequential integer `city_id` values (1 to 501) rather than Kemendagri codes. If `RAJAONGKIR_API_KEY` is not provided, Mercato seamlessly uses the built-in tiered `FlatRateShippingProvider` with zero errors or disruption to checkout.

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
├── data/                      # Kepmendagri authoritative region dataset
├── docs/                      # Architectural decisions and roadmap
│   ├── DECISIONS.md           # Architecture Decision Records (ADRs 0001 - 0023)
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
