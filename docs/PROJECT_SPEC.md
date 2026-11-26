# ZeroDev Studio — approved v1.1 implementation notes

## Brand and presentation
- Brand: ZeroDev Studio
- Tagline: Started with zero. Built with purpose.
- Visual direction: minimal white, charcoal text, slate secondary text, blue accent
- Stack: vanilla HTML, CSS, JavaScript
- Priorities: responsive, accessible, lightweight, maintainable

## Pricing and payment wording
- Starting price: $20 USD
- Indicative PHP display: approximately ₱1,275 PHP (estimate; check before publishing)
- Final project quotation depends on the agreed project scope, pages, design complexity, features, content, and revisions.
- Clients may state a budget range. The studio reviews the scope and issues a quotation; the client's budget is not automatically the final price.
- Current payment method: GCash only.
- PayPal: coming soon; not available yet.
- Do not begin work until the quotation and terms are accepted and payment terms are communicated.
- Never request/store GCash MPINs, OTPs, passwords, or other confidential credentials.

## Current implementation boundary
v0.1 is a public website prototype only. No real ticket submission, authentication, staff dashboard, email, browser push, file upload, or payment processing is implemented. These features require a secure backend and appropriate privacy/security review.


## Version history update

- **v0.2:** Expanded the sample concept portfolio, added category filtering and concept detail dialogs, and refined responsive behavior and mobile navigation.

## v0.3 — client portal interface preview
- Separate client workspace at `portal/index.html`, styled by `css/portal.css` and controlled by `js/portal.js`.
- Preview panels: Overview, My projects, Messages, Notifications, and Profile.
- Sidebar navigation and dashboard shortcuts switch views locally; no account or backend service is contacted.
- All displayed client identity, project references, messages, notifications, and dates are fictional example content.
- A persistent design-preview notice explains that authentication, tickets, private messaging, and notifications are not connected.
- Public-site navigation includes a Client portal shortcut.
- Public-site in-page links use smooth scrolling; selected sections/cards reveal gently as they enter view.
- Both public site and portal honor `prefers-reduced-motion`.

## v0.3 implementation boundary
The portal interface is intentionally a non-secure front-end preview. It must not be used to collect real client information. Authentication, authorization, secure guest access, ticket storage, attachments, conversations, staff roles, and notification delivery require a properly configured backend and security review before any real deployment.


## v0.4 — account and appearance design
- Account UI preview provides sign-in, registration, guest project access, and password recovery views.
- The account forms are demonstration-only and do not store or transmit submitted values.
- Guest access production design requires verified email plus private, expiring access tokens; project references alone are insufficient.
- Theme options are Light, Dark, and System across public website, account preview, and client portal. System follows and reacts to browser/OS color-scheme preferences.
- Real authentication remains out of scope until a secure provider, server-side authorization, privacy handling, and recovery flows are configured.


## v0.5 — email verification experience
- Registration preview proceeds to an email-verification screen after browser-side form validation.
- Verification screen includes masked destination email, six-digit numeric code field, Verify email action, Resend code action, and Change email action.
- The prototype does not send email, generate/validate codes, create accounts, or transmit/store registration data.
- Production requires a trusted backend/authentication provider and transactional email configuration. Codes must be server-side, short-lived, single-use, attempt-limited, and protected by resend/rate limits.

## v0.5 implementation boundary
The email verification interface is a demonstration only. No actual email bot/provider or authentication backend is configured. Do not enter real personal information or passwords into the preview.

## v0.6 — authentication integration foundation

- Selected Supabase Auth for email/password authentication and email OTP confirmation.
- Added an opt-in adapter, defaulting to demo mode with no credentials configured.
- Added a minimal profile schema and owner-only read policy, plus setup documentation.
- Kept the sample portal, guest access, tickets, staff tools, and payments unconnected.

## v0.6 implementation boundary
The application is not production-ready. No hosted project or transactional email sender is configured. The frontend adapter alone does not secure the portal; database RLS and server-side authorization for future data features remain required.


## v0.7 — NEW26 one-time offer
- A consistent promo-code ribbon appears at the top of the public site, account access, and client portal.
- The code NEW26 is discoverable in a subtle Easter egg on each page experience.
- The offer is 10% off one eligible project quotation, redeemable once per verified registered account.
- Starting price display changes from $20 / approximately ₱1,275 to $18 / approximately ₱1,148 after valid redemption; original price is crossed out and the 10% badge is shown.
- The real one-time restriction is enforced in Supabase by a unique redemption row per promo/account. Browser storage is used only for the clearly-labelled demo preview.
- A future quotation document should display original eligible fee, discount amount, and final fee; do not represent the discounted starting price as a guaranteed price for every scope.
