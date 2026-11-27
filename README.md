# ZeroDev Studio — v1.1 Development Release

A lightweight studio website and client-project workspace built with vanilla HTML, CSS, and JavaScript, with an optional Supabase backend. The static site has no build step or Node.js requirement. The repository is intentionally shipped in **demo mode**.

## Preview locally

1. Open the inner `ZeroDevStudio` folder in VS Code.
2. Keep `js/backend-config.js` set to `mode: 'demo'` with empty URL/key values.
3. Run the root `index.html` with VS Code Live Server.
4. Explore the public site, sample pages, Support Center, account interface, project form, client workspace, and staff workspace.

Demo mode does not create accounts, send emails, save drafts, submit tickets, store messages, or upload files. It displays clear demo notices rather than fake customer records.

## v1.1 feature set

- **Authentication:** email/password signup, six-digit email verification, resend cooldown, verified-account sign-in, password recovery, password update, sign-out, and email-change confirmation workflow. Supabase remains the authority for identity and verification.
- **Country and currency:** approximate country detection using browser time zone/locale, manual country selection, display-currency override, saved browser preference, daily indicative FX conversions, and an untouched original budget/quotation currency.
- **Project intake:** verified-account ticket creation, supported budget currencies, server-side reference generation, up to five private PDF/JPEG/PNG/WEBP attachments (8 MiB each), previews, retry handling, and per-account saved drafts.
- **Client workspace:** own-ticket search/status filter, quotation display, message threads, unread-message counts, ticket timeline, private attachment links/image previews, in-app notifications, and opt-in email-notification preferences.
- **Staff workspace:** role-gated ticket queue, search/status filters, status/quote/assignment controls for management roles, active-team workload overview, client replies, management-only notes, staff notifications, and a ticket activity log.
- **Email delivery:** separate private Edge Function outbox worker for opted-in project notifications, atomic job claiming, retry handling, verified-recipient checks, and a GitHub Actions scheduler template. Account verification/recovery email uses Supabase Auth SMTP separately.
- **Security:** RLS remains the authority for all client/staff data access; no browser service-role, SMTP, Resend, or database secrets; email delivery is off by default.

## What's not included

No guest ticket links, browser push notifications, payment gateway, automated GCash collection, PayPal, automatic quote acceptance, e-signatures, or public self-service staff enrollment. Payments remain outside the app and require adult-supervised business arrangements. The help pages are not live human chat.

## Migration order

For a **new development Supabase project**, apply in order:

1. `supabase/migrations/20261126000000_profiles.sql`
2. `supabase/migrations/20261126010000_promo_code_redemptions.sql`
3. `supabase/migrations/20261126020000_v10_ticket_system.sql`
4. `supabase/migrations/20261127000000_v11_workspace_features.sql`

For the existing development project where the first three migrations are already applied, review and apply **only migration 4**. Never apply this package to production without a separate adult-led review, backup, and test plan.

## Important setup boundary

The ZIP is a development source package, not a production service. Actual use requires a parent/guardian or authorized adult to own and supervise the Supabase and email-provider accounts, review the migration and policies, configure Auth SMTP and the optional Resend notification worker, enroll staff, complete legal/privacy review, test with test accounts, and approve any live deployment. See `docs/V1_1_SETUP.md`.

## Key files

```text
ZeroDevStudio/
├── index.html
├── account/index.html
├── projects/new.html
├── portal/index.html
├── staff/index.html
├── legal/                       # Draft legal notices; adult/legal review required
├── css/                         # Site, auth, portal, staff, and v1.1 styling
├── js/                          # Auth, locale/FX, ticket, portal, staff, promo logic
├── supabase/
│   ├── migrations/              # v0.6, v0.7, v1.0, and v1.1 SQL
│   ├── functions/send-notification-emails/
│   ├── templates/confirm-signup.html
│   └── config.toml
├── .github/workflows/           # Optional email queue scheduler
└── docs/                        # Setup, release notes, and QA status
```

**ZeroDev Studio — Started with zero. Built with purpose.**
