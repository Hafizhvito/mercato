# Architecture Decision Records (ADR)

This document records the architectural and engineering decisions made for the Mercato commerce platform.

---

## ADR 0001: Modular Monolith inside Next.js App Router

* **Status:** Accepted
* **Context:** Commerce systems feature tightly coupled domains including catalog, inventory, checkout, payments, and orders. Splitting into separate microservices introduces network latency, serialization overhead, and distributed transaction complexity that is unjustified for the system scale.
* **Decision:** Build Mercato as a modular monolith within a single repository and single Next.js application. Code is partitioned strictly by business domain in `src/modules/<domain>/` with dedicated schema, repository, service, and action layers. UI components never query database tables directly.
* **Consequences:** Ensures high developer velocity, cross-domain type safety, and atomic deployment while keeping clean domain boundaries that can be factored into standalone services in the future if required.

---

## ADR 0002: Drizzle ORM with Node-Postgres Connection Pool

* **Status:** Accepted
* **Context:** E-commerce inventory management requires deterministic, fine-grained control over raw SQL execution, interactive transactions, and row-level locking (`SELECT ... FOR UPDATE`) to prevent overselling. Database routes execute in the Node.js runtime environment.
* **Decision:** Use Drizzle ORM paired exclusively with a `node-postgres` (`pg`) connection pool. A single pool client is maintained across all environments, connecting to Neon PostgreSQL with connection pooling enabled.
* **Consequences:** Provides direct, explicit SQL control, zero runtime overhead, and reliable interactive transaction locking. Edge runtime database querying is intentionally avoided because HTTP-based database drivers cannot support stateful row-level locks across interactive transaction boundaries.
* **Alternatives Considered:** Prisma was evaluated as a valid alternative. Drizzle was selected for its minimal abstraction over native SQL and direct transaction isolation control.

---

## ADR 0003: Better Auth for Core Authentication and Granular RBAC

* **Status:** Accepted
* **Context:** Mercato requires customer authentication, merchant two-factor authentication (2FA), and granular role-based access control (`customer`, `staff`, `admin`, `owner`).
* **Decision:** Adopt Better Auth as the core authentication framework utilizing its Drizzle ORM adapter, two-factor authentication plugin, and role management plugin.
* **Consequences:** Eliminates external identity vendor lock-in, stores user credentials and session records directly in the Mercato database, and operates seamlessly within Server Actions and React Server Components.
* **Alternatives Considered:** NextAuth / Auth.js was rejected due to protracted beta release cycles on Next.js App Router. Third-party identity platforms (Clerk, Supabase Auth) were rejected to maintain self-contained database sovereignty.

---

## ADR 0004: Strategy Pattern for Regional and Global Payment Providers

* **Status:** Accepted
* **Context:** Mercato's primary launch market is Indonesia, necessitating Midtrans for local payment methods (QRIS, Bank Virtual Accounts, GoPay, ShopeePay), while also accommodating international credit card processing via Stripe.
* **Decision:** Establish an abstract `PaymentProvider` interface declaring standardized methods: `createPaymentSession()`, `verifyWebhook()`, `processRefund()`, and `getPaymentStatus()`. Midtrans and Stripe implement this interface as swappable adapters.
* **Consequences:** The checkout and order processing workflows depend strictly on the payment contract. Additional regional gateways (e.g. Xendit) can be integrated without modifying order orchestration logic.

---

## ADR 0005: Money Representation as Integer Minor Units with Currency Code

* **Status:** Accepted
* **Context:** Floating-point arithmetic creates rounding drift in cart totals, discount allocations, and tax calculations. The platform must support zero-decimal currencies (IDR) and two-decimal currencies (USD, EUR).
* **Decision:** Store and compute all monetary values as integer minor units paired with an ISO 4217 currency code (e.g. `{ amount: 150000, currency: "IDR" }` for Rp 150.000, and `{ amount: 2550, currency: "USD" }` for $25.50). Centralize all financial arithmetic, rounding, and proportional distribution in `src/lib/money/index.ts`.
* **Consequences:** Guarantees zero precision loss across checkout totals, payment gateways, and order line items. Prevents fractional-cent discrepancies.

---

## ADR 0006: Pessimistic Row-Level Locking for Inventory Reservation

* **Status:** Accepted
* **Context:** Concurrent customer checkouts during peak sales events can cause inventory overselling if stock checks and deductions are not strictly serialized.
* **Decision:** Enforce inventory reservations during checkout creation using PostgreSQL database transactions and row-level locks (`SELECT stock, reserved FROM inventory WHERE variant_id = $1 FOR UPDATE`). Temporary reservations are created with a 15-minute expiration time-to-live. Stock is permanently committed upon payment verification or returned to available stock if the reservation expires.
* **Consequences:** Guarantees stock integrity and prevents overselling under heavy concurrency. Requires interactive connection pooling and short transaction lifecycles.

---

## ADR 0007: Webhook-Driven Idempotent Order State Machine

* **Status:** Accepted
* **Context:** Payment notifications from external gateways are asynchronous, potentially delivered out of order, or retried multiple times. Order state must transition deterministically without double fulfillment.
* **Decision:** Implement an order state machine (`pending` -> `awaiting_payment` -> `paid` -> `processing` -> `shipped` -> `delivered`, with terminal paths `cancelled` and `refunded`). Gateway webhooks verify cryptographic signatures, record raw events in an `idempotency_keys` table inside a transaction, and apply transitions only when valid.
* **Consequences:** Prevents duplicate charges, double shipments, and invalid status reversals. Ensures reliable webhook handling.

---

## ADR 0008: Multi-Tenant Architecture Readiness via Store Identification

* **Status:** Accepted
* **Context:** While version 1 operates as a single store, the product vision is a multi-store platform similar to Shopify without necessitating a database redesign.
* **Decision:** Include a mandatory `store_id` foreign key on all tenant-owned entities (products, orders, customers, inventory, discounts, settings). All repository query methods enforce `storeId` filtering.
* **Consequences:** Prepares the system for multi-tenant SaaS capabilities from day one with negligible query overhead in single-store operation where `storeId` defaults to the primary store.

---

## ADR 0009: Unified Upstash Redis Client for Cache and Rate Limiting

* **Status:** Accepted
* **Context:** The platform requires caching, session coordination, and request rate limiting across all environments without managing local socket connections.
* **Decision:** Standardize on `@upstash/redis` and `@upstash/ratelimit` for all environments (development, test, and production).
* **Consequences:** Removes dual-client maintenance (no separate TCP ioredis setup), simplifies deployment, and provides reliable HTTP-based Redis communication with low connection overhead.

---

## ADR 0010: Biome as the Unified Linter and Formatter

* **Status:** Accepted
* **Context:** Code consistency, formatting, and linting must run quickly in both local development and CI pipelines without configuration sprawl between ESLint, Prettier, and multiple plugins.
* **Decision:** Adopt Biome (`@biomejs/biome`) as the unified tool for linting and formatting TypeScript, JSX, and JSON. Pre-commit enforcement is managed via Husky and `lint-staged`.
* **Consequences:** Achieves sub-25ms lint and format verification across the entire repository, simplifies configuration to a single `biome.json` file, and eliminates package dependency conflicts between disparate ESLint plugins.

---

## ADR 0011: TypeScript 7 Compatibility Verification and Strict Configuration

* **Status:** Accepted
* **Context:** TypeScript 7.0.2 is the latest major release. We must verify that Next.js 16, Turbopack, Biome, Vitest, and Drizzle operate without compiler incompatibilities or peer dependency breakage.
* **Decision:** Adopt TypeScript 7.0.2 with strict configuration (`strict: true`, `noUncheckedIndexedAccess: true`, `noEmit: true`). A minimal build and test cycle proved full compatibility across Next.js 16.4.3, Vitest 5.0.5, and Drizzle Kit 0.31.11.
* **Consequences:** Provides maximum type safety across server-client boundaries, ensures no undefined property access escapes indexing checks, and benefits from current compiler optimizations.

---

## ADR 0012: Next.js 16 Proxy Architecture over Deprecated Middleware

* **Status:** Accepted
* **Context:** Next.js 16 officially renames and transitions `middleware.ts` to `src/proxy.ts` to reflect network boundary proxying and prevent confusion with Express-style middleware pipelines.
* **Decision:** Implement `src/proxy.ts` as the primary request interception layer, integrating `next-intl` routing and future edge redirects.
* **Consequences:** Adheres directly to the official Next.js 16 specification, avoids deprecated middleware naming, and cleanly separates network proxying from server action guards.

---

## ADR 0013: Next.js 16 Dynamic Segment Configuration and Partial Prerendering Boundaries

* **Status:** Accepted
* **Context:** In Next.js 16 with `cacheComponents: true` and `partialPrefetching: true`, route segment rendering must cleanly distinguish between static shells, on-demand edge streaming, and fully dynamic merchant routes.
* **Decision:** Merchant dashboard routes and mutating API endpoints declare standard Next.js `export const dynamic = "force-dynamic"` to opt out of static prerendering. Storefront product and collection pages leverage Partial Prerendering (PPR), rendering static shell components while wrapping runtime dynamic customer state (e.g. cart badge, live stock, purchase buttons) within Suspense boundaries.
* **Consequences:** Eliminates build-time static generation errors for authenticated routes, adheres strictly to documented Next.js 16 App Router conventions, and ensures that merchant and customer personalized data is never served stale from edge caches.

---

## ADR 0014: Dual-Branch Database Architecture and Strict Test Database Guard

* **Status:** Accepted
* **Context:** Running integration tests or migrations against the primary development database poses severe risks of accidental schema modification, data truncation, or cross-tenant contamination.
* **Decision:** Enforce two separate connection strings: `DATABASE_URL` (development Neon branch) and `TEST_DATABASE_URL` (dedicated test Neon branch or GitHub Actions service container). Vitest test setup and Drizzle test config compare the parsed host and database paths, strictly refusing to execute if both targets match.
* **Consequences:** Completely shields development and production data from destructive test suites and seed operations, provides deterministic test isolation, and requires zero secret exposure in CI pipelines.

---

## ADR 0015: Storage Abstraction with S3/R2 and Local Filesystem Fallback

* **Status:** Accepted
* **Context:** Image assets must be uploaded securely, validated for authenticity, and stored with high availability without coupling the application strictly to a single cloud vendor during local development.
* **Decision:** Implement a `StorageService` interface with two adapters: `S3StorageService` (supporting Cloudflare R2 and AWS S3 via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`) and `LocalStorageService` (persisting to `public/uploads/` when S3 credentials are unset). Server-side magic-byte inspection inspects the first 12 bytes of file payloads to verify true JPEG, PNG, or WebP signatures regardless of client file extensions.
* **Consequences:** Eliminates external cloud dependencies for local developers and offline testing, provides direct client-to-storage presigned upload scalability in production, and prevents malicious file upload vulnerabilities.

---

## ADR 0016: Hybrid Search with PostgreSQL tsvector and pg_trgm Trigram Fuzzy Matching

* **Status:** Accepted
* **Context:** Storefront customer search requires instant, relevant results supporting both exact phrase matching and typo-tolerant search across Indonesian and English product titles and descriptions without operating an expensive external Elasticsearch or Meilisearch cluster.
* **Decision:** Implement `PostgresSearchService` utilizing native PostgreSQL full-text search (`to_tsvector` and `ts_rank` with GIN indexing) combined with the `pg_trgm` extension for trigram similarity matching. A weighted ranking formula prioritizes title matches over description matches and falls back to trigram similarity when word-stem queries yield sparse hits.
* **Consequences:** Eliminates third-party search service operational overhead and synchronization lag, delivers sub-10ms search queries directly from PostgreSQL, and natively tolerates typos and partial prefixes in autocomplete queries.

---

## ADR 0017: Cartesian Variant Matrix Generation and Tag-Based Cache Revalidation

* **Status:** Accepted
* **Context:** Shopify-style product option sets (e.g., Size x Color) require deterministic, collision-free SKU generation and automatic inventory variant matrix calculation, while catalog browses must maintain high edge cache efficiency.
* **Decision:** Implement a deterministic Cartesian product generator creating variant rows with unique compound abbreviations and fallback sequence counters. Catalog queries utilize Next.js 16 tag-based cache tags (`products`, `product:[slug]`, `categories`, `collections`), selectively purged via `revalidateTag` in merchant mutating Server Actions.
* **Consequences:** Merchant product forms automatically generate variant combinations with zero missing permutations, edge and ISR caches remain fresh immediately upon merchant updates, and read load on the database remains minimal.
