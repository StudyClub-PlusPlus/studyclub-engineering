# SESSION — 발급 토큰

로그인 세션(리프레시 토큰) 저장소. drawio 에 **CACHE** 표시 — Redis 등 캐시로 갈 후보이며 RDB 테이블은 폴백.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| USER_ID | BIGINT FK → USER | N | |
| TOKEN_HASH | VARCHAR(128) | N | 토큰 원문은 저장하지 않는다. 해시만 |
| EXPIRES_AT | DATETIME | N | |
| CREATED_AT / UPDATED_AT | DATETIME | N | |
| REMOVED_AT | DATETIME | Y | 로그아웃·강제 폐기 시각 |

## 관계
- N : 1 [USER](./USER.md)

## 상태 (저장하지 않음 — 시각으로 계산)

| 판정 | 조건 |
|---|---|
| ACTIVE | `REMOVED_AT IS NULL AND EXPIRES_AT > now()` |
| EXPIRED | `REMOVED_AT IS NULL AND EXPIRES_AT <= now()` |
| REVOKED | `REMOVED_AT IS NOT NULL` |

## 제약
- `UNIQUE(TOKEN_HASH)`
- 인덱스 `(USER_ID, REMOVED_AT)`

## 미확정
- 캐시(Redis)로 가면 이 테이블은 없어진다. 만료 행 정리 배치도 그때 결정.
