# ACCOUNT_CONSENT — 회원 동의

회원 가입 시점에 동의한 약관.
온보딩 완료 시점에 3행이 만들어짐.
현재는 온보딩 시점에 사용자가 동의한 약관 버전을 기록함.
약관 개정 시 기존 회원의 재동의 필요 여부와 재동의 흐름은 아직 기획되지 않음.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| ACCOUNT_ID | BIGINT FK → ACCOUNT | N | ACCOUNT.ID FK |
| CONSENT_TYPE | VARCHAR(20) | N | 동의 유형. `MARKETING` etc. |
| AGREED | BOOLEAN | N | 해당 항목에 대한 동의 여부 |
| AGREED_AT | DATETIME | N | 동의 시각. |
| CONSENT_VERSION | VARCHAR(20) | N | 동의 시점에 서버가 관리하던 해당 동의 종류의 게시 버전 |

## 관계
- N : 1 [ACCOUNT](./ACCOUNT.md)

## CONSENT_TYPE
- `MARKETING` — 마케팅 수신 동의. 이메일·디스코드
- `TERMS_OF_SERVICE` — 서비스 이용 약관 동의
- `PRIVACY_POLICY` — 개인정보 수집·이용 동의
