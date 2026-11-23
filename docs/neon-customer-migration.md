# Neon customer migration foundation

This branch prepares customer profile, order, and inquiry RPCs plus an isolated Neon Auth/Data API client. It does not connect the production storefront to Neon. The existing Neon administrator login and catalog code are unchanged. Supabase data and Storage are not touched.

## Why the two RPCs returned 404

The storefront calls `POST /rest/v1/rpc/hansol_submit_order` and `POST /rest/v1/rpc/hansol_submit_inquiry`. The repository had no SQL migrations defining either function, and the confirmed 404 responses mean the Neon Data API did not expose the requested RPCs. A PostgREST-style 404 can mean the function is absent or absent from its schema cache; without Neon database access, those two cases cannot be distinguished. The migration below defines both functions with the exact argument names the storefront sends.

## Files

- `sql/neon-customer-migration.sql`: additive profile/order/inquiry tables and RPCs. Order submission locks the catalog row, checks price and stock against the current Neon catalog, decrements stock atomically, and supports idempotent retry IDs.
- `neon-customer-api.mjs`: Neon Auth signup/sign-in and authenticated RPC client. It is intentionally not loaded by the live storefront yet.
- `backend-config.js`, `.env.example`, `scripts/generate-backend-config.mjs`: build-time `HANSOL_CUSTOMER_BACKEND=supabase|neon` selector. Selecting Neon makes the current Supabase customer API fail closed while integration is pending, so requests are not silently sent to the wrong database.

## Apply and verify on a Neon test branch

1. In Neon Console, create or select a **non-production branch** that has Neon Auth and the existing `public.hansol_catalog` table. Keep the current production branch unchanged.
2. Open that branch's SQL Editor and run `sql/neon-customer-migration.sql` as a database owner. The script only adds these new tables/functions and updates product stock during a test order; it does not drop tables or alter Supabase.
3. Confirm the Data API exposes `hansol_complete_signup`, `hansol_my_profile`, `hansol_submit_order`, and `hansol_submit_inquiry`. If it still returns a schema-cache 404 after applying, use the Neon Data API's schema refresh procedure, then retry.
4. Configure Neon Auth email/password signup, email verification, and the test branch's trusted origin before exercising signup. The SQL validates the `sub` and verified-email claims in the Neon Auth JWT; confirm the branch's JWT contains `email_verified=true` (or `emailVerified=true`).
5. Use an approved test customer and an inexpensive/throwaway catalog product on the test branch. Confirm signup/profile completion, login, duplicate order retry, stale price rejection, out-of-stock rejection, inquiry submission, and unauthenticated denial.
6. Only after those checks, finish wiring `neon-customer-api.mjs` into the customer flows and verify all existing member, order-management, inquiry-inbox, cart, and account-removal RPCs. This foundation intentionally does not migrate those additional RPCs.

## Environment selector

For local/build-time configuration, copy `.env.example` to the build environment and set `HANSOL_CUSTOMER_BACKEND=supabase` while Supabase remains the active customer provider. `node scripts/generate-backend-config.mjs` writes the public browser config. Do not set it to `neon` for production yet: this branch only provides the selector and customer Auth/order/inquiry foundation; the rest of the current storefront still expects Supabase customer RPCs.

## Backup status

No Supabase tables, Auth accounts, or Storage objects were exported in this task. The available environment had no Supabase project credentials or Storage access, and the Neon endpoint timed out from this execution environment. No delete, update, or migration was sent to Supabase or the production Neon database. Backups remain a separately authorized read-only export task once project-level access is available.
