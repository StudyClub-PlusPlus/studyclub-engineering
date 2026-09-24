# 정책 라이브러리

> 여러 Story 에 걸치는 규칙은 화면별로 흩어지면 서로 어긋난다. 전부 여기 모은다.
> **PRD 는 값을 복붙하지 않고 `POL-####` 를 가리킨다** — 값이 바뀌면 한 곳만 고친다.

| ID | 정책 | 무엇을 정하나 | 쓰는 화면 |
|---|---|---|---|
| [POL-0001](policies/POL-0001-roles.md) | 역할과 권한 | 계정 권한(캡틴·크루)과 스터디 역할(네비게이터), 권한 11개 | 콘솔 전 화면 |
| [POL-0002](policies/POL-0002-study-status.md) | 스터디 상태 | 라이프사이클(5단계)·모집 두 축, 화면 표기, 운영 종료 규칙 | 스터디 목록·상세, 사용자 사이트 |
| [POL-0003](policies/POL-0003-study-fields.md) | 스터디 정보 항목 | 등록·수정에서 받는 값과 필수 여부, 공개 조건 | 스터디 등록·수정·공개 |
| [POL-0004](policies/POL-0004-application.md) | 신청 | 신청은 상태를 갖지 않는다, 정원 판정 | 신청 폼, 신청자 목록 |
| [POL-0005](policies/POL-0005-nickname.md) | 닉네임 | 값 규칙, 중복 검사, 상태 문구 | 온보딩, 프로필 수정 |
| [POL-0006](policies/POL-0006-timezone.md) | 시간대와 지역 | 3종, 지역 파생, 날짜 표기 | 온보딩, 프로필 수정, 반 편성, 출석 |
| [POL-0007](policies/POL-0007-account-data.md) | 회원 데이터와 탈퇴 | 갖고 있는 값, 탈퇴 시 지우는 것과 남기는 것 | 온보딩, 프로필 수정, 탈퇴, 약관 |

## 아직 없는 것

결정이 덜 된 것들이다. 정해지는 대로 `POL-0008` 부터 붙인다.

- 반 편성 규칙 (반 크기, 시간대 기준, 옮기기)
- 공지·알림 종류와 발송 기준
- 출석 판정 (지각·결석 기준)

## 백엔드에 넘길 요청

정책과 어긋나 고쳐야 하는 것들. 각 정책 파일의 「백엔드와 어긋난 것」에서 모았다.

| # | 요청 | 근거 |
|---|---|---|
| 1 | `STATUS` 를 3값에서 **5값**(`DRAFT`/`OPEN`/`ONGOING`/`ENDED`/`CLOSED`)으로 확장. 진행중·종료를 계산이 아니라 라이프사이클로 저장 | [POL-0002](policies/POL-0002-study-status.md) |
| 2 | `STUDY_KIND` 를 `STUDY` 에서 `STUDY_PROGRAM` 으로 이동 | [POL-0002](policies/POL-0002-study-status.md) · [POL-0003](policies/POL-0003-study-fields.md) |
| 3 | `IS_HIDDEN`·`PUBLISH_AT`·`SLUG`·`STUDY.CAPACITY`·`STUDY_DELIVERY_FORMAT` 삭제. 공개 여부는 `STUDY_RECRUITMENT.START_AT` 유무로 판정 | [POL-0002](policies/POL-0002-study-status.md) · [POL-0003](policies/POL-0003-study-fields.md) |
| 4 | `RECRUIT_DEADLINE_AT` 을 NOT NULL 로 — 상시 모집을 두지 않는다 | [POL-0002](policies/POL-0002-study-status.md) |
| 5 | `END_AT` 경과로 자동 종료 전환 삭제. `ONGOING → ENDED` 만 N주 경과로 자동, `ENDED → CLOSED` 는 캡틴 수동 확인만(디스코드 채널 삭제를 시스템이 검증하지 않는다) | [POL-0002](policies/POL-0002-study-status.md) |
| 6 | 등록·수정 API 가 `startAt`·`discordChannelUrl`·`driveUrl` 을 입력으로 받도록 확장 | [POL-0003](policies/POL-0003-study-fields.md) |
| 7 | `PARTICIPANT_ROLE` 에서 `CO_LEADER`(부반장) 삭제 | [POL-0001](policies/POL-0001-roles.md) |
| 8 | `study-recruit-status` 의 신청 상태 전제(`PENDING`·`WAITLISTED` 등) 정리 — [POL-0004](policies/POL-0004-application.md)와 지금 `study-recruit-status/spec.md` 가 서로 다른 전제를 쓰고 있어 먼저 확인 필요 | [POL-0004](policies/POL-0004-application.md) |
| 9 | 탈퇴 시 `NOTIFICATION` 의 이메일·닉네임 스냅샷 비식별 처리 | [POL-0007](policies/POL-0007-account-data.md) |

**보류 — 아직 결정 못 한 것 (요청에 넣지 않았다)**

- 공개 취소(`OPEN → DRAFT`) 조건: 지금 ERD 는 「신청 0건일 때만」인데 프로토타입은 조건 없이 허용한다.
  신청자가 있는 채로 내리면 어떻게 되는지 정하지 못해 요청으로 못 올린다 — [POL-0002](policies/POL-0002-study-status.md) 미확정.
- `STUDY` : `STUDY_RECRUITMENT` 를 1:1 로 제약할지: **기획은 여러 모집 회차(추가 모집)를 허용하는 쪽으로 정했다** — id 최대인 회차로 판정. 1:1 제약은 요청하지 않는다.
