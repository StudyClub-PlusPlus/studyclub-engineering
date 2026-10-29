# Information Architecture

> 화면·섹션 단위 노드 트리. Story ↔ IA 는 **N:N** (한 Story 가 여러 화면에 걸칠 수 있음).
> 노드에 Story 가 하나도 없으면 **고아 화면**이다 — 설계 누락 신호이므로 플래그한다.
>
> Story 번호(ST-xxx)의 정규문장 · PRD · 스펙은 [Story 레지스트리](stories.md)가 정본이다. 아래 [페이지별 유저스토리](#페이지별-유저스토리)는 그 표를 화면 쪽에서 다시 묶은 것이다 — 문장이 바뀌면 레지스트리를 먼저 고치고 여기를 맞춘다.
>
> 경로는 playground 프로토타입 기준이다. 사용자 사이트는 `/proto/core/{locale}`, 운영 콘솔은 `/proto/console` 아래.
> 실서비스(core-front · back-office-front)는 앞의 `/proto/core` · `/proto/console` 를 뗀 같은 경로를 쓴다.
> 2026-10-06 프로토 라우트(`frontend/apps/playground/src/app/(proto)/proto`)에서 처음 채웠다. 2026-10-15 운영 콘솔 일정 탭 · 알림 화면을 더하고 Story 레지스트리와 연결했다.

## 노드

### 사용자 사이트 (core)

| IA | 이름 | 경로 | 부모 | 호스팅 Story | 비고 |
|---|---|---|---|---|---|
| IA-001 | 사용자 사이트 홈 | `/` | — | ST-006 | 추천 스터디 · 행사 · 가입 안내 — 스터디 둘러보기 입구 |
| IA-002 | 로그인 | `/login` | IA-001 | ST-005 | Google 로그인 |
| IA-003 | 온보딩 | `/onboarding` | IA-002 | ST-005 · ST-014 | 약관 동의 · 닉네임 · 시간대 |
| IA-004 | 스터디 목록 | `/studies` | IA-001 | ST-006 | 검색 · 카테고리 · 상태 필터 |
| IA-005 | 스터디 상세 | `/studies/{id}` | IA-004 | ST-007 | |
| IA-006 | 신청 폼 (모달) | `/studies/{id}` › 신청하기 | IA-005 | ST-008 | 섹션 노드 — 주소 없음. 담당 캡틴도 참여하려면 여기서 신청한다 |
| IA-007 | 마이페이지 | `/my` | IA-001 | ST-012 | 내 정보 · 프로필 수정 |
| IA-008 | 회원 탈퇴 | `/my/leave` | IA-007 | ST-013 | |
| IA-009 | 내 스터디 | `/my/joined` | IA-007 | ST-009 | 주간 일정 · 정렬 · 역할 필터 |
| IA-010 | 스터디 일정 — 일정 탭 | `/my/joined/{id}/schedule` | IA-009 | ST-015 · ST-011 | 정보 카드 · 규칙 · 회차 표(선택 · 일괄 삭제) · 발표 신청 |
| IA-011 | 스터디 일정 — 출석 탭 | `/my/joined/{id}/schedule/attendance` | IA-010 | ST-017 · ST-010 · ST-018 | 고치기 · 참여 중단(캡틴·네비게이터) · 보기(크루). 옛 `/my/joined/{id}/attendance` 는 여기로 보낸다 |
| IA-038 | 스터디 일정 — 공지 탭 | `/my/joined/{id}/schedule/notice` | IA-010 | ST-016 | 받는 사람 고르기 · 메일·디스코드 보내기 · 보낸 공지 기록(캡틴·네비게이터만 보인다) |
| IA-012 | 찜한 스터디 | `/my/saved` | IA-007 | — | **고아** — 찜 Story 가 없다 (스펙: `specs/study-bookmark`). 내 스터디에서 버튼은 뺐다 |
| IA-013 | 옛 내 스터디(출석) | `/my/studies` | IA-007 | — | **고아** — 내 스터디(IA-009) 이전 화면. 정리 대상 |
| IA-036 | 내 문의 | `/my/feedbacks` · `/my/feedbacks/{id}` | IA-007 | ST-035 | 목록 · 문의하기 팝업 · 상세(답변). 프로필 드롭다운에서 들어온다 |
| IA-014 | 이용약관 | `/terms` | IA-001 | ST-014 | 푸터 링크 |
| IA-015 | 개인정보 처리방침 | `/privacy` | IA-001 | ST-014 | 푸터 링크 |
| IA-016 | 소개 | `/about` | IA-001 | — | **고아** — Story 없음 |
| IA-017 | 가이드 | `/guide` | IA-001 | — | **고아** — Story 없음 |
| IA-018 | 공지 | `/notices` · `/notices/{id}` | IA-001 | ST-034 | 목록 · 상세. 비로그인도 본다. 스터디별 공지(ST-016)와 다르다 |
| IA-019 | 행사 목록 | `/events` | IA-001 | — | **고아** — 행사 Story 없음 |
| IA-020 | 행사 상세 | `/events/{id}` | IA-019 | — | **고아** |

### 운영 콘솔 (console)

| IA | 이름 | 경로 | 부모 | 호스팅 Story | 비고 |
|---|---|---|---|---|---|
| IA-021 | 대시보드 | `/` | — | ST-002 | 콘솔 진입 조건(옛 ST-019, 폐기)은 [POL-0001](policies/POL-0001-roles.md) |
| IA-022 | 스터디 관리 | `/studies` | IA-021 | ST-022 · ST-020 | 목록 · 공개 설정 |
| IA-023 | 스터디 등록 (모달) | `/studies` › 스터디 등록 | IA-022 | ST-001 | 섹션 노드 |
| IA-024 | 스터디 상세 | `/studies/{id}` | IA-022 | ST-003 | 머리 · 탭 |
| IA-025 | 정보 탭 | `/studies/{id}` › 정보 | IA-024 | ST-004 · ST-021 | 수정 · 삭제 · 다음 기수 만들기 |
| IA-026 | 신청 폼 탭 | `/studies/{id}` › 신청 폼 | IA-024 | ST-023 | |
| IA-027 | 신청 결과 탭 | `/studies/{id}` › 신청 결과 | IA-024 | ST-024 | |
| IA-028 | 신청자 탭 | `/studies/{id}` › 신청자 | IA-024 | ST-026 · ST-025 | 반 목록(제목) · 참여 크루 명단 · 반 · 역할 · 일괄 변경 |
| IA-032 | 일정 탭 | `/studies/{id}` › 일정 | IA-024 | ST-025 · ST-015 | 반별 스터디 시간 · 회차 표(사용자 사이트 IA-010 과 같은 표) |
| IA-029 | 출석 탭 | `/studies/{id}` › 출석 | IA-024 | ST-027 · ST-017 · ST-018 | 반 칩으로 한 반씩 · 일괄 출석 · 참여 중단 |
| IA-030 | 유저 | `/users` | IA-021 | ST-028 · ST-029 | 회원 목록 · 권한 칸 · 기본 권한 표 |
| IA-035 | 공지 관리 | `/notices` | IA-021 | ST-033 | 목록 · 등록·편집 팝업 · 삭제. 사용자 사이트 IA-018 과 같은 데이터 |
| IA-037 | 문의·오류 신고 | `/feedbacks` · `/feedbacks/{id}` | IA-021 | ST-036 | 목록 · 상세(상태 · 회신 · 캡틴 전용 메모) |
| IA-033 | 알림 발송 이력 | `/notifications` | IA-021 | ST-032 | 실패 건 재발송 |
| IA-034 | 알림 템플릿 | `/notifications/templates` | IA-033 | ST-030 | 보기 · 추가 |
| IA-031 | 행사 | `/events` | IA-021 | — | **고아** — 행사 Story 없음 |

### 아직 화면이 없는 Story

| Story | 들어갈 자리(안) |
|---|---|
| (없음) | |

## 페이지별 유저스토리

> 이 화면에서 어떤 유저스토리를 구현하는가. 문장 · PRD 는 [Story 레지스트리](stories.md)에서 옮겼다.

### 사용자 사이트

| IA | 화면 | 구현하는 유저스토리 | PRD |
|---|---|---|---|
| IA-001 | 홈 | ST-006 크루는 스터디를 키워드로 검색하고 카테고리별로 나눠 볼 수 있다. | [crew-browse-studies](../stories/crew-browse-studies/PRD.md) |
| IA-002 | 로그인 | ST-005 크루는 Google 계정으로 로그인하고 온보딩을 마칠 수 있다. | [crew-google-login-onboarding](../stories/crew-google-login-onboarding/PRD.md) |
| IA-003 | 온보딩 | ST-005 크루는 Google 계정으로 로그인하고 온보딩을 마칠 수 있다. | [crew-google-login-onboarding](../stories/crew-google-login-onboarding/PRD.md) |
| | | ST-014 크루는 이용약관과 개인정보처리방침을 확인할 수 있다. | [crew-view-terms-privacy](../stories/crew-view-terms-privacy/PRD.md) |
| IA-004 | 스터디 목록 | ST-006 크루는 스터디를 키워드로 검색하고 카테고리별로 나눠 볼 수 있다. | [crew-browse-studies](../stories/crew-browse-studies/PRD.md) |
| IA-005 | 스터디 상세 | ST-007 크루는 스터디 상세 정보를 볼 수 있다. | [crew-view-study-detail](../stories/crew-view-study-detail/PRD.md) |
| IA-006 | 신청 폼 (모달) | ST-008 크루는 스터디 신청 폼을 제출할 수 있다. | [crew-submit-application](../stories/crew-submit-application/PRD.md) |
| IA-007 | 마이페이지 | ST-012 크루는 프로필을 수정할 수 있다. | [crew-edit-profile](../stories/crew-edit-profile/PRD.md) |
| IA-036 | 내 문의 | ST-035 크루는 캡틴에게 문의/오류신고를 제출할 수 있다. | [crew-submit-feedback](../stories/crew-submit-feedback/PRD.md) |
| IA-008 | 회원 탈퇴 | ST-013 크루는 회원에서 탈퇴할 수 있다. | [crew-leave](../stories/crew-leave/PRD.md) |
| IA-009 | 내 스터디 | ST-009 크루는 참여 중인 스터디를 모아 볼 수 있다. | [crew-joined-studies](../stories/crew-joined-studies/PRD.md) |
| IA-010 | 스터디 일정 — 일정 탭 | ST-015 네비게이터는 스터디 회차를 등록할 수 있다. | [navigator-register-sessions](../stories/navigator-register-sessions/PRD.md) |
| | | ST-011 크루는 발표자를 신청할 수 있다. | [crew-apply-presenter](../stories/crew-apply-presenter/PRD.md) |
| IA-011 | 스터디 일정 — 출석 탭 | ST-017 네비게이터는 스터디별 출석 상태를 수정할 수 있다. | [navigator-edit-attendance](../stories/navigator-edit-attendance/PRD.md) |
| IA-038 | 스터디 일정 — 공지 탭 | ST-016 네비게이터는 스터디별 공지를 등록할 수 있다. | [navigator-study-notice](../stories/navigator-study-notice/PRD.md) |
| | | ST-010 크루는 스터디별 출석 기록을 볼 수 있다. | [crew-view-attendance-record](../stories/crew-view-attendance-record/PRD.md) |
| | | ST-018 네비게이터는 참여자를 스터디에서 제명할 수 있다. | [navigator-withdraw-participant](../stories/navigator-withdraw-participant/PRD.md) |
| IA-014 | 이용약관 | ST-014 크루는 이용약관과 개인정보처리방침을 확인할 수 있다. | [crew-view-terms-privacy](../stories/crew-view-terms-privacy/PRD.md) |
| IA-015 | 개인정보 처리방침 | ST-014 크루는 이용약관과 개인정보처리방침을 확인할 수 있다. | [crew-view-terms-privacy](../stories/crew-view-terms-privacy/PRD.md) |
| IA-018 | 공지 | ST-034 크루는 스터디클럽 공지를 확인할 수 있다. | [crew-view-notices](../stories/crew-view-notices/PRD.md) |

### 운영 콘솔

| IA | 화면 | 구현하는 유저스토리 | PRD |
|---|---|---|---|
| IA-021 | 대시보드 | ST-002 캡틴은 운영 현황을 한 화면에서 볼 수 있다. | [console-dashboard](../stories/console-dashboard/PRD.md) |
| IA-022 | 스터디 관리 | ST-022 캡틴은 모든 스터디의 리스트를 볼 수 있다. | [captain-list-all-studies](../stories/captain-list-all-studies/PRD.md) |
| | | ST-020 캡틴은 등록한 스터디를 공개할 수 있다. | [captain-publish-study](../stories/captain-publish-study/PRD.md) |
| IA-023 | 스터디 등록 (모달) | ST-001 캡틴은 스터디를 등록할 수 있다. | [study-create](../stories/study-create/PRD.md) |
| IA-024 | 스터디 상세 | ST-003 캡틴은 개별 스터디의 운영 현황을 볼 수 있다. | [study-detail](../stories/study-detail/PRD.md) |
| IA-025 | 정보 탭 | ST-004 캡틴은 등록된 스터디를 수정·삭제할 수 있다. | [study-edit](../stories/study-edit/PRD.md) |
| | | ST-021 캡틴은 기존 스터디를 재등록할 수 있다(기수제). | [captain-reregister-cohort](../stories/captain-reregister-cohort/PRD.md) |
| IA-026 | 신청 폼 탭 | ST-023 캡틴은 스터디 신청용 폼을 작성할 수 있다. | [captain-application-form](../stories/captain-application-form/PRD.md) |
| IA-027 | 신청 결과 탭 | ST-024 캡틴은 스터디 신청서 결과를 모아볼 수 있다. | [captain-application-results](../stories/captain-application-results/PRD.md) |
| IA-028 | 신청자 탭 | ST-026 캡틴은 개별 스터디의 참석자를 볼 수 있다. | [captain-view-attendees](../stories/captain-view-attendees/PRD.md) |
| | | ST-025 캡틴은 스터디 신청자를 보고 반을 결정할 수 있다. | [captain-assign-classes](../stories/captain-assign-classes/PRD.md) |
| IA-032 | 일정 탭 | ST-025 캡틴은 스터디 신청자를 보고 반을 결정할 수 있다. — 반별 스터디 시간 | [captain-assign-classes](../stories/captain-assign-classes/PRD.md) |
| | | ST-015 네비게이터는 스터디 회차를 등록할 수 있다. — 회차 표 | [navigator-register-sessions](../stories/navigator-register-sessions/PRD.md) |
| IA-029 | 출석 탭 | ST-027 캡틴은 스터디별 출석명부를 볼 수 있다. | [captain-view-attendance-roster](../stories/captain-view-attendance-roster/PRD.md) |
| | | ST-017 네비게이터는 스터디별 출석 상태를 수정할 수 있다. — 같은 출석부 | [navigator-edit-attendance](../stories/navigator-edit-attendance/PRD.md) |
| | | ST-018 네비게이터는 참여자를 스터디에서 제명할 수 있다. — 같은 참여 중단 | [navigator-withdraw-participant](../stories/navigator-withdraw-participant/PRD.md) |
| IA-030 | 유저 | ST-028 캡틴은 전체 회원 리스트를 조회할 수 있다. | [captain-list-users](../stories/captain-list-users/PRD.md) |
| | | ST-029 캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다. | [captain-grant-roles](../stories/captain-grant-roles/PRD.md) |
| IA-035 | 공지 관리 | ST-033 캡틴은 스터디클럽 웹사이트에 공지를 올릴 수 있다. | [captain-post-notice](../stories/captain-post-notice/PRD.md) |
| IA-037 | 문의·오류 신고 | ST-036 캡틴은 유저가 제출한 문의/오류신고를 조회할 수 있다. | [captain-view-feedbacks](../stories/captain-view-feedbacks/PRD.md) |
| IA-033 | 알림 발송 이력 | ST-032 캡틴은 알림 발송 이력을 조회할 수 있다. | [notification-history](../stories/notification-history/PRD.md) |
| IA-034 | 알림 템플릿 | ST-030 캡틴은 알림 템플릿을 추가, 수정, 삭제할 수 있다. | [notification-template](../stories/notification-template/PRD.md) |

## 트리

```
사용자 사이트 /proto/core/{locale}
IA-001 홈 /
├─ IA-002 로그인 /login
│  └─ IA-003 온보딩 /onboarding
├─ IA-004 스터디 목록 /studies
│  └─ IA-005 스터디 상세 /studies/{id}
│     └─ IA-006 신청 폼 (모달)
├─ IA-007 마이페이지 /my
│  ├─ IA-008 회원 탈퇴 /my/leave
│  ├─ IA-009 내 스터디 /my/joined
│  │  └─ IA-010 스터디 일정 — 일정 /my/joined/{id}/schedule
│  │     └─ IA-011 스터디 일정 — 출석 …/schedule/attendance
│  │     └─ IA-038 스터디 일정 — 공지 …/schedule/notice
│  ├─ IA-012 찜한 스터디 /my/saved            (고아)
│  ├─ IA-013 옛 내 스터디 /my/studies         (고아)
│  └─ IA-036 내 문의 /my/feedbacks
├─ IA-014 이용약관 /terms
├─ IA-015 개인정보 처리방침 /privacy
├─ IA-016 소개 /about                         (고아)
├─ IA-017 가이드 /guide                       (고아)
├─ IA-018 공지 /notices
└─ IA-019 행사 /events                        (고아)
   └─ IA-020 행사 상세 /events/{id}           (고아)

운영 콘솔 /proto/console
IA-021 대시보드 /
├─ IA-022 스터디 관리 /studies
│  ├─ IA-023 스터디 등록 (모달)
│  └─ IA-024 스터디 상세 /studies/{id}
│     ├─ IA-025 정보
│     ├─ IA-026 신청 폼
│     ├─ IA-027 신청 결과
│     ├─ IA-028 신청자
│     ├─ IA-032 일정
│     └─ IA-029 출석
├─ IA-030 유저 /users
├─ IA-035 공지 관리 /notices
├─ IA-037 문의·오류 신고 /feedbacks
├─ IA-033 알림 발송 이력 /notifications
│  └─ IA-034 알림 템플릿 /notifications/templates
└─ IA-031 행사 /events                        (고아)
```
