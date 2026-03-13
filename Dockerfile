FROM gradle:8.10-jdk21 AS builder

WORKDIR /workspace

COPY --chown=gradle:gradle . /workspace

RUN ./gradlew jsBrowserProductionWebpack

FROM nginx:alpine

COPY --from=builder /workspace/build/js/packages/hanzi-practice-buddy/webpack /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
