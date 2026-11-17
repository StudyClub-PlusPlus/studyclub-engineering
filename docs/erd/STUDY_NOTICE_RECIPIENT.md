# STUDY_NOTICE_RECIPIENT — 반 공지를 받는 사람

[STUDY_NOTICE](./STUDY_NOTICE.md) 한 건을 받는 사람 한 명당 한 행. 공지 애그리거트 안이라 공지에 외래키를 둔다.

> 스펙: [study-notice](../../specs/study-notice/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| NOTICE_ID | BIGINT FK → STUDY_NOTICE | N | |
| ACCOUNT_ID | BIGINT | N | ID 참조([ACCOUNT](./ACCOUNT.md)). 보낸 시점 명부의 사람 |
| DISCORD_MENTIONED | BOOLEAN | N | 디스코드 글에서 멘션을 **요청했는가**. 봇이 글을 올린 뒤에 표시한다 — 보내기 전·건너뜀·실패는 false. 봇은 길드를 떠난 사람을 멘션에서 빼고도 204 를 주고 누구를 뺐는지 알려 주지 않아, 실제 알림을 받은 사람보다 많을 수 있다 |
| CREATED_AT / UPDATED_AT | DATETIME(6) | N | `BaseEntity` |

## 관계

- N : 1 [STUDY_NOTICE](./STUDY_NOTICE.md) — 같은 애그리거트, FK `fk_study_notice_recipient_notice` (`ON DELETE CASCADE`). 행은 공지를 통해서만 만들고 바꾼다
- N : 1 [ACCOUNT](./ACCOUNT.md) — ID 참조뿐이다 (애그리거트 간, FK 없음). 회원이 탈퇴해 `ACCOUNT` 행이 지워지면 되짚을 수 없어 따로 비식별할 것이 없다 ([STUDY_ATTENDANCE](./STUDY_ATTENDANCE.md) 와 같은 원칙)

## 상태

없음.

## 제약

- `uk_study_notice_recipient_notice_account UNIQUE(NOTICE_ID, ACCOUNT_ID)` — 한 공지에 같은 사람은 한 번

## 마이그레이션

`V41__study_notice.sql` (domain) 에서 만들고, `V44__rename_study_notice_recipient_uk.sql` 에서 유니크 키 이름을 `uk_{테이블}_{컬럼}` 규칙에 맞췄다.
