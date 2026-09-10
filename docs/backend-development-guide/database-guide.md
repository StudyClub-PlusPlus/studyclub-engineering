# Database Guide

## Table of Contents

- [스키마의 정본은 마이그레이션이다](#스키마의-정본은-마이그레이션이다)
- [마이그레이션 작성 규칙](#마이그레이션-작성-규칙)
- [테이블·컬럼 이름 규칙](#테이블컬럼-이름-규칙)
- [외래키 정책](#외래키-정책)
- [로컬 개발](#로컬-개발)

## 스키마의 정본은 마이그레이션이다

**기본은 `validate` 다 — prod 는 예외 없이 `validate`, stage 만 `update`.**

```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
  jpa:
    hibernate:
      ddl-auto: ${DDL_AUTO:validate}
```

| | ddl-auto: update (예전) | flyway + validate (지금) |
|---|---|---|
| 스키마를 바꾸는 주체 | 엔티티 클래스 | `db/migration/V*.sql` |
| 컬럼을 지우면 | 운영 DB 에서도 **조용히 사라진다** | 아무 일도 안 일어난다 |
| 무엇이 언제 바뀌었나 | 알 수 없다 | `flyway_schema_history` |
| 매핑과 실제 스키마가 어긋나면 | 스키마를 고쳐 버린다 | **부팅에서 즉시 실패** |

### 환경별

**스키마를 만드는 주체는 환경마다 하나뿐이다** — Flyway 아니면 Hibernate. 둘 다 켜지 않는다.

| 환경 | 스키마를 만드는 주체 | `ddl-auto` | `FLYWAY_ENABLED` |
|------|---------------------|-----------|------------------|
| 로컬 | **Flyway** | `validate` (기본값) | `true` (기본값) |
| **stage** | **Hibernate** | `update` | **`false`** |
| **prod** | **Flyway** | `validate` (기본값) | `true` (기본값) |

stage 의 두 값은 k8s `studyclub-api-stage-env` 시크릿이 넣는다. **prod 에는 둘 다 넣지 않는다** —
이 환경변수들은 stage 를 위한 것이지 설정 손잡이가 아니다.

### 왜 둘을 같이 켜지 않나

부팅 순서는 Flyway → Hibernate 다. 그래서 **첫 배포는 멀쩡히 지나간다.**
깨지는 건 나중이다:

1. stage 에서 엔티티에 `nickname` 을 추가 → Hibernate `update` 가 컬럼을 만든다
2. 며칠 뒤 같은 내용을 `V2__add_nickname.sql` 로 쓴다
3. 다음 stage 배포에서 Flyway 가 `ADD COLUMN nickname` 을 실행 → **`Duplicate column` 으로 부팅 실패**

터지는 시점이 만든 시점에서 멀어서 원인이 안 보인다. 그래서 stage 는 Flyway 를 끈다.

### 그럼 마이그레이션은 어디서 검증하나

**CI 에서.** stage 가 Flyway 를 안 돌리므로, 끄기만 하면 `V*.sql` 이 **처음 실행되는 곳이 prod** 가 된다.
그래서 `backend-migration-check.yaml` 이 PR·푸시마다 **빈 MySQL 8 에 마이그레이션을 처음부터 적용하고
`ddl-auto: validate` 로 앱을 띄운다.** 부팅이 성공하면 두 가지가 동시에 증명된다:

- 마이그레이션 SQL 이 실제 MySQL 에서 돈다
- 엔티티 매핑과 마이그레이션이 만든 스키마가 일치한다 (`validate` 통과)

stage 를 리허설로 쓰는 것보다 정확하다 — CI 는 **항상 빈 DB 에서 시작**하기 때문이다.
stage DB 는 누적된 상태라 "우연히 되는" 경우가 생긴다.

> **stage 는 prod 와 다른 DB 다** (2026-08-31 분리). 그전까지 stage 가 prod 인스턴스의 같은 스키마를
> 그대로 썼기 때문에, 그 상태로 `update` 를 켰다면 **stage 배포가 운영 컬럼을 바꿨다.**
> 환경별 `ddl-auto` 를 논하기 전에 DB 가 실제로 갈라져 있는지부터 확인한다.

## 마이그레이션 작성 규칙

```
backend/api/src/main/resources/db/migration/
  V1__init.sql
  V2__add_study.sql
```

1. **이름은 `V{번호}__{스네이크_설명}.sql`.** 번호는 이어서 증가. 밑줄 두 개(`__`)다.
2. **적용된 마이그레이션은 절대 수정하지 않는다.** Flyway 는 체크섬을 저장하므로
   고치면 다음 배포가 `Migration checksum mismatch` 로 실패한다. 고칠 게 있으면 **다음 번호**를 추가한다.
3. **엔티티와 마이그레이션을 같은 PR 에 넣는다.** 둘이 갈리면 `validate` 가 배포 시점에 터진다.
4. **되돌리는 마이그레이션은 쓰지 않는다** (`undo` 미사용). 실수는 앞으로 가는 마이그레이션으로 고친다.
5. **데이터가 있는 테이블에 `NOT NULL` 컬럼을 한 번에 추가하지 않는다.**
   `nullable 추가 → 백필 → NOT NULL 로 변경` 세 단계로 나눈다.

## 테이블·컬럼 이름 규칙

| 대상 | 규칙 | 예 |
|------|------|-----|
| 테이블 | **대문자**, 복수형 | `USERS`, `STUDIES`, `STUDY_MEMBERS` |
| 컬럼 | 소문자 snake_case | `google_sub`, `created_at` |
| 유니크 키 | `uk_{테이블}_{컬럼}` | `uk_users_email` |
| 인덱스 | `idx_{테이블}_{컬럼}` | `idx_studies_status` |
| 외래키 | `fk_{자식}_{부모}` | `fk_study_members_study` |

**이 규칙은 코드가 강제한다** — `UpperCaseTableNamingStrategy` 가 물리 테이블 이름을 대문자로
올린다. 그래도 엔티티에는 `@Table(name = "USERS")` 를 명시한다: 클래스 이름의 복수형·약어는
전략이 알 수 없고, 파일만 읽고 실제 테이블 이름을 알 수 있어야 하기 때문이다.

> **ERD 문서는 컬럼도 대문자로 씁니다 — 모순이 아니다.** [`../erd/README.md`](../erd/README.md) 의
> 표기(`CREATED_AT`)는 **설계 표기법**이고, 실제 DDL 컬럼은 소문자(`created_at`)다.
> MySQL 은 컬럼 식별자를 **항상** 대소문자 구분 없이 다루므로 둘은 같은 컬럼을 가리킨다.
> 테이블 이름만 다르다 — 리눅스에서 실제로 갈리기 때문에 물리 이름을 대문자로 고정한다.

> **왜 대문자인가** — 리눅스 MySQL 은 테이블 이름의 대소문자를 구분한다(`lower_case_table_names=0`).
> 규칙이 없으면 `users` 와 `USERS` 가 **양쪽 다 존재하는** 상태가 만들어지고, 데이터가 갈라진 뒤에는
> 되돌리기가 비싸다. 한쪽으로 고정하는 것 자체가 목적이다. (컬럼 이름은 MySQL 이 항상
> 대소문자를 구분하지 않으므로 읽기 좋은 소문자로 둔다.)

## 외래키 정책

**기본은 걸지 않는다. 다만 "유효한 경우"에는 반드시 건다.**

### 거는 경우 — 애그리거트 **안**

부모가 사라지면 자식이 존재할 이유가 없는 관계. 이때 FK 는 DB 가 지키는 마지막 방어선이다.

```sql
CONSTRAINT fk_study_members_study
    FOREIGN KEY (study_id) REFERENCES STUDIES (id) ON DELETE CASCADE
```

### 걸지 않는 경우 — 애그리거트 **사이**

`STUDIES.owner_id → USERS.id` 처럼 서로 다른 애그리거트를 잇는 참조는 **ID 컬럼 + 인덱스만** 둔다.

```sql
owner_id BIGINT NOT NULL,
INDEX idx_studies_owner (owner_id)   -- FK 제약은 걸지 않는다
```

이유:
- 애그리거트마다 트랜잭션이 다르므로, 두 애그리거트를 하나의 DB 제약으로 묶으면
  **경계가 DB 에서 다시 붙어 버린다** ([`ddd-guide.md`](ddd-guide.md#애그리거트--경계가-트랜잭션이다))
- 대량 삭제·아카이빙·마이그레이션에서 FK 가 잠금과 순서 제약을 만든다
- 회원 탈퇴처럼 "부모는 지우되 기록은 남긴다"가 정책인 경우가 실제로 있다

### 판정 한 문장

> **"부모가 사라졌을 때 이 행이 살아 있으면 데이터가 깨진 것인가?"**
> 그렇다 → FK 를 건다. "지워졌다는 사실만 남기면 된다" → 걸지 않고 인덱스만 둔다.

**FK 를 걸지 않기로 했으면 고아 데이터를 무엇이 막는지 코드에 남긴다** — 애그리거트 루트의
삭제 메서드나 배치. "안 걸었다"만 있고 대책이 없으면 그냥 깨지는 것이다.

## 로컬 개발

```bash
docker compose up -d mysql          # DB 만 기동
cd backend && ./gradlew :api:bootRun  # Flyway 가 마이그레이션 적용 후 부팅
```

**기존에 `ddl-auto: update` 로 만들어진 로컬 DB 가 있으면** 소문자 `users` 테이블이 남아 있다.
Flyway 는 대문자 `USERS` 를 새로 만들므로 둘이 공존하게 된다. 로컬 DB 는 버리고 다시 만든다:

```bash
docker compose down -v && docker compose up -d mysql   # ⚠️ 로컬 DB 데이터가 지워진다
```

스키마를 바꿨는데 부팅이 `Schema-validation` 으로 실패하면, **엔티티가 아니라
마이그레이션이 빠진 것**이다. `V{다음번호}__*.sql` 을 추가한다.
