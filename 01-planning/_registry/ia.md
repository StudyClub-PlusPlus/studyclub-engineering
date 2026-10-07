# Information Architecture

> 화면·섹션 단위 노드 트리. Story ↔ IA 는 **N:N** (한 Story 가 여러 화면에 걸칠 수 있음).
> 노드에 Story 가 하나도 없으면 **고아 화면**이다 — 설계 누락 신호이므로 플래그한다.
>
> 경로는 playground 프로토타입 기준이다. 사용자 사이트는 `/proto/core/{locale}`, 운영 콘솔은 `/proto/console` 아래.
> 실서비스(core-front · back-office-front)는 앞의 `/proto/core` · `/proto/console` 를 뗀 같은 경로를 쓴다.
> 2026-10-06 프로토 라우트(`frontend/apps/playground/src/app/(proto)/proto`)에서 처음 채웠다.

## 노드

### 사용자 사이트 (core)

| IA | 이름 | 경로 | 부모 | 호스팅 Story | 비고 |
|---|---|---|---|---|---|
| IA-001 | 사용자 사이트 홈 | `/` | — | ST-006 | 추천 스터디 · 행사 · 가입 안내 — 스터디 둘러보기 입구 |
| IA-002 | 로그인 | `/login` | IA-001 | ST-005 | Google 로그인 |
| IA-003 | 온보딩 | `/onboarding` | IA-002 | ST-005 · ST-014 | 약관 동의 · 닉네임 · 시간대 |
| IA-004 | 스터디 목록 | `/studies` | IA-001 | ST-006 | 검색 · 카테고리 · 상태 필터 |
| IA-005 | 스터디 상세 | `/studies/{id}` | IA-004 | ST-007 | |
| IA-006 | 신청 폼 (모달) | `/studies/{id}` › 신청하기 | IA-005 | ST-008 | 섹션 노드 — 주소 없음 |
| IA-007 | 마이페이지 | `/my` | IA-001 | ST-012 | 내 정보 · 프로필 수정 |
| IA-008 | 회원 탈퇴 | `/my/leave` | IA-007 | ST-013 | |
| IA-009 | 내 스터디 | `/my/joined` | IA-007 | ST-009 | 주간 일정 · 정렬 · 역할 필터 |
| IA-010 | 스터디 일정 — 일정 탭 | `/my/joined/{id}/schedule` | IA-009 | ST-015 · ST-011 | 정보 카드 · 규칙 · 회차 표 · 발표 신청 |
| IA-011 | 스터디 일정 — 출석부 탭 | `/my/joined/{id}/schedule/attendance` | IA-010 | ST-017 · ST-010 | 고치기(캡틴·네비게이터) · 보기(크루). 옛 `/my/joined/{id}/attendance` 는 여기로 보낸다 |
| IA-012 | 찜한 스터디 | `/my/saved` | IA-007 | — | **고아** — 찜 Story 가 없다 (스펙: `specs/study-bookmark`). 내 스터디에서 버튼은 뺐다 |
| IA-013 | 옛 내 스터디(출석) | `/my/studies` | IA-007 | — | **고아** — 내 스터디(IA-009) 이전 화면. 정리 대상 |
| IA-014 | 이용약관 | `/terms` | IA-001 | ST-014 | 푸터 링크 |
| IA-015 | 개인정보 처리방침 | `/privacy` | IA-001 | ST-014 | 푸터 링크 |
| IA-016 | 소개 | `/about` | IA-001 | — | **고아** — Story 없음 |
| IA-017 | 가이드 | `/guide` | IA-001 | — | **고아** — Story 없음 |
| IA-018 | 공지 | `/notices` | IA-001 | — | **고아** — 사이트 공지 Story 없음. 스터디별 공지(ST-016)와 다르다 |
| IA-019 | 행사 목록 | `/events` | IA-001 | — | **고아** — 행사 Story 없음 |
| IA-020 | 행사 상세 | `/events/{id}` | IA-019 | — | **고아** |

### 운영 콘솔 (console)

| IA | 이름 | 경로 | 부모 | 호스팅 Story | 비고 |
|---|---|---|---|---|---|
| IA-021 | 대시보드 | `/` | — | ST-002 · ST-019 | 콘솔 진입 = 백오피스 접근(ST-019, PRD 없음) |
| IA-022 | 스터디 관리 | `/studies` | IA-021 | ST-022 · ST-020 | 목록 · 공개 설정 |
| IA-023 | 스터디 등록 (모달) | `/studies` › 스터디 등록 | IA-022 | ST-001 | 섹션 노드 |
| IA-024 | 스터디 상세 | `/studies/{id}` | IA-022 | ST-003 | 머리 · 탭 |
| IA-025 | 정보 탭 | `/studies/{id}` › 정보 | IA-024 | ST-004 · ST-021 | 수정 · 삭제 · 다음 기수 만들기 |
| IA-026 | 신청 폼 탭 | `/studies/{id}` › 신청 폼 | IA-024 | ST-023 | |
| IA-027 | 신청 결과 탭 | `/studies/{id}` › 신청 결과 | IA-024 | ST-024 | |
| IA-028 | 신청자 탭 | `/studies/{id}` › 신청자 | IA-024 | ST-026 · ST-025 | 참여 명단 · 담당 · 반 편성 |
| IA-029 | 출석 탭 | `/studies/{id}` › 출석 | IA-024 | ST-027 | 스터디 전체 참여자 출석부 |
| IA-030 | 유저 | `/users` | IA-021 | ST-028 · ST-029 | 회원 목록 · 권한 칸 · 기본 권한 표 |
| IA-031 | 행사 | `/events` | IA-021 | — | **고아** — 행사 Story 없음 |

### 아직 화면이 없는 Story

| Story | 들어갈 자리(안) |
|---|---|
| ST-016 네비게이터는 스터디별 공지를 등록할 수 있다. | IA-010 스터디 일정 (공지 탭 또는 정보 카드) |
| ST-018 네비게이터는 참여자를 스터디에서 제명할 수 있다. | IA-011 출석부 또는 IA-028 신청자 탭 |
| ST-030 캡틴은 알림 템플릿과 발송 이력을 조회할 수 있다. | 운영 콘솔 새 노드 (`/notifications`) |

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
│  │     └─ IA-011 스터디 일정 — 출석부 …/schedule/attendance
│  ├─ IA-012 찜한 스터디 /my/saved            (고아)
│  └─ IA-013 옛 내 스터디 /my/studies         (고아)
├─ IA-014 이용약관 /terms
├─ IA-015 개인정보 처리방침 /privacy
├─ IA-016 소개 /about                         (고아)
├─ IA-017 가이드 /guide                       (고아)
├─ IA-018 공지 /notices                       (고아)
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
│     └─ IA-029 출석
├─ IA-030 유저 /users
└─ IA-031 행사 /events                        (고아)
```
