# Changelog

## [1.0.1.0] - 2026-10-17

### Added
- Package web app as Android APK using Capacitor (`@capacitor/android`), complete with build scripts and CI workflow (`.github/workflows/build-apk.yml`).
- TOCFL Novice 1 and Novice 2 vocabulary decks (394 total entries) extracted from source Excel workbook, with dataset extraction script and automated tests.
- Deck selector for Novice 1, Novice 2, Both, and Custom lists.
- Advanced writing controls including character prompt hide, outline/shadow hide, no-hint practice mode, stroke-order replay animation, navigation, and progress indicators.
- Local persistence for practice streaks, daily stats, character index, deck selection, and writing preferences.
- Offline caching of Hanzi Writer CDN stroke data (`jsdelivr.net`) and local dataset files via service worker.
