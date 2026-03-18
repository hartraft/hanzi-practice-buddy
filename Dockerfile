FROM gradle:8.10-jdk21 AS builder

WORKDIR /workspace

COPY --chmod=+x --chown=gradle:gradle . /workspace

RUN ./gradlew jvmJar --no-daemon

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=builder /workspace/build/libs/*.jar app.jar

ENV PORT=8080
ENV DATABASE_URL=${DATABASE_URL}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV DB_USER=${DB_USER}
ENV DB_PASSWORD=${DB_PASSWORD}

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
