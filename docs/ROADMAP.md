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
- [x] Storefront customer catalog browser, search autocomplete with Upstash rate limiting, and Partial Prerendered PDP
- [x] Realistic 24-product catalog seed across 6 Indonesian commerce categories
- [ ] Admin bulk actions (status toggle, inventory sync, CSV export/import) [Deferred to Phase 5 operations]

## Phase 3: Cart, Inventory, and Checkout [UPCOMING]
- Server-persisted guest carts merged upon user authentication
- 15-minute stock reservation with row-level locks (SELECT FOR UPDATE)
- Indonesian administrative hierarchy address selector (Province, City, District)
- Real-time shipping rate calculation (Flat rate and RajaOngkir courier integration)
- Flexible coupon and discount engine with usage caps and minimum spend rules

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
