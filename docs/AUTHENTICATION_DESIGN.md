# ZeroDev Studio — Authentication design (v0.6)

## Provider and behavior

The selected authentication provider is Supabase Auth. The optional browser adapter uses `supabase-js` v2 and is loaded dynamically only when `js/backend-config.js` has `mode: 'live'` plus a valid project URL and publishable key.

The committed configuration is intentionally `mode: 'demo'` with empty values. In demo mode, forms are intercepted locally and do not transmit or store data.

## Supported configured flows

- **Sign up:** email and password plus full name metadata. The backend must have email confirmations enabled.
- **Email verification:** user enters the one-time code from the Supabase confirmation email. The frontend calls `verifyOtp` with the `email` type.
- **Resend:** calls the provider's signup-confirmation resend method.
- **Sign in:** email/password using provider-managed credentials.
- **Password recovery:** asks the provider to send a recovery email. The recovery session opens a new-password view and updates the password through Auth.
- **Sign out:** clears the provider session.

Guest access stays disabled. A ticket reference must never act as an access credential.

## Frontend configuration

`js/backend-config.js` may contain the Supabase project URL and publishable key. A publishable key is designed for browser use, but it does not make database access safe by itself. RLS and least-privilege grants are required.

Never place a secret key, `service_role` key, SMTP credential, database password, private access token, or email-provider API secret in a frontend file. The adapter must remain in demo mode until a project owner has configured and tested the backend and email sender.

## Database baseline

`supabase/migrations/20261126000000_profiles.sql` creates a minimal profile table linked to `auth.users`. RLS is enabled, and authenticated users can read only their own profile. Browser clients are not granted direct profile writes; a database trigger creates the profile from Auth user metadata.

No ticket, message, project, attachment, staff, or payment tables are created by this migration.

## Production requirements still outstanding

1. Adult/authorized owner supervises project and provider accounts.
2. Email confirmation enabled; OTP email template uses `{{ .Token }}`; code type and expiry tested.
3. Custom SMTP and sender-domain authentication configured by the owner.
4. Exact Site URL and redirect allow-list configured.
5. RLS policies and grants reviewed for every table before frontend access.
6. Terms, privacy notice, data retention, backups, and incident process reviewed.
7. Signup, verification, resend throttling, sign-in, sign-out, password reset, expired codes, invalid codes, and session behavior tested.
8. Portal route and data authorization implemented before private customer data is displayed.

## Important boundary

A successful Auth session is not proof that the client portal is secured. The portal remains sample data and has no ticket/project authorization. This release must not be marketed as a live customer portal.
