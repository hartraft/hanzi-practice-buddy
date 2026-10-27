# Offline-first vocabulary sync

The app now uses PowerSync's local-only SQLite tables for saved custom vocabulary on Android and the browser. Existing localStorage lists are normalized with stable IDs and migrated into SQLite; localStorage remains as a compatibility/recovery copy. The cloud sync client and account controls are implemented, but cross-device sync is not active until a Supabase project and PowerSync service are configured and end-to-end tested.

## Architecture

- Supabase Auth: user identity.
- Supabase Postgres: cloud records, protected by RLS.
- PowerSync: local SQLite on Android and SQLite/WASM-backed persistence in the browser, plus queued bidirectional sync.
- App: bundled TOCFL decks and practice must remain usable offline, even when signed out.

PowerSync's Capacitor SDK is currently beta and requires Capacitor 8+, `@capacitor-community/sqlite`, `@powersync/web`, the WA-SQLite web driver, and a module-aware build setup. This branch upgrades the app's Capacitor/Android toolchain and uses Vite to bundle the existing HTML/JavaScript app. See the [PowerSync Capacitor SDK guide](https://powersync-ja.github.io/powersync-js/capacitor-sdk).

## Database setup

1. Create a Supabase project.
2. Apply `supabase/migrations/20261027200000_vocabulary_sync.sql` using the Supabase CLI migration workflow or SQL Editor.
3. Review RLS policies in the Supabase dashboard and test with two separate authenticated users. The migration grants the `authenticated` role table access but row policies restrict access to each user's rows.
4. Create/configure a PowerSync service connected to the Supabase Postgres database. Use `powersync/service.example.yaml` as the non-secret configuration template and `powersync/sync-config.yaml` for the **Sync Streams** config. The stream queries use `auth.user_id()` so clients only receive records owned by the authenticated Supabase user. Validate and deploy the streams in the PowerSync dashboard. Do not replace them with a global stream.
5. Configure the client with the Supabase project URL, Supabase publishable key, and PowerSync endpoint. These values may be public client configuration; never include a Supabase service-role key, database password, or privileged sync credential in app assets.

End-to-end syncing cannot be enabled until the Supabase and PowerSync services are configured and the client integration is committed. Do not put real project credentials into source control; use a local ignored config file or build-time environment variables.

## Schema and data semantics

- `vocabulary_lists.id` and `vocabulary_items.id` are stable UUIDs.
- Every row is owned by `user_id`; item ownership must match its parent list.
- A word is an independent item, so distinct offline additions need not overwrite the whole list.
- `deleted_at` is reserved for soft deletion/tombstones. The client must not hard-delete synced records until a safe tombstone-retention strategy exists.
- The current schema keeps `updated_at` server-managed on updates. Client conflict resolution must not trust arbitrary client timestamps as authoritative.

## Migration requirements for the client integration

1. Read `hanziPracticeBuddyCustomLists` from existing localStorage.
2. Assign stable UUIDs and normalize each word to an item row.
3. Use a persisted migration marker or deterministic identity mapping so repeated migration attempts are safe.
4. Verify the local SQLite rows before marking migration complete. Do not delete the legacy localStorage data in the first release.
5. When a user signs in on a device that already has cloud lists, merge by stable IDs; do not replace the cloud snapshot with an older local snapshot.

## Validation checklist

- [ ] Existing app tests and Android/web builds pass on the current commit.
- [x] PowerSync SDK peer dependencies confirmed; Capacitor 8 and a module-aware build are now configured in the branch.
- [x] Existing local lists are normalized with stable IDs and migrated to local-only SQLite tables idempotently.
- [ ] Physically test create/edit/delete in airplane mode, force-stop/restart, and confirm persistence on Android and browser.
- [ ] Two authenticated clients preserve distinct concurrent word additions after reconnecting.
- [ ] Delete a word/list on one client while the other is offline; reconnect and verify no resurrection.
- [ ] Confirm a second user cannot read or modify the first user's records.
- [ ] Confirm no privileged secrets are present in the generated web assets or APK.

## Current status

- [x] Issue and OpenSpec proposal/design/spec created.
- [x] Initial Postgres schema and RLS policies committed.
- [ ] Local SQLite storage and idempotent migration.
- [ ] Auth, PowerSync connector and sync rules.
- [ ] UI sync state and end-to-end tests.
