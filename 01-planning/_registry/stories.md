# Story 레지스트리 (SoT)

> Story 의 **유일한 마스터**. PRD 는 이 표의 투영이다.
> 행을 삭제하지 않는다 — 폐기는 상태를 `폐기`로 바꾸고 비고에 사유를 적는다.

<!-- NUMBER LEDGER — 모든 ID의 단일 발급처. 수동 편집 금지(에이전트가 갱신). -->
| prefix | next |
|---|---|
| ST | 31 |
| EP | 1 |
| FN | 1 |
| IA | 1 |
| SRC | 1 |
| POL | 8 |

<!--
발급 절차: next 값을 읽어 ID 를 만들고, 같은 커밋에서 next 를 +1 한다.
단조 증가 — 폐기된 번호를 회수하지 않는다.
-->

## Stories

> 2026-10-06 `planning/` 의 PRD 를 이 폴더로 옮기며 노션 유저스토리 전체를 등재했다. PRD 칸이 빈 행은 아직 기획서가 없다.
>
> **상태 칸은 비워 둔다** — 기획완료·개발중·배포완료는 문서로 확인할 수 없는 값이라 적지 않는다.
> 채울 수 있는 것은 PRD 파일이 실재하는지와 프로토가 떠 있는지 둘뿐이다.

| ID | 정규문장 | Actor | PRD | 프로토 | 상태 | 비고 |
|---|---|---|---|---|---|---|
| ST-001 | 캡틴은 스터디를 등록할 수 있다. | 캡틴 | [PRD](../stories/study-create/PRD.md) | [콘솔 › 스터디](https://playground.studyclub-plusplus.com/proto/console/studies) | | |
| ST-002 | 캡틴은 운영 현황을 한 화면에서 볼 수 있다. | 캡틴 | [PRD](../stories/console-dashboard/PRD.md) | [콘솔 › 대시보드](https://playground.studyclub-plusplus.com/proto/console) | | 집계·API 는 주현님 명세(PR #90)와 맞춘다 |
| ST-003 | 캡틴은 개별 스터디의 운영 현황을 볼 수 있다. | 캡틴 | [PRD](../stories/study-detail/PRD.md) | [콘솔 › 스터디 상세](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-004 | 캡틴은 등록된 스터디를 수정·삭제할 수 있다. | 캡틴 | [PRD](../stories/study-edit/PRD.md) | [콘솔 › 정보 탭](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | 수정은 네비게이터도 가능 |
| ST-005 | 크루는 Google 계정으로 로그인하고 온보딩을 마칠 수 있다. | 크루 | [PRD](../stories/crew-google-login-onboarding/PRD.md) | [로그인](https://playground.studyclub-plusplus.com/proto/core/ko/login) | | |
| ST-006 | 크루는 스터디를 키워드로 검색하고 카테고리별로 나눠 볼 수 있다. | 크루 | [PRD](../stories/crew-browse-studies/PRD.md) | [스터디 목록](https://playground.studyclub-plusplus.com/proto/core/ko/studies) | | 노션 스토리 2건(키워드 검색 · 카테고리별 보기)을 한 PRD 로 |
| ST-007 | 크루는 스터디 상세 정보를 볼 수 있다. | 크루 | [PRD](../stories/crew-view-study-detail/PRD.md) | [스터디 상세](https://playground.studyclub-plusplus.com/proto/core/ko/studies/1) | | |
| ST-008 | 크루는 스터디 신청 폼을 제출할 수 있다. | 크루 | [PRD](../stories/crew-submit-application/PRD.md) | [스터디 상세 › 신청하기](https://playground.studyclub-plusplus.com/proto/core/ko/studies/1) | | |
| ST-009 | 크루는 참여 중인 스터디를 모아 볼 수 있다. | 크루 | [PRD](../stories/crew-joined-studies/PRD.md) | [내 스터디](https://playground.studyclub-plusplus.com/proto/core/ko/my/joined) | | |
| ST-010 | 크루는 스터디별 출석 기록을 볼 수 있다. | 크루 | [PRD](../stories/crew-view-attendance-record/PRD.md) | [내 스터디 › 스터디 일정 › 출석부](https://playground.studyclub-plusplus.com/proto/core/ko/my/joined) | | 스터디 일정 출석부 탭의 크루 보기 |
| ST-011 | 크루는 발표자를 신청할 수 있다. | 크루 | [PRD](../stories/crew-apply-presenter/PRD.md) | [내 스터디 › 스터디 일정](https://playground.studyclub-plusplus.com/proto/core/ko/my/joined) | | |
| ST-012 | 크루는 프로필을 수정할 수 있다. | 크루 | [PRD](../stories/crew-edit-profile/PRD.md) | [마이페이지](https://playground.studyclub-plusplus.com/proto/core/ko/my) | | |
| ST-013 | 크루는 회원에서 탈퇴할 수 있다. | 크루 | [PRD](../stories/crew-leave/PRD.md) | [회원 탈퇴](https://playground.studyclub-plusplus.com/proto/core/ko/my/leave) | | |
| ST-014 | 크루는 이용약관과 개인정보처리방침을 확인할 수 있다. | 크루 | [PRD](../stories/crew-view-terms-privacy/PRD.md) | [이용약관](https://playground.studyclub-plusplus.com/proto/core/ko/terms) | | |
| ST-015 | 네비게이터는 스터디 회차를 등록할 수 있다. | 네비게이터 | [PRD](../stories/navigator-register-sessions/PRD.md) | [내 스터디 › 스터디 일정](https://playground.studyclub-plusplus.com/proto/core/ko/my/joined) | | 일정 · 출석부 · 규칙 · 킥오프 |
| ST-016 | 네비게이터는 스터디별 공지를 등록할 수 있다. | 네비게이터 |  |  | | 프로토타입 없음 — PRD 작성 전 |
| ST-017 | 네비게이터는 스터디별 출석 상태를 수정할 수 있다. | 네비게이터 | [PRD](../stories/navigator-edit-attendance/PRD.md) | [내 스터디 › 스터디 일정 › 출석부](https://playground.studyclub-plusplus.com/proto/core/ko/my/joined) | | |
| ST-018 | 네비게이터는 참여자를 스터디에서 제명할 수 있다. | 네비게이터 |  |  | | 프로토타입 없음 — PRD 작성 전 |
| ST-019 | 캡틴은 백오피스에 접근할 수 있다. | 캡틴 |  |  | | 프로토타입 없음 — PRD 작성 전. 접근 판정은 [POL-0001](policies/POL-0001-roles.md) |
| ST-020 | 캡틴은 등록한 스터디를 공개할 수 있다. | 캡틴 | [PRD](../stories/captain-publish-study/PRD.md) | [콘솔 › 스터디](https://playground.studyclub-plusplus.com/proto/console/studies) | | |
| ST-021 | 캡틴은 기존 스터디를 재등록할 수 있다(기수제). | 캡틴 | [PRD](../stories/captain-reregister-cohort/PRD.md) | [콘솔 › 스터디 상세](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-022 | 캡틴은 모든 스터디의 리스트를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-list-all-studies/PRD.md) | [콘솔 › 스터디](https://playground.studyclub-plusplus.com/proto/console/studies) | | |
| ST-023 | 캡틴은 스터디 신청용 폼을 작성할 수 있다. | 캡틴 | [PRD](../stories/captain-application-form/PRD.md) | [콘솔 › 스터디 상세 › 신청 폼](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-024 | 캡틴은 스터디 신청서 결과를 모아볼 수 있다. | 캡틴 | [PRD](../stories/captain-application-results/PRD.md) | [콘솔 › 스터디 상세 › 신청 결과](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-025 | 캡틴은 스터디 신청자를 보고 반을 결정할 수 있다. | 캡틴 | [PRD](../stories/captain-assign-classes/PRD.md) | [콘솔 › 스터디 상세 › 신청자](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-026 | 캡틴은 개별 스터디의 참석자를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-view-attendees/PRD.md) | [콘솔 › 스터디 상세 › 신청자](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-027 | 캡틴은 스터디별 출석명부를 볼 수 있다. | 캡틴 | [PRD](../stories/captain-view-attendance-roster/PRD.md) | [콘솔 › 스터디 상세 › 출석](https://playground.studyclub-plusplus.com/proto/console/studies/1) | | |
| ST-028 | 캡틴은 전체 회원 리스트를 조회할 수 있다. | 캡틴 | [PRD](../stories/captain-list-users/PRD.md) | [콘솔 › 유저](https://playground.studyclub-plusplus.com/proto/console/users) | | |
| ST-029 | 캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다. | 캡틴 | [PRD](../stories/captain-grant-roles/PRD.md) | [콘솔 › 유저](https://playground.studyclub-plusplus.com/proto/console/users) | | |
| ST-030 | 캡틴은 알림 템플릿과 발송 이력을 조회할 수 있다. | 캡틴 |  |  | | 프로토타입 없음 — PRD 작성 전 |
