# Security boundaries

- Edge functions must validate caller authority before privileged writes; shared access guards centralize secret, company-owner and document-path checks to prevent cross-tenant access.
- CSV exports must use `src/lib/csvSecurity.ts` for every cell so stored user text cannot execute spreadsheet formulas.
- System-only database maintenance RPCs are executable only by trusted service clients; scheduled database jobs retain their owner privileges.