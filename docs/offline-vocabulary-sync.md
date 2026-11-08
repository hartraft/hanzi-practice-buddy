# Offline-first vocabulary sync

The app uses PowerSync's local-only SQLite tables for device-local custom vocabulary and PowerSync's authenticated tables for cloud-owned lists. Cloud-owned lists are tagged in memory and are never copied into the shared localStorage or local-only SQLite cache. Remote queries are filtered by the active user, and the previous PowerSync connection is disconnected before a different account is connected. The cloud sync client and account controls are implemented, but cross-device sync is not active until a Supabase project and PowerSync service are configured and end-to-end tested.

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
4. Follow the [official Supabase + PowerSync setup guide](https://docs.powersync.com/integrations/supabase/guide) to configure the Postgres replication role/publication and create a PowerSync service connected to the database. Use `powersync/service.example.yaml` as the non-secret configuration template and `powersync/sync-config.yaml` for the **Sync Streams** config. The stream queries use `auth.user_id()` so clients only receive records owned by the authenticated Supabase user. Validate and deploy the streams in the PowerSync dashboard. Do not replace them with a global stream.
5. Configure the client with the Supabase project URL, Supabase publishable key, and PowerSync endpoint. These values may be public client configuration; never include a Supabase service-role key, database password, or privileged sync credential in app assets.

End-to-end syncing cannot be enabled until the Supabase and PowerSync services are configured and the client integration is committed. Do not put real project credentials into source control; use a local ignored config file or build-time environment variables.

## Shared course-app vocabulary source

Hanzi Practice Buddy can also read the shared vocabulary already stored by `course-app` in Neon PostgreSQL. Select **Course-app vocabulary (Neon PostgreSQL)** in the Vocabulary Deck selector. Configure the course-app deployment's base URL in the app; the value is stored locally on the device. For automated builds, `VITE_COURSE_API_BASE_URL` can provide a default.

The client calls the existing read-only `GET /api/vocabulary?page=0&size=200` endpoint and follows the returned page metadata until all vocabulary is loaded. Traditional Chinese is preferred for writing practice, with the API's word/simplified value as fallback. Mandarin Pinyin, English meaning/notes and tags are retained as character context. The API must be reachable from the device; browser/PWA deployments also require the course-app vocabulary route's GET-only CORS support. No Neon URL containing credentials, database password, or service-role key belongs in the app.

This source is read-only and separate from custom-list persistence/sync. It does not copy the course vocabulary into a user's custom lists. Bundled TOCFL decks and local custom lists remain usable offline; fetching the shared course-app source requires connectivity.

## Schema and data semantics

- `vocabulary_lists.id` and `vocabulary_items.id` are stable UUIDs.
- Every row is owned by `user_id`; item ownership must match its parent list.
- A word is an independent item, so distinct offline additions need not overwrite the whole list.
- `deleted_at` is reserved for soft deletion/tombstones. The client must not hard-delete synced records until a safe tombstone-retention strategy exists.
- The current schema keeps `updated_at` server-managed on updates. Client conflict resolution must not trust arbitrary client timestamps as authoritative.

## Account-isolation migration

Older builds mixed cloud-owned lists into an unscoped device-local cache. Because those cached records cannot reliably be distinguished from genuine device-local lists, the first app initialization after this fix makes a recovery copy under the localStorage key `hanziPracticeBuddyLegacyListsBackupV1`, clears the ambiguous local-only SQLite and localStorage cache before displaying saved lists, and records `hanziPracticeBuddyLocalCacheIsolationV1`. The ambiguous backup is deliberately not merged into any account; review/recover it only in a signed-out local session. This one-time reset prevents a previous account's cached cloud lists from being uploaded to or displayed in a different account.

New cloud-owned lists stay in the authenticated PowerSync tables and are excluded from device-local persistence. The in-memory cloud snapshot is also dropped on every sign-out. New device-local lists continue to use the local-only SQLite tables. The cache isolation marker is device-scoped and avoids repeating the reset on later sign-ins.

## Validation checklist

- [ ] Existing app tests and Android/web builds pass on the current commit.
- [x] PowerSync SDK peer dependencies confirmed; Capacitor 8 and a module-aware build are now configured in the branch.
- [x] Device-local lists are normalized with stable IDs and stored in local-only SQLite tables.
- [x] Cloud-owned lists are excluded from the shared device-local cache; legacy ambiguous cache is isolated on first authenticated sign-in.
- [ ] Physically test create/edit/delete in airplane mode, force-stop/restart, and confirm persistence on Android and browser.
- [ ] Two authenticated clients preserve distinct concurrent word additions after reconnecting.
- [ ] Delete a word/list on one client while the other is offline; reconnect and verify no resurrection.
- [ ] Confirm a second user cannot read or modify the first user's records.
- [ ] Confirm no privileged secrets are present in the generated web assets or APK.

## Current status

- [x] Issue and OpenSpec proposal/design/spec created.
- [x] Initial Postgres schema and RLS policies committed.
- [x] Local SQLite storage and device-local list persistence.
- [x] Auth, PowerSync connector and user-filtered sync queries.
- [ ] Live Supabase/PowerSync configuration, two-account RLS tests, and Android offline/restart validation.


## Google account linking (first slice)

The signed-in account can link Google through Supabase Auth's `linkIdentity({ provider: 'google' })` flow. This is intentionally **not** Google sign-in: the user first signs in with their existing email/password account, then links Google to that same Supabase user ID. This preserves the owner IDs on vocabulary rows and avoids silently creating or merging a second account. Existing email/password authentication remains available.

Before enabling the button:

1. In Supabase Dashboard → Authentication → Providers, enable Google and configure its OAuth client ID/secret.
2. Add the Supabase callback URL shown by the Google provider configuration to the Google OAuth client's authorised redirect URIs.
3. Add the app callback `com.hartraft.hanzipracticebuddy://auth/callback` to Supabase's allowed redirect URLs.
4. For web/PWA, also allow the deployed app origin/path used as the OAuth return URL.
5. Rebuild the Android app after the deep-link intent filter change.

The Android app returns through the registered custom scheme and exchanges the PKCE authorization code in the existing Supabase client. Only the public Supabase URL and publishable key belong in the client. Never add the Google client secret or Supabase service-role key to app configuration.

This first slice only links the identity and confirms its linked state. It does **not** synchronise practice progress: streaks, practiced-character sets, current deck/position and preferences remain local in `hanziPracticeBuddy` until the separate progress-sync slice defines and tests per-user storage, offline queueing and deterministic first-login merging. Do not treat a successful Google link as evidence that progress is backed up.
