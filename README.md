# hanzi-practice-buddy

A Kotlin Multiplatform app for practicing Chinese characters with spaced repetition.

## Targets

- **Android** - Compose UI with local storage
- **Web** - Browser-based UI (JS)
- **Server** - Ktor backend with PostgreSQL database

## Building

### Android APK

**Requirements:** x86_64 machine (the Android Gradle Plugin doesn't support ARM builds natively)

```bash
./gradlew assembleDebug
```

The APK will be in `build/outputs/apk/debug/`.

### Web (Client-only)

```bash
./gradlew jsBrowserProductionWebpack
```

The output will be in `build/js/packages/<project-name>/webpack`.

### Server (Ktor Backend)

```bash
./gradlew jvmJar
```

The JAR will be in `build/libs/hanzi-practice-buddy-jvm-1.0.0.jar`.

## Running the Server

### Prerequisites

- PostgreSQL database (Neon, Railway, or local)
- Google OAuth credentials (for authentication)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `PORT` | Server port (default: 8080) |

### Docker Compose (Recommended)

Start the full stack with PostgreSQL:

```bash
# Set OAuth credentials (optional for local dev without auth)
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Build and start all services
docker-compose up --build
```

Services:
- **Server**: http://localhost:8080
- **Web**: http://localhost:8555
- **PostgreSQL**: localhost:5432 (user: `hanzi`, password: `hanzi`, db: `hanzi_buddy`)

### Local Development (Standalone)

```bash
# Start PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_USER=hanzi -e POSTGRES_PASSWORD=hanzi -e POSTGRES_DB=hanzi_buddy postgres:16-alpine

# Build and run server
./gradlew jvmJar
export DATABASE_URL="postgresql://hanzi:hanzi@localhost:5432/hanzi_buddy"
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
java -jar build/libs/hanzi-practice-buddy-jvm-1.0.0.jar
```

The server runs at http://localhost:8080

### Docker (Standalone)

```bash
./gradlew jvmJar
docker build -t hanzi-practice-buddy .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  hanzi-practice-buddy
```

### Deploy to Render.com

1. Create a Neon PostgreSQL database
2. Set environment variables in Render dashboard:
   - `DATABASE_URL`: Your Neon connection string
   - `GOOGLE_CLIENT_ID`: From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
3. Connect GitHub repository with `render.yaml`
4. Render will automatically build and deploy

## Features

- **Spaced Repetition (SM-2)** - Optimal review scheduling for long-term retention
- **Dual Pronunciation** - Cantonese (Jyutping) and Mandarin (Pinyin)
- **Tone Colors** - Visual tone differentiation (Pleco scheme)
- **Word Lists** - Create and manage custom vocabulary lists
- **Statistics** - Track progress, accuracy, streaks
- **OAuth Authentication** - Google sign-in
- **Dictionary Integration** - Lookup character definitions

## Architecture

- **Kotlin Multiplatform** - Shared code between Android, Web, and Server
- **Ktor** - Web framework for JVM backend
- **PostgreSQL** - Database with JDBC
- **HanziWriter.js** - Stroke practice rendering (client-side)

## Project Structure

```
src/
├── commonMain/kotlin/     # Shared code (ToneColors, JyutpingLookup)
├── androidMain/kotlin/    # Android Compose UI
├── jsMain/               # Web client
└── jvmMain/kotlin/       # Ktor server
    ├── Server.kt         # Main application
    ├── db/               # Database layer
    ├── routes/           # API endpoints
    ├── services/         # Business logic
    └── auth/             # OAuth handlers
```
