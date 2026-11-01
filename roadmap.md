# Security hardening

## WhatsApp update announcement
- [x] Correct reconciliation regressions: preserve unrelated-merchant rejection; recognize joined merchant names; all matching tests pass.
- [x] Move budget follow-up to successful approval in single, bulk and reconciliation flows; exact persisted record checks, registered-only totals and server-only duplicate prevention implemented and deployed. Live authenticated approval/send remains unverified.
- [ ] Validate audio and documents in an authenticated user flow; blocked if no supported test session exists.
- [x] Run release checks: all 162 tests pass and preview build is OK; deployed notification denies unauthenticated calls. Authenticated audio/document/pricing/approval flows remain unverified on external Supabase.
- [ ] Broadcast option 1 blocked: authenticated audio, documents and post-approval send remain unverified on external Supabase; original complete-conciliation/all-exports wording overclaims coverage. No messages sent.

- [ ] Close clinic data access: Eva Clinic Bridge uses browser-side password matching and anonymous CRUD; requires authentication migration in that project before RLS lockdown.
- [ ] Restore secure Clinic subscription verification: its browser calls the now-restricted check_eva_subscriber_by_email RPC; requires authenticated verification in the Clinic project, not reopening anonymous financial access.
- [x] Review financial access rules and privileged operations; protect maintenance, invitation acceptance, documents, banking and payment-backed checkout.
- [x] Add and run access regression tests; verify deployed unauthorized requests are denied.
- [ ] Rotate exposed Google credential: requires a replacement key issued in Google, not merely removal from source.
- [ ] Verify authenticated billing and document flows: external Supabase has no managed test session; public routes and access denials can be verified.
- [ ] Supabase settings: leaked-password protection, OTP lifetime and database update require owner dashboard configuration.