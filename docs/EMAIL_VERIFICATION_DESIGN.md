# ZeroDev Studio — Email verification design (v0.6)

## Registration experience

1. Visitor enters their name, email address, password, and accepts the published account terms.
2. The authentication service creates a pending registration and initiates email verification.
3. A branded ZeroDev Studio email contains a six-digit one-time verification code.
4. The visitor enters the code on the verification screen.
5. The authentication service validates the code and marks the email as verified before enabling the account.
6. The visitor can request a new code, subject to server-side resend limits.

## Email content direction

- Sender display name: ZeroDev Studio
- Subject: Verify your email address
- Message: Explain that the code was requested during account registration, show the one-time code clearly, state its expiry time, and tell the recipient not to share it.
- Include a short note: if the recipient did not request the code, they can ignore the message.

## Production security requirements — not implemented

- Generate and validate codes through a trusted authentication provider or server-side service. Never generate, embed, email, or validate verification codes in browser JavaScript.
- Use a maintained authentication provider with email-confirmation support where possible.
- Proposed policy for product review: six numeric digits, a short expiry (for example, 10 minutes), one-time use, resend cooldown, and strict per-account/IP rate limits. Final settings must be configured and tested on the backend.
- Limit failed attempts and invalidate previous codes when a replacement is issued. Avoid revealing whether an email address already has an account.
- Use a verified sending domain and configure its email-authentication records before sending production mail.
- Keep provider service keys and SMTP credentials on the server only. Never put them in HTML, CSS, or browser JavaScript or commit them to the repository.
- Do not log verification codes or passwords. Minimize stored personal data and publish a privacy notice before enabling real registrations.
- Test delivery, expiry, replay prevention, resend limits, abuse protection, and account activation before launch.

## v0.5 prototype behavior

The registration screen transitions to a six-digit code-entry preview and masks the email address for display. The resend and verify actions display honest preview messages. No email is sent, no code is generated, no registration is stored, and no address is verified. The code field only limits input to six digits; it does not establish account security.

## Important distinction

The “email bot” is a transactional email notification from the backend/authentication provider, not a bot running in the visitor's browser or a personal email inbox. The production email sender must be configured and operated securely by an adult/authorized account owner.


## v0.6 integration status

The optional Supabase Auth adapter now calls the provider's sign-up, OTP verification, and resend methods when live mode is explicitly configured. `js/backend-config.js` remains in demo mode with blank settings in the distributed project. The owner must enable email confirmation, configure an OTP email template using `{{ .Token }}`, and test code length/expiry and resend limits. The frontend never generates or validates a code itself. See `SUPABASE_SETUP.md`.
