# Security hardening

- [ ] Close clinic data access: blocked pending confirmation of external clinic application's authentication (three of four clinic accounts have no EVA identity).
- [x] Review financial access rules and privileged operations; protect maintenance, invitation acceptance, documents, banking and payment-backed checkout.
- [x] Add and run access regression tests; verify deployed unauthorized requests are denied.
- [ ] Rotate exposed Google credential: requires a replacement key issued in Google, not merely removal from source.
- [ ] Verify authenticated billing and document flows: external Supabase has no managed test session; public routes and access denials can be verified.
- [ ] Supabase settings: leaked-password protection, OTP lifetime and database update require owner dashboard configuration.