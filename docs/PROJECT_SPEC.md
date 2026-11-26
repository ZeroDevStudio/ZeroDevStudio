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
