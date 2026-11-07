# Proposal: Offline-first vocabulary persistence and cloud sync

## Why
Custom vocabulary currently lives in `localStorage`, tied to one browser/app installation. The app already supports offline practice, but custom lists do not follow the learner across devices. Sync must not make the app network-dependent or risk losing edits during outages.

## What changes
- Introduce stable identifiers and a durable local data model for saved lists and individual vocabulary items.
- Preserve and idempotently migrate existing `localStorage` lists.
- Add Supabase Auth/Postgres as the cloud source of truth and PowerSync as the offline sync layer, after verifying compatibility with the app's plain HTML/JavaScript and Capacitor 5 setup.
- Keep bundled TOCFL decks and import/export available offline.
- Define conflict, deletion, privacy and setup policies; defer practice progress sync.

## Scope
First release synchronises custom vocabulary lists and items only. Sync UI communicates signed-out, syncing, synced, and offline/error states. Cloud credentials must be limited to public client configuration; enforce ownership in Postgres RLS and the authenticated write path.

## Non-goals
- Collaborative/shared lists.
- Practice statistics and preferences sync.
- CRDTs in the first iteration.
- Making the app require an account or internet connection to practise bundled decks.

## Delivery checkpoints
1. Compatibility spike and schema/design decision.
2. Local persistence and safe migration.
3. Authenticated cloud sync, if supported by verified SDKs.
4. Offline/reconnect tests and Android build verification.

## Risks
- The app currently has no JS bundler and uses Capacitor 5; PowerSync's Capacitor SDK version and build requirements must be checked before integration.
- No cloud project credentials/configuration have been provided. Schema and code can be committed, but end-to-end sync requires a configured Supabase project and PowerSync service.
