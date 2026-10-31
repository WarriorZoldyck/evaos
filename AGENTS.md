# Security boundaries

- Edge functions must validate caller authority before privileged writes; shared access guards centralize secret, company-owner and document-path checks to prevent cross-tenant access.
- CSV exports must use `src/lib/csvSecurity.ts` for every cell so stored user text cannot execute spreadsheet formulas.
- System-only database maintenance RPCs are executable only by trusted service clients; scheduled database jobs retain their owner privileges.
- Payment-backed checkout must persist pending until provider-confirmed payment; free courtesy grants remain administrative to avoid unverified entitlement.
- Chat accepts reconstructed user/assistant messages and supported inline media only; personalization never overrides authorization or action boundaries.