# ZeroDev Studio v1.1 — email delivery setup

There are two separate email systems:

1. **Supabase Auth email** for signup verification, password recovery, and email-change confirmation.
2. **Optional transactional project updates** through the private `send-notification-emails` Edge Function and Resend. These are controlled by per-account opt-in preferences and are disabled by default.

The full adult-supervised setup is in [`V1_1_SETUP.md`](V1_1_SETUP.md). Do not enable live sending until the sender/domain and backend have been reviewed.

## Authentication email

Use Supabase → Authentication → Email Templates → Confirm signup and paste `supabase/templates/confirm-signup.html`, preserving `{{ .Token }}`. Enable email confirmations and set the exact development Site URL and redirect allow-list. Custom SMTP must be configured inside Supabase/provider settings; never paste SMTP credentials into this project.

Supabase's built-in trial sender is restricted to pre-authorized team addresses and currently has a limit of two messages per hour. Use a verified custom SMTP sender before sending to normal test inboxes. The current provider limit may change, so check the live Supabase dashboard and official documentation before testing.

## Transactional project emails

The migration creates a private outbox. A user must opt in under their client workspace profile, and the worker checks the current preference and verified recipient before sending. Jobs are claimed atomically, retried up to five times, and skipped if the account disables notifications before delivery.

The Edge Function expects these Supabase secrets:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NOTIFICATION_WORKER_SECRET`

Supabase provides `SUPABASE_URL` and service-role runtime credentials to the function. Do not store them in source code, the website, GitHub Actions YAML, or chat. The optional GitHub Actions scheduler needs only `SUPABASE_NOTIFICATION_FUNCTION_URL` and `NOTIFICATION_WORKER_SECRET` as repository secrets. See `docs/V1_1_SETUP.md` for exact configuration.

## Official references

- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [ExchangeRate-API terms](https://www.exchangerate-api.com/terms)
