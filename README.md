# ZeroDev Studio — v0.4

A lightweight, responsive website and client-account experience prototype built with vanilla HTML, CSS, and JavaScript. No framework, build step, remote fonts, analytics, or third-party JavaScript dependencies are required.

## Run locally

1. Open this `ZeroDevStudio` folder in Visual Studio Code.
2. Open the root `index.html` with Live Server or in a browser.
3. Use **Sign in** in the public navigation to open the account access preview.
4. Use **Open the sample client workspace** to preview the v0.3 client dashboard.

## What's new in v0.4

- Added an account access page at `account/index.html`.
- Added sign-in, create-account, guest project access, and password recovery interface states.
- Added clearly identified demo-only form feedback. Forms do not transmit or store information.
- Added Light, Dark, and System appearance choices to the public website, account preview, and client workspace.
- System mode follows the device/browser `prefers-color-scheme` setting, including changes made while the page is open.
- Theme selection is saved in local browser storage and shared across pages on the same origin. If storage is unavailable, the page still applies the selected theme for the current visit.
- Added dark color treatments for the public website, account interface, and client portal.

## Theme behavior

- **System:** follows the device or browser appearance preference and updates automatically when the operating-system preference changes.
- **Light:** always uses the light appearance.
- **Dark:** always uses the dark appearance.

The selection is stored locally under `zerodev-theme`. Choosing System removes the fixed Light/Dark override and returns control to the device preference.

## Authentication scope and security boundary

The sign-in, account creation, guest access, and password recovery pages are interface prototypes only. No authentication is implemented. Form submissions are intercepted locally and display a preview message; no credentials or personal information are transmitted or stored. Do not enter real passwords or customer details.

Before real accounts are enabled, configure a secure authentication provider and server-side authorization. The planned implementation notes are in `docs/AUTHENTICATION_DESIGN.md`. Guest access must use email verification and high-entropy, expiring access tokens; a ticket reference alone must not grant access. Password reset should use the provider's secure, time-limited flow. Never store plaintext passwords or expose private service keys in browser JavaScript.

## Existing prototype limitations

The client workspace uses fictional sample data. Tickets, projects, private messaging, staff permissions, file attachments, email/browser notifications, and payments are not connected. The website does not accept or process payments. Do not publish the prototype as a live customer portal.

Real customer arrangements, payment accounts, and transactions require appropriate parent/guardian oversight.

## Folder structure

```text
ZeroDevStudio/
├── index.html
├── account/
│   └── index.html
├── assets/
│   ├── fonts/
│   ├── icons/
│   └── images/
├── css/
│   ├── auth.css
│   ├── portal.css
│   ├── style.css
│   └── theme.css
├── js/
│   ├── auth.js
│   ├── portal.js
│   ├── script.js
│   └── theme.js
├── portal/
│   └── index.html
├── staff/
└── docs/
    ├── AUTHENTICATION_DESIGN.md
    ├── CHANGELOG.md
    └── PROJECT_SPEC.md
```
