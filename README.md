# Little Date — Vercel + Supabase + Lemon Squeezy

A React/Vite invitation creator with custom and surprise date flows, five themes, creator preview, $1 hosted checkout, and invitation links that expire 7 days after payment confirmation.

## Local development

1. Install Node.js 20 LTS or newer.
2. Open this project folder in VS Code and run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public/anon key only).
4. Run `npm run dev`.

Payment checkout and public invitations require a configured Supabase project. There is intentionally no localStorage-based publishing or unpaid-link fallback.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor. If this project already has data, back it up and review the schema migration before running it. The schema removes broad anonymous insert/update policies; existing unpaid prototype rows will not become public.
3. Install the Supabase CLI, log in, and link the project:
   `supabase login`
   `supabase link --project-ref YOUR_PROJECT_REF`
4. Set Edge Function secrets (never put these in Vercel frontend variables):
   ```sh
   supabase secrets set SITE_URL=https://YOUR-VERCEL-DOMAIN.vercel.app
   supabase secrets set LEMONSQUEEZY_API_KEY=YOUR_API_KEY
   supabase secrets set LEMONSQUEEZY_STORE_ID=YOUR_STORE_ID
   supabase secrets set LEMONSQUEEZY_VARIANT_ID=YOUR_VARIANT_ID
   supabase secrets set LEMONSQUEEZY_TEST_MODE=true
   supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_WEBHOOK_SIGNING_SECRET
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```
   `SITE_URL` must be the canonical public Vercel URL. For another production domain, update this secret and redeploy the function.
5. Deploy both functions:
   ```sh
   supabase functions deploy create-checkout --no-verify-jwt
   supabase functions deploy lemon-squeezy-webhook --no-verify-jwt
   ```
6. In Lemon Squeezy, create a one-time product/variant priced at USD $1.00, complete store activation/identity verification, and copy its store and variant IDs. Set the webhook URL to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/lemon-squeezy-webhook`, choose the `order_created` event, and copy the signing secret to `LEMONSQUEEZY_WEBHOOK_SECRET`.
7. Test with the provider's test mode (`LEMONSQUEEZY_TEST_MODE=true`) and confirm that only a signed, paid `order_created` webhook publishes the invitation. Verify that a repeated webhook does not create duplicate invitation links.

## Vercel deployment

1. Push this folder to a GitHub repository, or import the project folder into Vercel.
2. Set the Vercel project framework to **Vite** (usually detected automatically), build command `npm run build`, output directory `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel Project Settings → Environment Variables for Production (and Preview if desired). Do not add service-role keys, Lemon Squeezy API keys, or webhook secrets to Vercel.
4. Deploy. Vercel uses `vercel.json` to route invitation URLs back to the SPA.
5. Copy the deployed HTTPS URL into Supabase `SITE_URL`, then redeploy the `create-checkout` function if you changed the secret.

## Product behavior

- Users fill in either a custom or surprise invitation and preview it before checkout.
- Checkout is created server-side with the configured Lemon Squeezy variant; the browser cannot set the price.
- The invitation is written by the webhook only after a valid signature and a paid order are confirmed.
- The recipient can respond once. Surprise invitations allow date planning after Yes.
- Public reads are limited to paid invitations that have not expired. The expiry is set to 7 days after the payment timestamp.
- No button dodge is optional. Keep the decline option accessible and use the effect playfully, without pressure.

## Before accepting real customers

This repository prepares the application code and deployment configuration; it cannot create or approve your external Supabase/Lemon Squeezy accounts. Complete the provider setup above and test a complete purchase on the deployed URL. Add and publish your own contact, privacy, refund, and terms pages, confirm applicable tax/refund requirements, and test accessibility, abuse handling, deletion, mobile layout, and webhook retry behavior before live sales. A successful Vite build alone is not proof of payment-system readiness.
