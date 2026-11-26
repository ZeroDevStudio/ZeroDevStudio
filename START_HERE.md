# Start here — ZeroDev Studio v1.0

## Preview the release locally

1. Download `ZeroDevStudio-v1.0.zip` and extract it.
2. In VS Code, choose **File → Open Folder** and select the inner `ZeroDevStudio` folder.
3. Open `js/backend-config.js`. Leave `mode: 'demo'`; do not paste any private credentials into the project.
4. Install/use the VS Code **Live Server** extension and run the root `index.html`.
5. Explore the public website, budget demos, support center, account page, project request page, client workspace, and staff workspace.

In demo mode, account and project actions are intentionally disabled. This lets you inspect the UI without collecting or sending real information.

## To activate backend features

Read `docs/V1_RELEASE_SETUP.md` from beginning to end. It explains the supervised Supabase setup, migration order, SMTP configuration, safe owner/staff enrollment, and two-client role testing. The adult project owner must complete and review those steps before switching `mode` to `live`.

## Recommended first test

After the backend has been configured in a separate development project:

1. Create and verify two test client accounts.
2. Submit a project from Client A.
3. Confirm Client B cannot see it.
4. Add an owner staff account using the documented manual SQL step.
5. Reply to Client A and test an internal staff-only note.
6. Confirm Client A can see the reply but cannot see the internal note.
7. Test a developer role and verify it cannot alter ticket status or quotations.

Do not test with real customer data or real payment details. Parent/guardian supervision is required for provider accounts, real customer contact, contracts, and any payment arrangements.
