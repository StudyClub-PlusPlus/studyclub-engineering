# Module Structure

## Table of Contents

- [Overview](#overview)
- [Module Responsibilities](#module-responsibilities)
- [Dependency Direction](#dependency-direction)
- [Package Convention](#package-convention)

## Overview

Spring Boot 4 멀티모듈 Gradle 프로젝트. 4개 모듈로 구성.

```
backend/
├── api/          # REST 컨트롤러, 보안 설정, DTO
├── notification/ # 알림 저장, 폴링, 메일 발송
├── domain/       # 도메인 엔티티, 비즈니스 규칙
└── common/       # 공용 응답 포맷, 유틸
```

## Module Responsibilities

### api

- Spring MVC 컨트롤러 (`@RestController`)
- Spring Security 설정 (JWT 필터, SecurityConfig)
- OAuth 클라이언트 (Google)
- DTO 정의 (요청/응답)
- `application.yml` 설정

### domain

- JPA 엔티티 (`@Entity`), 값 객체 (`@Embeddable`)
- `support/BaseEntity` — 모든 엔티티의 부모 (감사 컬럼)
- 비즈니스 규칙 (도메인 로직은 엔티티 메서드로)
- **스프링 의존은 JPA/Auditing 까지.** MVC·Security 는 들이지 않는다 —
  도메인이 HTTP 를 알면 배치·이벤트 같은 다른 진입점에서 재사용할 수 없다
- Repository 인터페이스는 domain 에 둘 수도 있으나, 현재는 api 모듈에 위치

### notification

- Notification·NotificationTemplate 엔티티와 리포지토리
- UserRegisteredEvent 구독과 별도 트랜잭션의 알림 생성
- 클레임·재수거 스케줄러 및 MailClient/SES 발송
- 자체 Flyway 마이그레이션 (`db/migration`), 전역 버전 번호 공유
- `src/main/resources/notification.yml`에 `mail.*`·`notification.polling.*` 기본 설정 관리
- API의 `application.yml`에서 `spring.config.import: classpath:notification.yml`로 읽는다.
  실제 자격증명은 환경변수 또는 Git에서 제외한 외부 로컬 YAML에서 덮어쓴다.
- 웹 DTO·관리자 API는 api 모듈에 둔다

### common

- `error/ErrorCode` · `error/ErrorResponse` · `error/BusinessException` — 에러 계약
- **순수 Java 만.** 그래서 `ErrorCode` 는 `HttpStatus` 가 아니라 `int status` 를 든다
- 향후 공용 유틸리티

## Dependency Direction

```
api → domain → common
api → common
api → notification → domain
```

- **domain 은 api 를 모른다.** domain 에서 컨트롤러나 DTO 를 import 하지 않는다.
- **common 은 어디에도 의존하지 않는다.** 순수 유틸.

`build.gradle.kts` 에서:

```kotlin
// api/build.gradle.kts
dependencies {
    implementation(project(":notification"))
    implementation(project(":domain"))
    implementation(project(":common"))
}

// domain/build.gradle.kts
dependencies {
    api(project(":common"))
    api("org.springframework.boot:spring-boot-starter-data-jpa")   // 엔티티가 사는 곳
}
```

## Package Convention

```
com.studyclub.api.*       # api 모듈
com.studyclub.domain.*    # domain 모듈
com.studyclub.common.*    # common 모듈
com.studyclub.notification.* # notification 모듈
```

기능별 하위 패키지:

```
com.studyclub.api.auth        # 인증 관련 (컨트롤러, 서비스, DTO, 시큐리티)
com.studyclub.api.web         # 일반 API (Health, Study) + GlobalExceptionHandler
com.studyclub.api.config      # 스프링 설정 (JpaConfig, 네이밍 전략)
com.studyclub.domain.study    # 스터디 도메인
com.studyclub.domain.support  # BaseEntity 등 도메인 공용
com.studyclub.common.error    # 에러 계약
```
