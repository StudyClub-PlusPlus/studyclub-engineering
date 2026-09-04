# SESSION — 발급 토큰 (Redis 캐시)

로그인 세션(리프레시 토큰) 저장소. **DB 테이블이 아니라 Redis 캐시**로 관리한다.
ERD 에 포함되지 않는다 — 아래는 캐시 키/필드 정의.

## 캐시 구조

- **Key**: `session:{TOKEN_HASH}`
- **Store**: Redis (TTL = 토큰 만료까지)

| 필드 | 설명 |
|---|---|
| USER_ID | 토큰 소유자 |
| TOKEN_HASH | 토큰 원문은 저장하지 않는다. 해시만 |
| EXPIRES_AT | 만료 시각. Redis TTL 로도 관리 |
| REMOVED_AT | 로그아웃·강제 폐기 시각. 세팅되면 즉시 무효 처리 |

## 상태 (시각으로 계산)

| 판정 | 조건 |
|---|---|
| ACTIVE | `REMOVED_AT IS NULL AND EXPIRES_AT > now()` |
| EXPIRED | Redis TTL 만료 또는 `EXPIRES_AT <= now()` |
| REVOKED | `REMOVED_AT IS NOT NULL` |
