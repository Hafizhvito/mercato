# Mercato Product and Engineering Roadmap

This document outlines planned enhancements and deferred features across upcoming platform milestones.

---

## Phase 1: Data Model and Authentication [COMPLETED]
- [x] Drizzle ORM schema for users, sessions, accounts, and stores
- [x] Seed script with realistic Indonesian and international catalog datasets
- [x] Better Auth setup with email/password and Google OAuth
- [x] Customer and admin base layouts with role-based navigation guards
- [x] Automated test database branch migration pipeline and isolated integration test suite

## Phase 2: Catalog and Admin Product Management [COMPLETED]
- [x] Categories, collections, products, options, option values, and variants schema with pg_trgm and GIN search indexes
- [x] Cartesian product variant matrix generator with deterministic collision-free SKU generation
- [x] Storage abstraction interface with S3/R2 direct uploads, local filesystem fallback, and magic-byte MIME validation
- [x] Hybrid PostgreSQL search engine combining to_tsvector full-text search with pg_trgm trigram similarity
- [x] Admin product management (listing, faceted filter, search, creation, editing, image uploads, SEO configuration)
- [x] Admin bulk actions (publish, draft, archive, bulk delete)
- [x] Admin category and collection management with full CRUD
- [x] Storefront customer catalog browser, search autocomplete with Upstash rate limiting, and Partial Prerendered PDP
- [x] Storefront collection pages with faceted filtering, sorting, and pagination
- [x] Realistic 24-product catalog seed across 6 Indonesian commerce categories
- [x] SEO sitemap.xml, robots.txt, and 404 not-found handlers

## Phase 3: Cart, Inventory, and Checkout [COMPLETED]
- [x] Server-persisted guest carts with token cookies, merged upon user authentication, with real-time price revalidation and unpublished item pruning
- [x] 15-minute stock reservation with interactive PostgreSQL transactions and row-level locks (`SELECT ... FOR UPDATE`)
- [x] Idempotent background reservation sweeper via Inngest cron and lazy on-demand release during catalog/inventory queries
- [x] Indonesian administrative hierarchy address selector (Province, Regency/City, District, Postal Code) with open Kemendagri dataset (MIT)
- [x] Shipping rate calculation provider abstraction (`FlatRateShippingProvider` and extensible `RajaOngkirShippingProvider`)
- [x] Flexible discount engine with percentage, fixed amount, free shipping, minimum spend, expiry, and atomic usage caps
- [x] Explicit order state machine (`ORDER_TRANSITIONS`) with immutable audit log (`order_status_history`) and variant financial snapshotting
- [x] High-concurrency integration test suite verifying single-unit stock integrity under N parallel checkouts with zero overselling and tenant boundary isolation

## Phase 4: Payment Integrations
- Midtrans Snap and Core API adapter (QRIS, Virtual Accounts, e-wallets)
- Stripe adapter for international credit and debit cards
- Cryptographically verified, idempotent webhook ingestion
- Order confirmation emails via Resend with React Email templates
- Automated inventory restoration upon expired checkout sessions

## Phase 5: Operations and Merchant Dashboard
- Real-time order fulfillment pipeline with courier tracking numbers
- Customer management, lifetime value metrics, and purchase history
- Admin analytics dashboard (revenue, units sold, conversion rate, low stock alerts)
- Immutable merchant audit log recording administrative actions
- Merchant staff role management (staff, admin, owner)

## Phase 6: Performance, Accessibility, and Hardening
- WCAG 2.2 AA accessibility audit and keyboard navigation pass
- Image optimization pass with AVIF/WebP formats and responsive sizing
- End-to-end checkout and admin operations test suite via Playwright
- High-concurrency race condition test verifying single-unit stock integrity
- Sentry error monitoring and performance tracing integration

## Future Considerations (Post-v1)
- Multi-store merchant tenancy (Shopify-style multi-tenant SaaS)
- Meilisearch or Typesense external search engine adapter
- Biteship logistics API adapter for multi-courier booking and label generation
- Automated abandoned cart recovery email sequences
- Customer loyalty points and store credit wallet
