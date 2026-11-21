# WEB_PUSH_SUBSCRIPTION — 웹 푸시 구독

브라우저 한 곳(기기 × 브라우저)의 푸시 주소와 암호화 키. 사이트 마이페이지에서 알림을 켜면 생기고, 끄거나 탈퇴하거나 푸시 서버가 만료(404·410)를 알리면 지운다.

> 스펙: [web-push](../../specs/web-push/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | `NOTIFICATION.RECIPIENT_VALUE` 가 이 값을 문자열로 가리킨다 |
| ACCOUNT_ID | BIGINT | N | ID 참조([ACCOUNT](./ACCOUNT.md), FK 없음). 같은 브라우저에서 다른 사람이 켜면 그 사람으로 바뀐다 |
| ENDPOINT | VARCHAR(1024) | N | 푸시 서버 주소. 브라우저 회사 서버만 받는다 |
| ENDPOINT_HASH | VARCHAR(64) | N | ENDPOINT 의 SHA-256. 주소가 길어 유일 인덱스를 여기 건다 |
| P256DH | VARCHAR(128) | N | 브라우저 공개키(base64url) |
| AUTH | VARCHAR(64) | N | 인증 비밀(base64url) |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 인덱스

- `uk_web_push_subscription_endpoint_hash (ENDPOINT_HASH)` 유일 — 같은 기기에 두 번 가지 않게
- `idx_web_push_subscription_account (ACCOUNT_ID)` — 「나에게」 보내기 · 탈퇴 삭제

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md), ID 참조뿐 FK 없음. 탈퇴 시 서비스가 지운다.
- 1 : N [NOTIFICATION](./NOTIFICATION.md) (`RECIPIENT_TYPE=WEB_PUSH`). 구독을 지워도 알림 행(발송 이력)은 남는다.
