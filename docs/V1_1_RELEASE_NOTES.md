# ZeroDev Studio v1.1 — Development release notes

## Scope

v1.1 builds on the v1.0 account, ticket, messaging, staff, attachment, and NEW26 systems. It focuses on account lifecycle completeness, country/currency presentation, saved intake drafts, portal usability, staff workload, and optional transactional email updates.

## Delivered in the source package

1. Polished signup and verification experience with a six-digit OTP screen.
2. Resend cooldown feedback plus handling for provider rate limits.
3. Persistent Supabase Auth sessions using PKCE and token refresh.
4. Password recovery email flow.
5. Password update with a 12-character front-end minimum and session check.
6. Email-change request flow that waits for Supabase confirmation.
7. Browser country approximation from time zone and locale (no precise GPS request).
8. Manual country override.
9. Country-default display currency.
10. Indicative currency conversion with provider update timestamp.
11. Country/currency selection persisted in the browser.
12. RLS-protected server-side project drafts; draft attachments are not saved.
13. Client/staff ticket search and status filtering.
14. Ticket activity timeline.
15. Attachment preview, retry, per-file limits, and signed private links.
16. Unread new-message indicators.
17. Per-account email notification preferences; opt-in default is off.
18. Optional queued email notifications through a private Edge Function worker.
19. Active staff workload and assignment controls for management roles.
20. Role-filtered ticket activity log, alongside status/quote/assignment event recording. A full authentication/security-event audit console is not included.

## Compatibility and safety

- The front end remains plain HTML/CSS/JS; no build step is required.
- Supabase JS is pinned consistently to `2.119.2` in the browser modules and Edge Function.
- `js/backend-config.js` remains in demo mode and has empty backend values.
- Browser code contains no service-role key, SMTP password, Resend key, or database password.
- The v1.1 migration adds private tables and email queue infrastructure, expands budget/quote currency allow-lists, tightens ticket/staff/message/attachment/event row policies, refines private Storage paths, and updates ticket message/status/assignment notification triggers. Review it before applying to a development database.
- Legal pages remain drafts and need adult/qualified review.

## Not a production certification

The code package cannot configure a provider account, authenticate a real sender domain, activate GitHub repository secrets, deploy a Supabase Edge Function, or conduct two-account authorization tests. The release is **implementation-complete for its included source features but not production-activated or certified** until the setup and QA checklist is completed by the responsible adult project owner.
