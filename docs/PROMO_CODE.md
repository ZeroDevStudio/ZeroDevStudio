# NEW26 one-time discount — v0.7

## Offer presentation
- Code: `NEW26`.
- Discount: 10% off one eligible project development fee / quotation.
- Redemption limit: once per verified registered account.
- The public starting price is $20 USD (approximately ₱1,275). After an account has redeemed the offer, the pricing card displays $18 USD (approximately ₱1,148), with the original amount crossed out and a 10% OFF label.
- PHP amounts are rounded indicative estimates. Final quotations and conversion/payment rates may differ.
- A real project quotation should show the original eligible project fee, the NEW26 discount amount, and the final project fee. Any excluded third-party charges must be listed separately before approval.
- The offer is not cash, cannot be transferred, and is not intended to be combined with another promotion.

## Code discovery
The same small “Studio easter egg: NEW26” appears on all current page experiences: public website, account access, and client portal. Each page has the shared code-entry ribbon at the top. The redeemed state is shared across pages on the same site.

## Front-end behavior
`js/promo.js` handles the ribbon, status messages, and the pricing-card presentation.
- In `mode: 'demo'`, entering the code stores a local preview state in this browser only. This is intentionally not described as a real user/account redemption and can be cleared by clearing site data.
- In `mode: 'live'`, redemption requires a signed-in account and calls the Supabase RPC `redeem_promo_code`. Page load calls `get_my_promo_status` to restore the account's existing discount.
- The frontend does not decide the live discount amount. It renders the percentage returned by the database.

## Backend enforcement
Apply `supabase/migrations/20261126010000_promo_code_redemptions.sql` to a separate test Supabase project after a parent/guardian project owner has reviewed it.
- The database stores a SHA-256 hash of the code rather than making the promo table readable to browser users.
- `promo_redemptions` has a unique constraint on `(promo_code_id, user_id)`, which prevents the same account from redeeming the same offer twice, including simultaneous requests.
- Promo tables have RLS enabled and no direct `anon` or `authenticated` table grants.
- `redeem_promo_code` and `get_my_promo_status` are SECURITY DEFINER functions with a fixed empty search path, and are executable only by authenticated users. The redemption function additionally checks `auth.users.email_confirmed_at` so unverified accounts cannot redeem.
- No service-role key or email-provider secret belongs in browser code.

## Current limitations
- The project defaults to demo mode. No real account redemption is active until a test Supabase project is configured and this migration is applied.
- One redemption per verified account is the production rule; demo mode can only remember one preview per browser profile and is not secure.
- The site does not yet have a complete quotation/payment system, so the production workflow must apply the discount to the agreed eligible project fee when v0.7+ quotation handling is built.
- Actual business transactions, customer agreements, and payment accounts need parent/guardian oversight while the project owner is a minor.
