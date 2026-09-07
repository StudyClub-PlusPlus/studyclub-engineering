# ACCOUNT_IDENTITY — 로그인 수단

한 회원이 가진 소셜 로그인 연결. 구글로 시작, 애플 추가 예정. **이메일 자동 병합 없음** — 로그인된 상태에서 명시적으로 연결한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT FK → ACCOUNT | N | |
| ISSUER | VARCHAR(20) | N | `GOOGLE` / `APPLE` |
| PROVIDER_ACCOUNT_ID | VARCHAR(255) | N | OAuth `sub` |
| PROVIDER_EMAIL | VARCHAR(255) | N | OAuth 제공자가 전달한 이메일 원본. ACCOUNT.EMAIL 과 다를 수 있음 |
| LAST_LOGIN_AT | DATETIME | Y | |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md)

## 상태
없음. 연결/해제는 행 존재 여부.

## 제약
- `UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID)` — 한 소셜 계정은 한 회원에만
- `UNIQUE(ACCOUNT_ID, ISSUER)` — 한 회원이 같은 제공자를 두 번 연결 못 함

## 미확정
- drawio 에는 `ACCOUNT_ID VARCHAR`로 되어 있으나 ACCOUNT.ID가 BIGINT이므로 맞춘다.
