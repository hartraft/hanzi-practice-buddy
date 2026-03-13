# hanzi-practice-buddy

## Building

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
