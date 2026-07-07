# syntax=docker/dockerfile:1

# --- builder: no gradle wrapper needed, gradle is baked into the image ---
FROM gradle:8.10-jdk17 AS build
WORKDIR /home/gradle/src
COPY . .
RUN gradle :api:bootJar --no-daemon

# --- runner ---
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/src/api/build/libs/app.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
