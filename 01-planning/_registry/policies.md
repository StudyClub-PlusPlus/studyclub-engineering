# 정책 라이브러리

> 여러 Story 에 걸치는 규칙은 화면별로 흩어지면 서로 어긋난다. 전부 여기 모은다.
> **PRD 는 값을 복붙하지 않고 `POL-####` 를 가리킨다** — 값이 바뀌면 한 곳만 고친다.

| ID | 정책 | 무엇을 정하나 | 쓰는 화면 |
|---|---|---|---|
| [POL-0001](policies/POL-0001-roles.md) | 역할과 권한 | 계정 권한(캡틴·크루)과 스터디 역할(네비게이터), 권한 11개 | 콘솔 전 화면 |
| [POL-0002](policies/POL-0002-study-status.md) | 스터디 상태 | 공개·모집 두 축, 화면 표기, 공개를 내리는 조건, 완료 | 스터디 목록·상세, 사용자 사이트 |
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
| 1 | `STUDY_COHORT` 의 공개 취소 제약(「신청 0건일 때만」) 삭제 | [POL-0002](policies/POL-0002-study-status.md) |
| 2 | `END_DATE` 경과 시 자동 완료 전환 삭제 — 완료는 캡틴이 닫는다 | [POL-0002](policies/POL-0002-study-status.md) |
| 3 | `PARTICIPANT_ROLE` 에서 `CO_LEADER`(부반장) 삭제 | [POL-0001](policies/POL-0001-roles.md) |
| 4 | `study-recruit-status` 의 신청 상태 전제(`PENDING`·`WAITLISTED` 등)와 상시 모집 줄 정리 | [POL-0004](policies/POL-0004-application.md) |
| 6 | `STUDY` : `STUDY_RECRUITMENT` 를 **1:1** 로 제약 — 기수 하나에 모집 하나 | [POL-0002](policies/POL-0002-study-status.md) |
| 7 | `RECRUIT_DEADLINE_AT` 을 NOT NULL 로 — 상시 모집을 두지 않는다 | [POL-0002](policies/POL-0002-study-status.md) |
| 5 | 탈퇴 시 `NOTIFICATION` 의 이메일·닉네임 스냅샷 비식별 처리 | [POL-0007](policies/POL-0007-account-data.md) |
