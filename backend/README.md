# StudyClub++ Backend

Spring Boot 3.3.x multi-module backend (Java 17, Gradle Kotlin DSL).

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

There is **no committed Gradle wrapper** (`gradlew` / `gradle-wrapper.jar`) in this
repo. CI and the Docker builder use a real `gradle` binary, so the wrapper is not
required to build.

If you have Gradle installed locally:

```bash
gradle :api:bootJar            # produces api/build/libs/app.jar
java -jar api/build/libs/app.jar
```

### Adding the wrapper locally (optional, recommended for contributors)

If you'd like a committed wrapper for reproducible builds, generate it locally:

```bash
gradle wrapper --gradle-version 8.10
```

Then you can use `./gradlew` instead of a system `gradle`.

## Docker

```bash
# build context is this directory (backend/)
docker build -t studyclub-api -f Dockerfile .
docker run -p 8080:8080 studyclub-api
```

The builder stage (`gradle:8.10-jdk17`) runs `gradle :api:bootJar --no-daemon`;
the runner stage copies `api/build/libs/app.jar` and listens on port `8080`.
