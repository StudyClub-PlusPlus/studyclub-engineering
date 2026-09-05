# syntax=docker/dockerfile:1

# --- builder: Gradle 버전은 레포의 wrapper 가 정한다 (gradle/wrapper/gradle-wrapper.properties) ---
FROM eclipse-temurin:25-jdk-jammy AS build
WORKDIR /src
COPY . .
RUN ./gradlew :api:bootJar --no-daemon

# --- runner ---
# jammy(non-alpine) 는 linux/amd64(prod K8s)·arm64(로컬 Apple Silicon) 멀티아치 지원.
# alpine 태그는 arm64 매니페스트가 없어 로컬 빌드가 깨진다.
FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=build /src/api/build/libs/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
