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
