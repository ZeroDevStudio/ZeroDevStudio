# Changelog

## v0.2 — Portfolio and responsive refinement

- Added three original CSS-built sample concepts: Daybreak Coffee, Creator Portfolio, and Form & Field.
- Added All, Business, and Personal filters with live result counts.
- Added concept detail dialogs with descriptions and feature lists.
- Added explicit copy that distinguishes sample concepts from completed client work.
- Refined portfolio layouts across desktop, tablet, and mobile breakpoints.
- Improved mobile navigation accessibility with Escape-to-close behavior and desktop resize reset.
- Updated README and footer version label.

## v0.1 — Public website foundation

- Responsive public homepage, services, pricing, payment notice, project process, FAQ, and project portal status dialog.

## v0.3 — Client portal interface preview and motion refinement

- Added a dedicated responsive client workspace at `portal/index.html`.
- Added Overview, My projects, Messages, Notifications, and Profile preview panels.
- Added interactive sidebar navigation, project shortcuts, sample activity, timeline, and conversation layout.
- Marked the entire workspace as a design preview using fictional sample content; no authentication or data submission is active.
- Added a Client portal shortcut to the public website navigation and updated its portal information dialog.
- Added smooth anchor scrolling and gentle scroll-reveal animations to the public website.
- Added reduced-motion behavior to avoid forcing animation on visitors who prefer less motion.
- Updated README and project version labels.


## v0.4 — authentication interface and appearance settings
- Added an account-access preview with Sign in, Create account, Guest access, and Password recovery views.
- Added clear prototype-only notices; form submissions do not transmit or save entered values.
- Added shared Light, Dark, and System theme choices to the public website, account page, and portal.
- System mode follows `prefers-color-scheme` and responds to changes while the page remains open.
- Theme preference persists across pages on the same origin through local browser storage.
- Added authentication security requirements and implementation boundaries in `docs/AUTHENTICATION_DESIGN.md`.

## v0.4 implementation boundary
No real authentication, email verification, guest-token issuance, password recovery, sessions, or authorization is connected. These require a secure authentication provider and server-side policies before production use.


## v0.5 — email verification interface
- Added a six-digit email-code verification step after the registration preview.
- Added masked destination email, numeric-only code entry, Verify email, Resend code, and Change email actions.
- Added honest preview messaging: no email is sent, no code is generated or validated, and no account is created.
- Added production design notes for backend/provider-driven code delivery, expiry, single-use validation, resend cooldowns, rate limits, and sender-domain setup.
- Updated site and portal version labels.

## v0.5 implementation boundary
The email verification flow is interface-only. Sending and verifying email codes requires a secure authentication backend and configured transactional email delivery.

## v0.6 — authentication integration foundation
- Added an optional Supabase Auth adapter for email/password registration and login, signup OTP verification, resend, password recovery, password update, and sign-out.
- Added `js/backend-config.js` with empty placeholders and demo mode enabled by default.
- Added a Supabase SQL migration for a minimal profile table, own-profile read policy, and Auth user profile trigger.
- Added setup documentation covering email confirmation, OTP template, custom SMTP, publishable keys, RLS, redirect allow-lists, and production checks.
- Added visible demo/setup status messages and an authenticated-state view.
- Kept guest access and the sample client portal disconnected. Signing in does not grant private workspace access.

## v0.6 implementation boundary
No live backend project, SMTP account, credentials, or production database has been provisioned. The shipped project remains in demo mode. Real users must not be invited until an adult/authorized owner completes setup and security/privacy review.


## v0.7 — NEW26 one-time promotion
- Added top-of-page promo-code input on the public website, account access page, and client portal.
- Added the discoverable NEW26 studio Easter egg to each page experience.
- Added a polished original-price / discounted-price presentation and an applied offer badge.
- Added cross-page promo state. Demo mode stores a preview in browser storage; live mode reads and redeems through authenticated Supabase RPCs.
- Added a private promo schema, redemption table, user-specific status function, and unique per-account redemption constraint.
- Real account enforcement remains disabled while backend configuration is in demo mode.


## v0.8 — Budget-level sample websites

- Added three separate sample website demonstrations: Starter ($20 USD / approximately ₱1,275 PHP), Entry (₱5,000 PHP), and Premium (₱10,000+ PHP).
- Added a responsive budget comparison section to the public homepage with links to each standalone demo.
- Added NEW26 preview pricing states for all three illustrative tiers while preserving the one-redemption-per-account rule for one eligible project.
- Added clear scope and demo disclaimers; these examples are fictional portfolio concepts and do not represent guaranteed deliverables at fixed prices.


## v0.9 — automated account email and support center

- Added an original ZeroDev Support Center with custom logo, abstract banner, topic cards, searchable help articles, support-desk profile, and account-security guidance.
- Added support links to the public site, account page, and client portal.
- Added a branded Supabase Confirm signup HTML email template using `{{ .Token }}` for one-time code delivery.
- Improved live-mode signup/resend feedback and added a 60-second resend cooldown in the interface.
- Added clearer handling for SMTP delivery restrictions and rate-limit errors.
- Kept the backend in demo mode with empty project settings. Real delivery requires a supervised Supabase project, enabled email confirmation, and custom SMTP configuration.
- No SMTP credentials, service-role keys, or provider secrets are included in the project.
