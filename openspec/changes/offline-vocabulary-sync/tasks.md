# Tasks

- [x] Create GitHub issue and OpenSpec proposal.
- [x] Record architecture, data model, conflict policy and security constraints.
- [x] Check PowerSync Capacitor SDK documentation: it is beta and requires a module-aware build; exact compatibility with this Capacitor 5 project remains unverified.
- [x] Add initial Postgres schema and RLS policies.
- [x] Document cloud provisioning, client configuration and migration requirements.
- [ ] Verify SDK/plugin versions and decide whether to upgrade Capacitor.
- [ ] Implement durable local SQLite persistence and idempotent localStorage migration.
- [ ] Add Supabase authentication and PowerSync connector/sync rules.
- [ ] Add sync status and reconnect retry UX.
- [ ] Add automated tests for migration and merge/tombstone behaviour.
- [ ] Run tests and Android build; record actual results.

## Checkpoints
1. **Architecture/OpenSpec** — committed.
2. **Backend schema and setup guide** — committed; not applied to a live Supabase project.
3. **Local persistence and sync integration** — pending.
4. **Validation and Android build** — pending.

A task is only marked complete when the change is committed and validation is recorded.