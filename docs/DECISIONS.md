# Architecture Decision Records (ADR)

This document records the architectural and engineering decisions made for the Mercato commerce platform.

---

## ADR 0001: Modular Monolith inside Next.js App Router

* **Status:** Accepted
* **Context:** Commerce systems feature tightly coupled domains including catalog, inventory, checkout, payments, and orders. Splitting into separate microservices introduces network latency, serialization overhead, and distributed transaction complexity that is unjustified for the system scale.
* **Decision:** Build Mercato as a modular monolith within a single repository and single Next.js application. Code is partitioned strictly by business domain in `src/modules/<domain>/` with dedicated schema, repository, service, and action layers. UI components never query database tables directly.
* **Consequences:** Ensures high developer velocity, cross-domain type safety, and atomic deployment while keeping clean domain boundaries that can be factored into standalone services in the future if required.
* **Compatibility Note:** TypeScript 7.0.2 was verified alongside Next.js 16.4.3, Turbopack, Biome 2.6.4, and Vitest 5.0.5 with full compatibility and zero peer dependency conflicts.

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

## ADR 0010: Next.js 16 Conventions, Proxy Architecture, and Biome Tooling

* **Status:** Accepted
* **Context:** Next.js 16 introduces refined conventions including `proxy.ts` replacing `middleware.ts`, native Cache Components (`cacheComponents: true` and `"use cache"`), and async page parameter resolution. Tooling must execute quickly across linting and formatting.
* **Decision:** Implement `src/proxy.ts` as the network interception layer integrating `next-intl` routing. Use Biome (`@biomejs/biome`) as the unified linter and formatter, and enforce TypeScript 7 with `strict: true` and `noUncheckedIndexedAccess`.
* **Consequences:** Eliminates legacy Next.js experimental flags, achieves sub-second lint and format execution, and ensures adherence to the current Next.js 16 App Router standard.
