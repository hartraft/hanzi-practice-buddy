# Design: Offline-first vocabulary sync

## Decision
Target **Supabase Postgres + PowerSync local-first sync**. Do not add CRDTs yet: independent vocabulary entries merge naturally; same-record conflicts use explicit metadata timestamps and tombstones. First verify supported PowerSync JS/Capacitor versions and build tooling. Current project uses plain script tags and Capacitor 5, so bundling and/or Capacitor upgrade may be required.

## Data model
- `vocabulary_lists`: UUID primary key, owner UUID, name, created/updated timestamps, nullable deletion timestamp, revision/update metadata.
- `vocabulary_items`: UUID primary key, owner UUID, parent list UUID, vocabulary text, stable position, created/updated timestamps, nullable deletion timestamp.
- Use UUIDs rather than list names as identity. A rename does not change references.
- Keep rows for deletions as tombstones so disconnected devices do not resurrect deleted content. Tombstone garbage collection is deferred until a safe retention policy exists.

## Offline and conflict semantics
- All local writes complete before any network request; the sync engine queues outbound changes durably.
- New items with distinct UUIDs merge as independent records.
- For concurrent edits to the same list name/item content, use a deterministic last-write-wins rule based on server-validated update metadata, not a client's untrusted clock alone where avoidable.
- Deletion tombstones win against stale updates during the first release.
- If the sync service cannot guarantee these semantics for the chosen schema, add a server-side upload endpoint/transaction rather than relying on blind upserts.

## Security
- Supabase Auth identifies the user.
- RLS policies constrain every list and item to `auth.uid() = user_id`.
- Item policies also verify ownership of the parent list.
- Never include service-role keys or database passwords in client assets.
- PowerSync sync rules expose only the authenticated user's rows.

## Migration
- Read current `hanziPracticeBuddyCustomLists` localStorage value.
- Convert each list and each word to stable UUID records, using deterministic IDs or a migration marker so retries do not duplicate rows.
- Do not clear legacy localStorage until local database writes complete and the user data has been verified.
- On first cloud login, merge existing local records with cloud records; never replace a cloud list solely because local storage is older.

## UI
- Add a compact sync/account area: signed out, offline/local-only, syncing, synced, or error.
- No login should be needed for bundled decks or local practice. Account sign-in is only needed to enable cross-device cloud sync.
- Retry on reconnect and app foreground; no unbounded tight retry loops.

## Validation
- Unit tests for migration idempotency, UUID stability, list/item conversion, tombstone handling and merge rules.
- Android airplane-mode/restart test and two-client reconnect test with a configured backend.
- CI build plus existing test suite.
