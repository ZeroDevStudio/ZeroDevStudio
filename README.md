# ZeroDev Studio — v1.0 First Release

A lightweight website and client-project platform built with vanilla HTML, CSS, and JavaScript, with an optional Supabase backend. There is no build step or Node.js requirement for the static front end.

## Open the project

1. Open this `ZeroDevStudio` folder in VS Code.
2. Keep `js/backend-config.js` in `mode: 'demo'` for the first local preview.
3. Run the root `index.html` with VS Code Live Server.
4. Explore the public website, three budget demos, support center, account pages, project intake page, client workspace, and staff workspace.

Demo mode deliberately does not create accounts, send OTP email, submit tickets, store messages, or upload files. The client and staff workspace show setup notices rather than fake client records.

## v1.0 feature set

- **Public site:** responsive studio website, concept portfolio, starter/entry/premium budget examples, pricing and payment notice, FAQ, NEW26 discount visuals, dark/light/system mode, smooth scrolling and reduced-motion support.
- **Accounts:** Supabase email/password registration, email OTP verification, sign-in, password recovery, and sign-out when a configured live backend is enabled.
- **Project intake:** secure, verified-account ticket creation with project title, service, budget range/currency, deadline, description, and optional private PDF/JPG/PNG/WEBP attachments (5 files, 8 MiB maximum each).
- **Client workspace:** own-ticket list, status, quotation view, client-visible message thread, private attachment links, profile details, and in-app notifications.
- **Staff workspace:** protected by `staff_members`; ticket review, status/quotation updates for permitted roles, client-visible replies, staff-only internal notes, and staff notifications.
- **Database:** ticket references, row-level security, staff-role helpers, ticket activity, automatic in-app notifications, private storage, and one-ticket NEW26 attachment function.
- **Support:** searchable ZeroDev Support knowledge base. It is not a live agent chat.

## Important limits

- The package ships in `demo` mode. Live operation requires an adult-supervised Supabase project, custom SMTP, reviewed database migrations, real staff membership enrollment, and an HTTPS deployment. See `docs/V1_RELEASE_SETUP.md`.
- Guest ticket submissions/guest access links are not enabled. Clients need a verified account in v1.0.
- In-app notifications are active only when connected to Supabase. Ticket email alerts and browser push are not enabled.
- Payments are manual and outside the platform. GCash is the only currently accepted method; PayPal is coming soon. Do not collect payment credentials, MPINs, OTPs, or PINs.
- Do not put Supabase service-role keys, database passwords, SMTP credentials, or mail-provider secrets in browser code.
- Staff membership cannot be self-created or edited from the site. The owner adds verified staff accounts manually using the documented SQL step.

## Key paths

```text
ZeroDevStudio/
├── index.html
├── account/index.html
├── projects/new.html
├── portal/index.html
├── staff/index.html
├── support/index.html
├── legal/{terms,privacy}.html  # Drafts requiring adult/legal review
├── samples/{starter,entry,premium}/index.html
├── assets/
├── css/                  # Public, theme, auth, portal, support, app styling
├── js/                   # Auth, promo, shared client, tickets, portal and staff logic
├── supabase/
│   ├── migrations/
│   └── templates/confirm-signup.html
└── docs/
    ├── V1_RELEASE_SETUP.md
    ├── V1_RELEASE_NOTES.md
    └── earlier design/setup documents
```

## Database migration order

1. `20261126000000_profiles.sql`
2. `20261126010000_promo_code_redemptions.sql`
3. `20261126020000_v10_ticket_system.sql`

Apply only in a separate development project after the adult owner reviews the SQL and the access policies. Detailed setup and the two-account role-testing checklist are in `docs/V1_RELEASE_SETUP.md`.

**ZeroDev Studio — Started with zero. Built with purpose.**
