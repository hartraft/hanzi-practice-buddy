# hanzi-practice-buddy

An interactive web application, PWA, and Android app for practicing Chinese characters (Hanzi) with stroke-order quizzes, TOCFL vocabulary decks, guided writing, and offline support.

## Vocabulary Dataset & Decks

The application bundles vocabulary derived from the TOCFL Vocabulary Workbook: `data/華語八千詞表20240923.xlsx`.

- **Worksheets used**: TOCFL Novice 1 (準備級一級) and Novice 2 (準備級二級).
- **Counts**: 160 entries for Novice 1, 234 entries for Novice 2 (394 total entries).
- **Fields preserved**: Context/Domain (任務領域), Traditional Chinese Vocabulary (詞彙), Pinyin (漢語拼音), and Parts of Speech (詞類) where available.

### Deck Selector
The app provides a deck selector allowing users to practice:
1. **TOCFL Novice 1**
2. **TOCFL Novice 2**
3. **TOCFL Novice 1 & 2 (Both)**
4. **Custom List** (via custom textarea input)

### Regenerating the Dataset
To regenerate the bundled JSON dataset (`data/vocabulary_novice.json`) from the source Excel workbook:
```bash
python scripts/extract_vocabulary.py
```

### Running Automated Tests
To run the Python test suite (verifying counts, required fields, duplicate handling, and JSON dataset sync):
```bash
pytest -o pythonpath=.
```

---

## Features & Writing Controls

- **Hanzi Writer Integration**: Interactive stroke-by-stroke quiz with grading.
- **Separate Controls**:
  - Toggle to **Hide Character Prompt** (and Pinyin).
  - Toggle to **Hide Outline / Shadow**.
  - **No-Hint Mode** for advanced practice.
  - **Stroke-Order Replay** button to animate character strokes.
- **Navigation & Progress**: Previous/next character navigation and progress indicators (`Character X of Y`).
- **Local Persistence**: Automatically saves practice streaks, daily practiced characters, total characters learned, deck selection, and writing preferences in `localStorage`.

---

## Android APK & Capacitor Packaging

The web app is packaged for Android using Capacitor.

### Building Web Assets & Syncing
```bash
npm install
npm run build
```

### Building Android APK Locally
1. Ensure Java JDK 17 and Android SDK are installed.
2. Open the Android project in Android Studio or build via Gradle:
```bash
cd android
./gradlew assembleDebug
```
The resulting debug APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

### GitHub Actions CI & Release Workflows
- **CI Workflow (`.github/workflows/build-apk.yml`)**: Automatically runs the test suite and builds the Android debug APK, uploading it as a downloadable artifact on every push or pull request.
- **Release Workflow (`.github/workflows/release.yml`)**: Automatically runs tests, builds the Android APK, and publishes the APK as a GitHub Release asset when a version tag (e.g. `v1.0.1.0`) is pushed or when triggered manually via GitHub Actions workflow dispatch (supporting parameterized `tag`, `draft`, and `prerelease` inputs).

---

## Offline Stroke-Data Availability

- **Stroke Data**: Hanzi Writer fetches character stroke data from `jsdelivr.net` CDN on demand.
- **Service Worker Caching**: The included service worker (`sw.js`) caches all CDN requests (`jsdelivr.net`) and local dataset files (`/data/`). Once loaded online once, characters and stroke data are fully available offline.
- **Internet Dependency**: Initial online connection is required to fetch CDN stroke data for characters not yet cached.

---

## Offline-first vocabulary sync (in progress)

The planned cross-device sync uses **Supabase Auth + Postgres and PowerSync**, with local-first SQLite on Android and browser-backed SQLite on the web. Saved custom lists now use PowerSync local-only SQLite tables, with an idempotent migration from localStorage. Supabase authentication and the PowerSync cloud connector are implemented; cross-device sync still requires a configured Supabase project and PowerSync service.

The vocabulary selector also includes **Course-app vocabulary (Neon PostgreSQL)**. Configure the course-app deployment's base URL in the app (or `VITE_COURSE_API_BASE_URL` at build time); the app reads the existing paginated `/api/vocabulary` endpoint and maps Traditional Chinese, Mandarin Pinyin, English meaning and tags into practice entries. This is a read-only API integration: the Android/PWA client never receives Neon database credentials. Bundled TOCFL decks and custom lists remain available offline.

See [the implementation and setup guide](docs/offline-vocabulary-sync.md), [OpenSpec proposal](openspec/changes/offline-vocabulary-sync/proposal.md), and [GitHub issue #10](https://github.com/hartraft/hanzi-practice-buddy/issues/10). Do not configure service-role credentials in client code.
