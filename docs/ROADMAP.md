# Mercato Product and Engineering Roadmap

This document outlines planned enhancements and deferred features across upcoming platform milestones.

---

## Phase 1: Data Model and Authentication
- Drizzle ORM schema for users, sessions, accounts, and stores
- Seed script with realistic Indonesian and international catalog datasets
- Better Auth setup with email/password and Google OAuth
- Customer and admin base layouts with role-based navigation guards
- Automated test database branch migration pipeline

## Phase 2: Catalog and Admin Product Management
- Hierarchical categories and collections
- Multi-variant product modeling (options: size, color, material)
- Cloudflare R2 signed image uploads with drag-and-drop reordering
- PostgreSQL full-text search with pg_trgm fuzzy matching
- Admin bulk actions (status toggle, inventory sync, CSV export/import)

## Phase 3: Cart, Inventory, and Checkout
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
