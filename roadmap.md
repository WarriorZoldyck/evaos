# Security hardening

## WhatsApp update announcement
- [x] Run release checks: 154 tests passed, 3 reconciliation tests failed; audit events and an active PDF exist in production, but authenticated chat/document/pricing flows remain unverified on external Supabase.
- [ ] Broadcast option 1 blocked: reconciliation failures, goal follow-up currently triggers on submission for approval rather than confirmation, and authenticated end-to-end checks unavailable; no messages sent.

- [ ] Close clinic data access: Eva Clinic Bridge uses browser-side password matching and anonymous CRUD; requires authentication migration in that project before RLS lockdown.
- [ ] Restore secure Clinic subscription verification: its browser calls the now-restricted check_eva_subscriber_by_email RPC; requires authenticated verification in the Clinic project, not reopening anonymous financial access.
- [x] Review financial access rules and privileged operations; protect maintenance, invitation acceptance, documents, banking and payment-backed checkout.
- [x] Add and run access regression tests; verify deployed unauthorized requests are denied.
- [ ] Rotate exposed Google credential: requires a replacement key issued in Google, not merely removal from source.
- [ ] Verify authenticated billing and document flows: external Supabase has no managed test session; public routes and access denials can be verified.
- [ ] Supabase settings: leaked-password protection, OTP lifetime and database update require owner dashboard configuration.