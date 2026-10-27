# Tasks

- [x] Create GitHub issue and OpenSpec proposal.
- [x] Record architecture, data model, conflict policy and security constraints.
- [x] Check PowerSync Capacitor SDK documentation: it is beta and requires a module-aware build; exact compatibility with this Capacitor 5 project remains unverified.
- [x] Add initial Postgres schema and RLS policies.
- [x] Document cloud provisioning, client configuration and migration requirements.
- [x] Verify SDK peer requirements and upgrade Capacitor/Android toolchain to the required major.
- [x] Implement local-only SQLite persistence and idempotent localStorage normalization/migration.
- [x] Add Supabase authentication, PowerSync connector and owner-scoped Postgres schema.
- [x] Add sign-in/sign-up controls, sync status and background reconnect behavior.
- [x] Add automated tests for localStorage migration normalization.
- [ ] Validate build, Android APK and runtime behavior; record actual results.
- [ ] Apply migration to a selected Supabase project and configure PowerSync service/sync rules.

## Checkpoints
1. **Architecture/OpenSpec** — committed.
2. **Backend schema and setup guide** — committed; not applied to a live Supabase project.
3. **Local SQLite and client integration** — committed; build/runtime validation pending.
4. **Cloud provisioning and end-to-end validation** — pending.

A task is only marked complete when the change is committed and validation is recorded.