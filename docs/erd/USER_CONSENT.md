# USER_CONSENT — 회원 동의

회원 가입 시점에 동의한 약관.
온보딩 완료 시점에 3행이 만들어짐.
이후 약관 개정 시점에 새 행이 만들어짐

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| USER_ID | BIGINT FK → USER | N | USER.ID FK |
| CONSENT_TYPE | VARCHAR(20) | N | 동의 유형. `MARKETING` etc. |
| AGREED | BOOLEAN | N | 해당 항목에 대한 동의 여부 |
| AGREED_AT | DATETIME | N | 동의 시각. |
| CONSENT_VERSION | VARCHAR(20) | N | 동의한 약관 버전. `docs/terms-of-service.md`·`docs/privacy-policy.md` 의 `version` 필드와 일치 |

## 관계
- N : 1 [USER](./USER.md)

## CONSENT_TYPE
- `MARKETING` — 마케팅 수신 동의. 이메일·디스코드
- `TERMS_OF_SERVICE` — 서비스 이용 약관 동의
- `PRIVACY_POLICY` — 개인정보 수집·이용 동의