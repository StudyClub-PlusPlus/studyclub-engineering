# Story 레지스트리 (SoT)

> Story 의 **유일한 마스터**. PRD 는 이 표의 투영이다.
> 행을 삭제하지 않는다 — 폐기는 상태를 `폐기`로 바꾸고 비고에 사유를 적는다.

<!-- NUMBER LEDGER — 모든 ID의 단일 발급처. 수동 편집 금지(에이전트가 갱신). -->
| prefix | next |
|---|---|
| ST | 37 |
| EP | 1 |
| FN | 1 |
| IA | 38 |
| SRC | 1 |
| POL | 10 |

<!--
발급 절차: next 값을 읽어 ID 를 만들고, 같은 커밋에서 next 를 +1 한다.
단조 증가 — 폐기된 번호를 회수하지 않는다.
-->

## Stories

> 2026-10-06 `planning/` 의 PRD 를 이 폴더로 옮기며 노션 유저스토리 전체를 등재했다. PRD 칸이 빈 행은 아직 기획서가 없다.
>
> **상태 칸은 비워 둔다** — 기획완료·개발중·배포완료는 문서로 확인할 수 없는 값이라 적지 않는다.
> 채울 수 있는 것은 PRD 파일이 실재하는지와 프로토가 떠 있는지 둘뿐이다.
>
> **화면** — 어느 페이지가 어떤 Story 를 구현하는지는 [IA 「페이지별 유저스토리」](informationarchitecture.md#페이지별-유저스토리)에 있다.
>
> **Spec 칸** — 이 Story 를 구현하는 `specs/{도메인}/spec.md`. 개발은 이 행에서 PRD · 프로토 · Spec 으로 갈라져 들어간다.
> 스펙 쪽은 머리의 `Story PRD:` 로 거꾸로 가리킨다. 스토리 없는 인프라 스펙(관측·이벤트·인가 가드 등)은 여기 없다.

| ID | 정규문장 | Actor | PRD | 프로토 | Spec | 상태 | 비고 |
|---|---|---|---|---|---|---|---|
| ST-001 | 캡틴은 스터디를 등록할 수 있다. | 캡틴 | [PRD](../stories/study-create/PRD.md) | [콘솔 › 스터디](https://playground.studyclub.life/proto/console/studies) | [study](../../specs/study/spec.md) · [discord-study-link](../../specs/discord-study-link/spec.md) | | |
| ST-002 | 캡틴은 운영 현황을 한 화면에서 볼 수 있다. | 캡틴 | [PRD](../stories/console-dashboard/PRD.md) | [콘솔 › 대시보드](https://playground.studyclub.life/proto/console) | [dashboard](../../specs/dashboard/spec.md) · [attendance](../../specs/attendance/spec.md) | | 집계·API 는 주현님 명세(PR #90)와 맞춘다 |
| ST-003 | 캡틴은 개별 스터디의 운영 현황을 볼 수 있다. | 캡틴 | [PRD](../stories/study-detail/PRD.md) | [콘솔 › 스터디 상세](https://playground.studyclub.life/proto/console/studies/1) | [study](../../specs/study/spec.md) | | |
| ST-004 | 캡틴은 등록된 스터디를 수정·삭제할 수 있다. | 캡틴 | [PRD](../stories/study-edit/PRD.md) | [콘솔 › 정보 탭](https://playground.studyclub.life/proto/console/studies/1) | [study](../../specs/study/spec.md) | | 수정은 네비게이터도 가능 |
| ST-005 | 크루는 Google 계정으로 로그인하고 온보딩을 마칠 수 있다. | 크루 | [PRD](../stories/crew-google-login-onboarding/PRD.md) | [로그인](https://playground.studyclub.life/proto/core/ko/login) | [auth-google-login](../../specs/auth-google-login/spec.md) · [user-onboarding](../../specs/user-onboarding/spec.md) | | |
| ST-006 | 크루는 스터디를 키워드로 검색하고 카테고리별로 나눠 볼 수 있다. | 크루 | [PRD](../stories/crew-browse-studies/PRD.md) | [스터디 목록](https://playground.studyclub.life/proto/core/ko/studies) | [study](../../specs/study/spec.md) · [study-recruit-status](../../specs/study-recruit-status/spec.md) | | 노션 스토리 2건(키워드 검색 · 카테고리별 보기)을 한 PRD 로 |
| ST-007 | 크루는 스터디 상세 정보를 볼 수 있다. | 크루 | [PRD](../stories/crew-view-study-detail/PRD.md) | [스터디 상세](https://playground.studyclub.life/proto/core/ko/studies/1) | [study](../../specs/study/spec.md) | | |
| ST-008 | 크루는 스터디 신청 폼을 제출할 수 있다. | 크루 | [PRD](../stories/crew-submit-application/PRD.md) | [스터디 상세 › 신청하기](https://playground.studyclub.life/proto/core/ko/studies/1) | [study-application](../../specs/study-application/spec.md) | | |
| ST-009 | 크루는 참여 중인 스터디를 모아 볼 수 있다. | 크루 | [PRD](../stories/crew-joined-studies/PRD.md) | [내 스터디](https://playground.studyclub.life/proto/core/ko/my/joined) | [my-studies](../../specs/my-studies/spec.md) | | |
| ST-010 | 크루는 스터디별 출석 기록을 볼 수 있다. | 크루 | [PRD](../stories/crew-view-attendance-record/PRD.md) | [내 스터디 › 스터디 일정 › 출석부](https://playground.studyclub.life/proto/core/ko/my/joined) | [attendance](../../specs/attendance/spec.md) | | 스터디 일정 출석부 탭의 크루 보기 |
| ST-011 | 크루는 발표자를 신청할 수 있다. | 크루 | [PRD](../stories/crew-apply-presenter/PRD.md) | [내 스터디 › 스터디 일정](https://playground.studyclub.life/proto/core/ko/my/joined) | [study-meeting](../../specs/study-meeting/spec.md) | | |
| ST-012 | 크루는 프로필을 수정할 수 있다. | 크루 | [PRD](../stories/crew-edit-profile/PRD.md) | [마이페이지](https://playground.studyclub.life/proto/core/ko/my) | [profile-edit](../../specs/profile-edit/spec.md) · [user-onboarding](../../specs/user-onboarding/spec.md) | | |
| ST-013 | 크루는 회원에서 탈퇴할 수 있다. | 크루 | [PRD](../stories/crew-leave/PRD.md) | [회원 탈퇴](https://playground.studyclub.life/proto/core/ko/my/leave) | [user-leave](../../specs/user-leave/spec.md) | | |
| ST-014 | 크루는 이용약관과 개인정보처리방침을 확인할 수 있다. | 크루 | [PRD](../stories/crew-view-terms-privacy/PRD.md) | [이용약관](https://playground.studyclub.life/proto/core/ko/terms) | | | |
| ST-015 | 네비게이터는 스터디 회차를 등록할 수 있다. | 네비게이터 | [PRD](../stories/navigator-register-sessions/PRD.md) | [내 스터디 › 스터디 일정](https://playground.studyclub.life/proto/core/ko/my/joined) | [study-meeting](../../specs/study-meeting/spec.md) | | 일정 · 출석부 · 규칙 · 킥오프 |
| ST-016 | 네비게이터는 스터디별 공지를 등록할 수 있다. | 네비게이터 |  |  | | | 프로토타입 없음 — PRD 작성 전 |
| ST-017 | 네비게이터는 스터디별 출석 상태를 수정할 수 있다. | 네비게이터 | [PRD](../stories/navigator-edit-attendance/PRD.md) | [내 스터디 › 스터디 일정 › 출석부](https://playground.studyclub.life/proto/core/ko/my/joined) | [attendance](../../specs/attendance/spec.md) · [discord-attendance](../../specs/discord-attendance/spec.md) | | |
| ST-018 | 네비게이터는 참여자를 스터디에서 제명할 수 있다. | 네비게이터 | [PRD](../stories/navigator-withdraw-participant/PRD.md) | [내 스터디 › 스터디 일정 › 출석부](https://playground.studyclub.life/proto/core/ko/my/joined) | [study-participant](../../specs/study-participant/spec.md) · [attendance](../../specs/attendance/spec.md) | | 화면은 「참여 중단」 — 하차·제명을 가르지 않는다. 되돌리지 않는다 |
| ST-019 | 캡틴은 백오피스에 접근할 수 있다. | 캡틴 |  |  | | 폐기 | Story 가 아니다 — 화면에서 하는 일이 아니라 모든 콘솔 화면에 걸리는 조건이다. 접근 판정은 [POL-0001](policies/POL-0001-roles.md), 로그인 흐름·에러는 [back-office-login](../../specs/back-office-login/spec.md) 소관 |
| ST-020 | 캡틴은 등록한 스터디를 공개할 수 있다. | 캡틴 | [PRD](../stories/captain-publish-study/PRD.md) | [콘솔 › 스터디](https://playground.studyclub.life/proto/console/studies) | [study](../../specs/study/spec.md) | | |
| ST-021 | 캡틴은 기존 스터디를 재등록할 수 있다(기수제). | 캡틴 | [PRD](../stories/captain-reregister-cohort/PRD.md) | [콘솔 › 스터디 상세](https://playground.studyclub.life/proto/console/studies/1) | [study](../../specs/study/spec.md) | | |
| ST-022 | 캡틴은 모든 스터디의 리스트를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-list-all-studies/PRD.md) | [콘솔 › 스터디](https://playground.studyclub.life/proto/console/studies) | [study](../../specs/study/spec.md) · [study-recruit-status](../../specs/study-recruit-status/spec.md) | | |
| ST-023 | 캡틴은 스터디 신청용 폼을 작성할 수 있다. | 캡틴 | [PRD](../stories/captain-application-form/PRD.md) | [콘솔 › 스터디 상세 › 신청 폼](https://playground.studyclub.life/proto/console/studies/1) | [study-application](../../specs/study-application/spec.md) | | |
| ST-024 | 캡틴은 스터디 신청서 결과를 모아볼 수 있다. | 캡틴 | [PRD](../stories/captain-application-results/PRD.md) | [콘솔 › 스터디 상세 › 신청 결과](https://playground.studyclub.life/proto/console/studies/1) | [study-application](../../specs/study-application/spec.md) | | |
| ST-025 | 캡틴은 스터디 신청자를 보고 반을 결정할 수 있다. | 캡틴 | [PRD](../stories/captain-assign-classes/PRD.md) | [콘솔 › 스터디 상세 › 신청자](https://playground.studyclub.life/proto/console/studies/1) | [study-group](../../specs/study-group/spec.md) | | |
| ST-026 | 캡틴은 개별 스터디의 참석자를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-view-attendees/PRD.md) | [콘솔 › 스터디 상세 › 신청자](https://playground.studyclub.life/proto/console/studies/1) | [study-group](../../specs/study-group/spec.md) · [admin-users](../../specs/admin-users/spec.md) | | |
| ST-027 | 캡틴은 스터디별 출석명부를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-view-attendance-roster/PRD.md) | [콘솔 › 스터디 상세 › 출석](https://playground.studyclub.life/proto/console/studies/1) | [attendance](../../specs/attendance/spec.md) | | |
| ST-028 | 캡틴은 전체 회원 리스트를 조회할 수 있다. | 캡틴 | [PRD](../stories/captain-list-users/PRD.md) | [콘솔 › 유저](https://playground.studyclub.life/proto/console/users) | [admin-users](../../specs/admin-users/spec.md) | | |
| ST-029 | 캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다. | 캡틴 | [PRD](../stories/captain-grant-roles/PRD.md) | [콘솔 › 유저](https://playground.studyclub.life/proto/console/users) | [admin-users](../../specs/admin-users/spec.md) | | |
| ST-030 | 캡틴은 알림 템플릿을 추가, 수정, 삭제할 수 있다. | 캡틴 | [PRD](../stories/notification-template/PRD.md) | [콘솔 › 알림 › 알림 템플릿](https://playground.studyclub.life/proto/console/notifications/templates) | [notification](../../specs/notification/spec.md) | | 프로토는 보기·추가·수정·삭제. 수정·삭제 API 는 미구현 |
| ST-031 | 캡틴은 알림 발송 이력을 볼 수 있다. | 캡틴 |  |  | | 폐기 | ST-030 에 합쳤다가 다시 갈랐다 — 지금은 ST-032 |
| ST-032 | 캡틴은 알림 발송 이력을 조회할 수 있다. | 캡틴 | [PRD](../stories/notification-history/PRD.md) | [콘솔 › 알림 › 발송 이력](https://playground.studyclub.life/proto/console/notifications) | [notification](../../specs/notification/spec.md) | | 실패 건 재발송 포함 |
| ST-033 | 캡틴은 스터디클럽 웹사이트에 공지를 올릴 수 있다. | 캡틴 | [PRD](../stories/captain-post-notice/PRD.md) | [콘솔 › 공지](https://playground.studyclub.life/proto/console/notices) | | | 스펙 없음 — API·테이블부터. 스터디별 공지(ST-016)와 다르다 |
| ST-034 | 크루는 스터디클럽 공지를 확인할 수 있다. | 크루 | [PRD](../stories/crew-view-notices/PRD.md) | [사이트 › 공지](https://playground.studyclub.life/proto/core/ko/notices) | | | 비로그인 방문자도 본다. ST-033 과 같은 데이터 |
| ST-035 | 크루는 캡틴에게 문의/오류신고를 제출할 수 있다. | 크루 | [PRD](../stories/crew-submit-feedback/PRD.md) | [사이트 › 내 문의](https://playground.studyclub.life/proto/core/ko/my/feedbacks) | | | 로그인 필수. 스펙 없음 — API·테이블부터 |
| ST-036 | 캡틴은 유저가 제출한 문의/오류신고를 조회할 수 있다. | 캡틴 | [PRD](../stories/captain-view-feedbacks/PRD.md) | [콘솔 › 문의·오류 신고](https://playground.studyclub.life/proto/console/feedbacks) | | | 상태 · 회신 · 캡틴 전용 메모. 회신 알림은 알림 조건 「문의 회신」 |
