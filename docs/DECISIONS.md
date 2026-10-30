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

## ADR 0013: Next.js 16 Cache Components and Elimination of Route-Level Dynamic Config

* **Status:** Accepted
* **Context:** In Next.js 16 with `cacheComponents: true` and `partialPrefetching: true`, legacy route segment config `export const dynamic = "force-dynamic"` is explicitly rejected by the Turbopack compiler (`Route segment config "dynamic" is not compatible with nextConfig.cacheComponents. Please remove it.`).
* **Decision:** Completely eliminate route-level `export const dynamic` and experimental `export const instant` segment flags. Dynamic execution is achieved at the component level by consuming runtime APIs (`await headers()`, `await cookies()`, `await searchParams`) within Suspense boundaries, enabling Partial Prerendering (PPR) shells with dynamic server-streamed slots.
* **Consequences:** Conforms to the official Next.js 16 Cache Components architecture, eliminates Turbopack build errors, enables granular component-level streaming, and ensures merchant and personalized data is never served stale.

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

---

## ADR 0018: Inventory Reservation Strategy with Row-Level Locking and Idempotent Sweeping

* **Status:** Accepted
* **Context:** High-demand checkouts (flash sales, limited drops) risk overselling if inventory checks rely on optimistic concurrency or unreserved cart states. Deducting stock permanently upon adding to cart causes artificial stock depletion by abandoned carts, while deferring checks until payment gateway webhooks creates customer payment friction when stock runs out mid-payment.
* **Decision:** Implement a two-phase inventory reservation pattern with 15-minute TTL. Stock is reserved inside interactive PostgreSQL transactions using `SELECT ... FOR UPDATE` row locks on the `inventory_items` table. A reservation record is written to `stock_reservations`. When payment succeeds, reservations are committed to permanent reductions. When an order is cancelled or times out, reservations are released. To guarantee eventual consistency under crash or abandonment, an idempotent Inngest cron job sweeps expired reservations every 5 minutes (`inventory-sweeper`), complemented by lazy on-demand release during catalog/inventory read operations.
* **Consequences:** Eliminates overselling under arbitrary concurrency (verified via parallel tests), prevents abandoned carts from holding inventory indefinitely, and avoids distributed lock overhead in Redis.

---

## ADR 0019: Explicit Order State Machine and Immutable Financial Snapshots

* **Status:** Accepted
* **Context:** E-commerce order lifecycles involve complex state transitions (`pending`, `awaiting_payment`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`) across customer actions, merchant fulfillment, and payment gateway webhooks. Direct manipulation of product prices or merchant edits after checkout could alter historical order totals, corrupting accounting and tax reporting.
* **Decision:** Implement a strictly typed state machine (`ORDER_TRANSITIONS`) that validates every status change, rejecting illegal jumps (e.g., transitioning `delivered` directly to `pending` or `paid` without refund). Every state transition logs an immutable entry to `order_status_history` with actor type (`system`, `customer`, `admin`), timestamp, and reason. At checkout creation, complete variant snapshots (title, SKU, options, and unit prices in integer minor units) are serialized directly into `order_items`, insulating historical orders from subsequent catalog price or description mutations.
* **Consequences:** Guarantees strict financial auditability, prevents invalid order lifecycle states, and protects historical order integrity against downstream catalog edits.

---

## ADR 0020: Shipping Provider Abstraction and Hierarchical Kemendagri Open Dataset

* **Status:** Accepted
* **Context:** The Indonesian e-commerce market requires localized address hierarchy (Province -> Regency/City -> District -> Postal Code) and integration with domestic logistics providers (JNE, SiCepat, POS Indonesia). Coupling checkout directly to external courier APIs introduces external latency and downtime vulnerabilities during storefront checkout.
* **Decision:** Implement a `ShippingProvider` interface with a primary deterministic `FlatRateShippingProvider` (providing tiered Regular, Express, and Same-Day options with volumetric calculation) and an extensible `RajaOngkirShippingProvider` for live API integration. Address lookups utilize an in-memory hierarchical dataset sourced from the open Kemendagri administrative boundary registry (MIT licensed), enabling instant, zero-latency cascading dropdowns in the checkout UI without external network calls.
* **Consequences:** Checkout retains sub-50ms address validation and shipping calculation latency, operates reliably even during third-party courier API outages, and complies fully with commercial licensing requirements.

---

## ADR 0021: Hosted Stripe Checkout and Currency Handling Policy

* **Status:** Accepted (Updated)
* **Context:** Accepting credit and debit cards globally requires rigorous PCI-DSS compliance and 3D Secure 2.0 (SCA) authentication. Custom client-side card inputs drastically expand compliance scope to SAQ A-EP or SAQ D, requiring onerous external audits and sensitive tokenization handling. Furthermore, Stripe documentation ([Stripe Currencies](https://docs.stripe.com/currencies)) specifies minimum amounts (0.50 IDR) and maximum charges for other payment methods (up to 12 digits for IDR, 9,999,999,999.99 IDR), but Stripe merchant processing in Indonesia is subject to localized account eligibility.
* **Decision:** Implement card payments using hosted Stripe Checkout Sessions (`mode: 'payment'`), redirecting customers to Stripe-hosted portals with customized branding and redirecting back to Mercato return routes (`/checkout/success`, `/checkout/failed`). For standard global currencies (USD, EUR, SGD), amounts are handled in their standard minor units. For Indonesian Rupiah (IDR), Stripe processing is explicitly restricted/refused in code pending verified Indonesian merchant onboarding, and IDR transactions are routed exclusively through Midtrans. Webhooks verify cryptographic authenticity using HMAC SHA-256 via Stripe's official SDK with raw request bodies.
* **Consequences:** Reduces merchant PCI-DSS scope to the simplest SAQ A profile, delegates 3DS2 biometric authentication to Stripe, prevents untested IDR currency charge errors, and ensures bulletproof signature verification.

---

## ADR 0022: Midtrans Snap Integration and Late Payment Policy

* **Status:** Accepted (Updated)
* **Context:** The Indonesian commerce ecosystem relies heavily on QRIS, e-Wallets (GoPay, ShopeePay), and bank Virtual Accounts (BCA, Mandiri, BNI, BRI). Midtrans Snap provides an omnichannel redirect/modal solution. However, asynchronous payment rails (Virtual Accounts and convenience stores) frequently suffer from "late payments"—a customer transfers funds after the 15-minute checkout reservation TTL has expired and the order status has automatically transitioned to `cancelled`.
* **Decision:** Integrate Midtrans Snap via server-to-server transaction tokens and SHA-512 signature hashing (`SHA-512(order_id + status_code + gross_amount + server_key)`). Establish a deterministic late payment policy executed inside interactive database transactions:
  1. When a valid `settlement` webhook or status sync arrives for an order in `cancelled` status, the system checks whether inventory for all line items is still available.
  2. If stock is available: the system re-reserves and commits the inventory, revives the order status directly from `cancelled` to `paid`, and dispatches a payment confirmation email.
  3. If stock has been exhausted by another customer:
     - **Default Policy (Manual Review):** The system marks `paymentStatus = "needs_review"`, records an audit log (`order.late_payment_flagged_for_review`), appends to order status history, and neutrally notifies the customer that their payment was received but the order is on hold for merchant review. The gateway refund is **not** called automatically. A visible `Needs Review` badge and audit trail appear in the merchant admin order console (`/admin/orders`), allowing the merchant to choose between manual fulfillment or issuing a refund.
     - **Opt-in Automatic Refund:** Automatic provider refund is strictly guarded behind an explicit environment setting `AUTO_REFUND_ON_STOCK_EXHAUSTED=true` (off by default). When enabled, the system automatically triggers a refund call via `/v2/:order_id/refund`, records a `refunds` entry, and sets `paymentStatus = "refunded"`.
* **Consequences:** Protects merchant operational control and funds by preventing automated gateway fee loss on disputed or replenishable inventory, while maintaining complete auditability and neutral customer transparency.


---

## ADR 0023: Indonesian Administrative Region Dataset License, Statutory Origin, and Logistics Provider Mapping

* **Status:** Accepted
* **Context:** Mercato embeds a comprehensive regional administrative boundary dataset of the Republic of Indonesia (38 provinces, 514 regencies/cities, 7,265 districts) to power zero-latency cascading address lookups and localized shipping calculation during checkout. We must ensure commercial licensing compliance, document the statutory legal origin under Indonesian law, and formalize integration boundaries with third-party logistics APIs (such as RajaOngkir).
* **Decision:**
  1. **Dataset License & Aggregation:** Sourced via `cahyadsn/wilayah` (authored by Cahya DSN) under the permissive **MIT License** (Copyright (c) 2017-2025 Cahya DSN).
  2. **Statutory Baseline:** The dataset administrative boundaries, official names, and hierarchical numerical codes (e.g. `31` for DKI Jakarta, `31.71` for Jakarta Pusat, `31.71.01` for Gambir) conform to **Kepmendagri No. 300.2.2-2430 Tahun 2025** (and predecessor decrees 050-145/2022, 100.1.1-6117/2022, and Permendagri 72/2019) issued by the Ministry of Home Affairs of the Republic of Indonesia (Kementerian Dalam Negeri).
  3. **RajaOngkir Courier Mapping & Fallback:** RajaOngkir's API ([Komerce RajaOngkir API](https://komerceapi.readme.io/reference/rajaongkir-api)) uses proprietary sequential integer identifiers (`city_id` from 1 to 501), rather than Kemendagri codes. The Starter tier exists historically for legacy accounts, while modern integrations use Komerce API. When `RAJAONGKIR_API_KEY` is not configured, Mercato's shipping service gracefully falls back to the internal `FlatRateShippingProvider`, ensuring that lack of third-party courier credentials never impairs storefront customer checkout.
* **Note on Statutory Status (Not Legal Advice):** Under Indonesian Copyright Law (**Undang-Undang Republik Indonesia Nomor 28 Tahun 2014 tentang Hak Cipta, Pasal 42 huruf b**), legislative acts, state decrees, government regulations, and official public administrative designations are excluded from copyright and reside permanently in the public domain. This analysis is documented for architectural and open-source compliance context only and does not constitute formal legal advice.
* **Consequences:** Establishes unambiguous legal and licensing compliance for commercial operation, guarantees zero runtime coupling to external courier API availability during local development, and documents the relationship between Kemendagri public statutory data and third-party commercial APIs.
