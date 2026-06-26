# TODO

- [x] Locate audit log rendering logic in `public/index.html` that displays the actor (“who did the change”).
- [x] Update DB schema to add audit columns:
  - [x] `leads.created_by`
  - [x] `leads.modified_by`
  - [x] `deals.created_by`
  - [x] `deals.modified_by`
- [x] Update DB schema in `001_init.sql` to add `leads.created_by`, `leads.modified_by`, `deals.created_by`, `deals.modified_by`.

- [ ] Update API handlers to populate these columns from the authenticated user.
- [ ] Update `App.renderAuditLog()` to prefer `created_by/modified_by` from DB audit records instead of `e.user`.
- [ ] Run build/lint and a minimal smoke test.

