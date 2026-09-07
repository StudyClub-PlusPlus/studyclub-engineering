# StudyClub++ Backend

Spring Boot 4.1.x multi-module backend (Java 25, Gradle Kotlin DSL).

## Modules

| Module   | Type                | Depends on         | Purpose                              |
|----------|---------------------|--------------------|--------------------------------------|
| `common` | plain Java library  | —                  | shared types/utils (`ApiResponse`)   |
| `domain` | plain Java library  | `common`           | domain models (`Study`)              |
| `api`    | Spring Boot app     | `domain`, `common` | runnable web app (controllers)       |

## Endpoints

- `GET /` → `StudyClub++ API`
- `GET /api/health` → `{ "status": "UP" }`
- `GET /api/studies` → list of studies (hardcoded fixtures for now)
- `GET /actuator/health` → actuator health

## Build & run

The Gradle wrapper **is committed** and pins Gradle 9.7.1 (URL plus
`distributionSha256Sum`), so local builds, CI and the Docker builder all use the same
Gradle. Do not regenerate it to change versions casually — that repins the whole repo.

You need **JDK 25**; Gradle itself is downloaded by the wrapper.

```bash
./gradlew :api:bootJar         # produces api/build/libs/app.jar
java -jar api/build/libs/app.jar
```

## Docker

```bash
# build context is this directory (backend/)
docker build -t studyclub-api -f Dockerfile .
docker run -p 8080:8080 studyclub-api
```

The builder stage (`eclipse-temurin:25-jdk-jammy`) runs `./gradlew :api:bootJar
--no-daemon`, so the Gradle version comes from the committed wrapper; the runner stage
(`eclipse-temurin:25-jre-jammy`) copies `api/build/libs/app.jar` and listens on port `8080`.
