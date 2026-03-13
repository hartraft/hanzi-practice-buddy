# hanzi-practice-buddy

## Building

### Android APK

**Requirements:** x86_64 machine (the Android Gradle Plugin doesn't support ARM builds natively)

```bash
./gradlew assembleDebug
```

The APK will be in `build/outputs/apk/debug/`.

### Web

```bash
./gradlew jsBrowserProductionWebpack
```

The output will be in `build/js/packages/<project-name>/webpack`.

### Run with Docker

```bash
./gradlew jsBrowserProductionWebpack
docker-compose up -d
```

The web app will be available at http://localhost:8555
