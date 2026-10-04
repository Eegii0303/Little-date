# Little Date launch audit

## Included in this update
- Replaced the $4.99 Stripe checkout scaffold with a Lemon Squeezy one-time checkout Edge Function.
- Changed the creator flow to preview first, then pay $1 to publish.
- Removed direct anonymous invitation inserts and updates from the frontend.
- Added a signed Lemon Squeezy `order_created` webhook that writes paid invitations with a 7-day expiry.
- Added restrictive RLS read policy and security-definer response RPCs.
- Added Vercel SPA rewrites and response security headers.
- Added setup and deployment instructions.

## External setup still required
- Supabase project, SQL migration, Edge Function secrets, and function deployment.
- Lemon Squeezy store approval, $1 variant, API key, and signed webhook configuration.
- Vercel project and public deployment.
- Published privacy, terms, refund, and contact information; live-mode end-to-end tests.

## Verification status
The code bundle is prepared for deployment configuration, but live payment cannot be verified without the user's provider credentials and deployed services. Run `npm install` and `npm run build`, then complete a test-mode order and verify invitation creation, one-time response, and expiration behavior before enabling live sales.
