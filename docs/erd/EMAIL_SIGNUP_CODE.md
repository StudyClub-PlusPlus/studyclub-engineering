# EMAIL_SIGNUP_CODE — 테스트 로그인 가입 코드

테스트 로그인([stage-email-login](../../specs/stage-email-login/spec.md))의 메일 인증 코드. 메일 하나에 여러 줄이 쌓이고, 확인은 그 메일의 맨 마지막 줄만 본다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| EMAIL | VARCHAR(255) | N | 소문자 정규화 |
| CODE_HASH | VARCHAR(64) | N | HMAC-SHA256(서버 비밀, `email:code`) hex. 코드 원문은 저장하지 않는다 |
| CODE_COPY | VARCHAR(6) | Y | 평문 사본 — `EMAIL_CODE_COPY=true` 인 stage 에서만. 운영에서 켜면 서버가 뜨지 않는다 |
| ATTEMPTS | INT | N | 틀린 횟수. 5 가 되면 그 코드는 죽는다 |
| EXPIRES_AT | DATETIME | N | 만든 뒤 10분 |
| USED_AT | DATETIME | Y | 한 번 쓰면 채운다 |
| CREATED_AT · UPDATED_AT | DATETIME | N | BaseEntity |

## 관계
없음 — ACCOUNT 와 이메일로만 이어진다(가입 전 행이라 FK 를 걸 대상이 없다).

## 제약
- `INDEX(EMAIL, ID)` — 메일별 마지막 줄 조회
- 틀린 횟수 · 사용 표시는 조건부 UPDATE(`ATTEMPTS < 5` · `USED_AT IS NULL`)라 동시 입력에도 한도를 넘지 않는다

## 미확정
- 오래된 행 지우기 — 지금은 쌓인다(테스트 계정 몇십 개 규모). 커지면 30일 지난 행을 지운다
