# ZeroDev Studio — v0.9

A lightweight, responsive website and client-account prototype built with vanilla HTML, CSS, and JavaScript. No build step is required. Authentication remains in demo mode until a separate Supabase development project and email delivery are configured and reviewed.

## Run locally

1. Open this `ZeroDevStudio` folder in Visual Studio Code.
2. Run the root `index.html` with Live Server.
3. Select **Sign in** to open account access.
4. Keep `js/backend-config.js` in `mode: 'demo'` while previewing the UI. Account and project forms do not transmit registration or project details. The NEW26 promotion preview is saved in local browser storage only.

## Included from v0.6 — authentication foundation

- Added an optional Supabase Auth adapter using the `supabase-js` v2 client, loaded only when live mode is explicitly enabled and project settings are present.
- Added a browser-safe backend configuration file containing placeholders only; no private credentials are included.
- Added email/password sign-up, email OTP verification, sign-in, sign-out, resend confirmation, password-reset request, and recovery password update paths for a configured Supabase project.
- Added a minimal Supabase profile-table migration with row-level security and a user-creation trigger.
- Kept `mode: 'demo'` as the default. No real authentication or email is enabled in this packaged copy.
- Added explicit notices explaining setup state and the fact that the client workspace remains a prototype.

## Authentication and email setup

Read `docs/SUPABASE_SETUP.md` before changing any backend configuration. A parent/guardian or authorized adult must own and supervise the hosted backend, email provider, and real customer arrangements. Use a separate development project and test inboxes first.

Supabase's default email sender is for testing and has restrictions; the adult project owner must configure custom SMTP for reliable delivery. SMTP credentials and secret/service-role keys must never be placed in frontend files.

## Current limitations

- Client portal pages still show fictional sample data. Signing in does not grant access to a protected portal.
- Ticket creation, messages, project data, staff roles, guest-token access, browser notifications, file uploads, and payments are not implemented.
- Guest access remains a preview-only form.
- The project does not accept or process payments.
- Before real users are invited, publish and review account terms and a privacy notice, and test security policies and email delivery.

## Folder structure

```text
ZeroDevStudio/
├── index.html
├── account/index.html
├── assets/
├── css/
│   ├── budget-samples.css
│   └── promo.css
├── js/
│   ├── auth.js
│   ├── backend-config.js
│   ├── portal.js
│   ├── promo.js
│   ├── script.js
│   └── theme.js
├── portal/index.html
├── samples/
│   ├── starter/index.html
│   ├── entry/index.html
│   └── premium/index.html
├── staff/
├── supabase/
│   └── migrations/
│       ├── 20261126000000_profiles.sql
│       └── 20261126010000_promo_code_redemptions.sql
└── docs/
    ├── AUTHENTICATION_DESIGN.md
    ├── EMAIL_VERIFICATION_DESIGN.md
    ├── SUPABASE_SETUP.md
    ├── CHANGELOG.md
    ├── PRICING_EXAMPLES.md
    └── PROJECT_SPEC.md
```


## v0.7 — NEW26 promotion

- Added a shared discount-code ribbon to the public site, account page, and client portal.
- Added a subtle NEW26 discovery Easter egg to every page experience.
- Added a professional 10% discount price treatment: $20 / approx. ₱1,275 becomes $18 / approx. ₱1,148 after redemption.
- Added demo-mode local preview plus secure Supabase RPC/database migration for one redemption per verified account.
- Real account enforcement remains inactive until a test Supabase project is configured and the v0.7 migration is applied. See `docs/PROMO_CODE.md`.


## v0.8 — three budget-level website demonstrations

- Added three original, standalone sample websites under `samples/`.
- Starter demo: $20 USD (approximately ₱1,275 PHP), showing a focused single-page concept.
- Entry-level demo: ₱5,000 PHP, showing a more developed small-business site with distinct content areas.
- Higher-scope demo: ₱10,000+ PHP, showing a more immersive custom brand experience.
- Added a new public-site section comparing the three example budgets and linking to each live local demo.
- Extended the NEW26 preview so the public-site budget cards show the relevant 10%-discounted example price after the code is applied. The code remains limited to one eligible project; the three displayed discounted totals are comparisons, not three separate redemptions.
- Clearly labelled all sample brands and websites as fictional concepts. Prices are illustrative budgets, not fixed promises or guaranteed scopes.
- No live forms, booking, accounts, or payment processing were added to the demos.


## v0.9 — automated verification email and support center

- Added the ZeroDev Support Center at `support/index.html` with an original brand mark, banner, support-desk profile, topic search, and account/project/pricing help articles.
- Linked the support center from the public site, account screen, and client workspace.
- Added a branded Supabase Confirm signup HTML template at `supabase/templates/confirm-signup.html`. The template uses `{{ .Token }}`; Supabase Auth generates and validates the code.
- Improved verification email status messaging and added a client-side 60-second resend cooldown. Supabase server-side rate limits remain authoritative.
- Added `docs/EMAIL_DELIVERY_SETUP.md` and `docs/SUPPORT_CENTER.md`.
- The project remains in demo mode. Actual email delivery requires an adult-supervised Supabase development project, email confirmations enabled, the branded template installed, and a custom SMTP provider configured in Supabase.
- SMTP credentials, provider API keys, and service-role secrets must never be placed in frontend files.

## Run the Support Center

Open `support/index.html` with Live Server. The help-topic search works locally. Ticket handling and live human support are not active in this prototype.
