# ZeroDev Studio — Authentication design (v0.4)

## Front-end screens

- **Sign in:** email and password fields, with a password-recovery shortcut.
- **Create account:** name, email, password, and future terms acknowledgement. Email verification will be required in production.
- **Guest access:** project reference plus the email address used for the request. A future service verifies email ownership and sends a private guest-access link. A reference number alone never grants access.
- **Password recovery:** requests a time-limited reset link through the authentication provider. Responses should avoid revealing whether an email address has an account.

## Appearance setting

A shared appearance preference is available across the public site, account preview, and client workspace:

- `system` follows the browser's `prefers-color-scheme` media query and listens for changes.
- `light` always uses the light theme.
- `dark` always uses the dark theme.

The preference is saved in `localStorage` using the key `zerodev-theme`. An early inline bootstrap resolves the effective theme before stylesheets render to reduce theme flash. The shared `js/theme.js` controller keeps the selector synchronized on each page.

## Production security requirements (not implemented in v0.4)

1. Use a maintained authentication provider (for example, Supabase Auth) and verify email addresses.
2. Enforce authorization in trusted server-side policies; never rely on hidden buttons or client-side route checks.
3. Store only provider-managed password hashes; never keep plaintext passwords.
4. Use secure, expiring, high-entropy guest access tokens. Store token hashes server-side, limit attempts, and support revocation.
5. Use generic recovery responses and short-lived, single-use password-reset tokens.
6. Apply rate limits, abuse prevention, session expiry, secure cookies where applicable, and audit logging.
7. Keep private API/service-role keys out of HTML, CSS, and browser JavaScript.
8. Collect only necessary personal data and publish a privacy notice before accepting real users.

## Prototype behavior

Forms call `preventDefault()` and display a clear preview notice. They do not submit, store, or transmit values. The displayed client portal remains a fictional sample workspace. No real authentication or authorization exists in this release.
