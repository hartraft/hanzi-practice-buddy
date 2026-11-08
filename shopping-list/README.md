# Household Shopping List

A separate Capacitor Android app in this repository, using the existing Hanzi Practice Buddy stack as its starting point.

## Stack
- Capacitor + Vite + vanilla JavaScript
- Supabase Auth (Google OAuth) and PostgreSQL
- PowerSync Capacitor SDK with local SQLite for offline-first, realtime sync
- Household membership and email invitations protected by RLS

## Local development
1. Copy `.env.example` to `.env.local` and set the Supabase publishable key and PowerSync instance URL.
2. Configure Google as an Auth provider in the Supabase project. The app deep-link callback is `hartraft-shopping://auth/callback`.
3. Deploy `powersync/sync-config.yaml` to the PowerSync instance connected to the Supabase database.
4. Run `npm install`, `npm run build`, `npx cap add android` (first time), `npx cap sync android`, then `npx cap open android`.

## Database
Apply `supabase/migrations/20261108130000_shopping_lists.sql` to the existing Supabase project. It creates isolated shopping tables and does not modify the vocabulary tables.

## Google sign-in
Configure the Google provider in Supabase Auth with a Google OAuth Web client ID and secret. Add `hartraft-shopping://auth/callback` to the Supabase redirect URL allow-list. Credentials are project configuration and must not be committed.

## PowerSync
Deploy `powersync/sync-config.yaml` to the PowerSync instance. It scopes each device to households where the signed-in user is a member. The client reads and writes local SQLite; PowerSync streams remote changes and uploads queued writes through the authenticated Supabase client.

## Android build
The repository workflow builds a debug APK on changes under `shopping-list/**`. Configure repository secrets `SHOPPING_SUPABASE_URL`, `SHOPPING_SUPABASE_PUBLISHABLE_KEY`, and `SHOPPING_POWERSYNC_URL` for a ready-to-install APK. Without these secrets, CI still builds the app, but runtime configuration must be supplied separately.

## First use
The first signed-in user creates a household and its shopping list. They invite their partner by Google account email. The partner signs in with that Google account and accepts the pending invitation in the app. Both members then see the same list and checked-off state across devices.
