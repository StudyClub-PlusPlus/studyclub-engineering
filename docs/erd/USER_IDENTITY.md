# USER_IDENTITY — 로그인 수단

한 회원이 가진 소셜 로그인 연결. 구글로 시작, 애플 추가 예정. **이메일 자동 병합 없음** — 로그인된 상태에서 명시적으로 연결한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| USER_ID | BIGINT FK → USER | N | |
| ISSUER | VARCHAR(20) | N | `GOOGLE` / `APPLE` |
| PROVIDER_USER_ID | VARCHAR(255) | N | OAuth `sub` |
| LAST_LOGIN_AT | DATETIME | Y | |

## 관계
- N : 1 [USER](./USER.md)

## 상태
없음. 연결/해제는 행 존재 여부.

## 제약
- `UNIQUE(ISSUER, PROVIDER_USER_ID)` — 한 소셜 계정은 한 회원에만
- `UNIQUE(USER_ID, ISSUER)` — 한 회원이 같은 제공자를 두 번 연결 못 함

## 미확정
- drawio 에는 `USER_ID VARCHAR` 로 되어 있으나 USER.ID 가 BIGINT 이므로 맞춘다.
- 표 설계에 있던 `PROVIDER_EMAIL`·`EMAIL_VERIFIED` 를 넣을지 (제공자 이메일 ≠ USER.EMAIL 인 경우 추적용).
