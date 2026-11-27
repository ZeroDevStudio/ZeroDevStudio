# Start here — ZeroDev Studio v1.1

## Safe local preview

1. Extract `ZeroDevStudio-v1.1.zip`.
2. Open the inner `ZeroDevStudio` folder in VS Code.
3. Open `js/backend-config.js` and leave `mode: 'demo'`. Keep both Supabase values empty for the visual preview.
4. Run the root `index.html` using VS Code Live Server.
5. Explore the public page, budget samples, Support Center, account views, project form, client portal, and staff portal.

In demo mode, all account and project actions are intentionally disabled. No real emails or project/customer records are sent or saved.

## Before testing real backend behavior

Read `docs/V1_1_SETUP.md` fully. The adult project owner must supervise the Supabase development project, migration review, SMTP sender, optional Resend worker, GitHub Actions secrets, staff enrollment, and legal review. Keep production untouched while testing.

## Suggested development test sequence

1. Use two adult-supervised test inboxes to register and verify Client A and Client B.
2. Test resend cooldown, wrong/expired OTP, sign-in, recovery, password update, and email change.
3. Create one project as Client A, save/load/delete a draft, then submit a ticket with test attachments.
4. Confirm Client B cannot read Client A's ticket, draft, messages, attachments, or notifications.
5. Use an owner/manager test account to assign the ticket and send a reply plus an internal note.
6. Confirm the client sees public replies but never sees internal notes; test developer/designer access on assigned tickets only.
7. Test search/filter, timeline, unread indicators, notification preferences, and email queue with a provider test domain.
8. Change country/currency preferences and check that the quoted/requested currency is not altered by display conversion.

Do not test with real customer information or real payments. Adult supervision is required for provider accounts, customer contact, agreements, and any payment arrangements.
