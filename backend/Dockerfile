# syntax=docker/dockerfile:1

# --- builder: no gradle wrapper needed, gradle is baked into the image ---
FROM gradle:8.10-jdk17 AS build
WORKDIR /home/gradle/src
COPY . .
RUN gradle :api:bootJar --no-daemon

# --- runner ---
# jammy(non-alpine) 는 linux/amd64(prod K8s)·arm64(로컬 Apple Silicon) 멀티아치 지원.
# alpine 태그는 arm64 매니페스트가 없어 로컬 빌드가 깨진다.
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /home/gradle/src/api/build/libs/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
