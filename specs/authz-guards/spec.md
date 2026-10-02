# 요청 인가 가드 — `@RequireAdmin` · `@RequireCaptainOrNavigator` · `@RequireOnboarding`

> 관련: [back-office-login](../back-office-login/spec.md) 한계/후속 · [user-onboarding](../user-onboarding/spec.md) · [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md) · `RequireOnboarding` / `OnboardingGuardInterceptor` / `StudyCaptainGuard`

백오피스·회원·스터디 관리 API에 **요청마다** 인가를 건다. **사이트 전체 캡틴 판정과 스터디 범위(캡틴·네비게이터) 판정은 어노테이션(+ 인터셉터)으로 통일**하고, 서비스의 `assertCaptain` / `assertCaptainOrNavigator` / 인라인 `SYSTEM_ROLE` 검사는 **치환·제거**한다. JWT에 role claim을 넣지 않는다. 역할 부여(`PATCH …/role`)는 [back-office-login 2단계](../back-office-login/spec.md#2단계--역할-부여-별도-pr) — **범위 밖**.

---

## WHAT

### 문제

1. `platform=BACK_OFFICE` 로그인은 ADMIN만 통과하지만, **이후 요청은 role을 안 본다.** MEMBER JWT로 `GET /accounts`, `GET /api/admin/notifications` 등이 통과한다.
2. 캡틴/네비게이터 검사가 **서비스 인라인·`StudyCaptainGuard` 호출·미부착**으로 흩어져 있다. 출석 upsert는 네비게이터만 보고 캡틴(`SYSTEM_ROLE=ADMIN`)을 빠뜨리는 등 POL-0001과 어긋난다.
3. `@RequireOnboarding`은 있으나 **`ParticipantHubController`에만** 붙어 있어, user-onboarding의 「회원 전용 = 미완료면 403 `ONBOARDING_REQUIRED`」와 어긋난다.

### 목표

| 가드 | 상태 | 이번 할 일 |
|------|------|------------|
| `@RequireAdmin` | 없음 | 신설. 요청마다 DB에서 `SYSTEM_ROLE=ADMIN`. **사이트 전체 캡틴 API**에 부착하고 서비스 `assertCaptain`/인라인 ADMIN **제거** |
| `@RequireCaptainOrNavigator` | 없음 | 신설. path `{studyId}` 기준 캡틴 **또는** 담당 스터디 네비게이터. 서비스 `assertCaptainOrNavigator` **치환**. 출석 upsert/GET·스터디 수정·신청 폼 저장 등 |
| `@RequireOnboarding` | 있음 | 회원 전용 API 부착 범위 정리 (인터셉터 유지) |

### 하지 않는 것

- JWT role claim / refresh 정책 변경 (back-office-login에서 기각)
- `PATCH /accounts/{id}/role` (2단계)
- 네비게이터 백오피스 진입
- `CO_LEADER` enum/데이터 삭제 (POL-0001은 없애기로 했으나 정리는 별도 — 가드는 당분간 LEADER+CO_LEADER를 네비게이터로 본다)
- Discord API 키 체인·공개 스터디 목록/상세

---

## HOW

### 판정 층

| 층 | 판정 | 수단 (이번) |
|----|------|-------------|
| 계정 — 캡틴 | `SYSTEM_ROLE = ADMIN` | **`@RequireAdmin` + `AdminGuardInterceptor`** |
| 스터디 — 캡틴 또는 네비게이터 | ADMIN **이거나** `PARTICIPANT_ROLE ∈ {LEADER, CO_LEADER}` (해당 `studyId`) | **`@RequireCaptainOrNavigator` + 인터셉터** (판정 로직은 기존 `StudyCaptainGuard`와 동일, **호출은 어노테이션만**) |
| 계정 — 온보딩 | `ONBOARDING_COMPLETED_AT IS NOT NULL` | **`@RequireOnboarding`** (기존) |

백오피스·사이트 전체 ADMIN API는 **캡틴만**. 네비게이터 백오피스 진입은 열지 않음.  
용어: `SYSTEM_ROLE=ADMIN` ≈ 캡틴, `MEMBER` ≈ 크루. 네비게이터는 `SYSTEM_ROLE`이 아님.

### `@RequireAdmin` (신설)

1. `@RequireAdmin`(클래스/메서드) → 인터셉터 실행
2. principal(`JWT sub` = `ACCOUNT.ID`) 없거나 계정 없음 → `401 UNAUTHORIZED`
3. `SYSTEM_ROLE != ADMIN` → `403 FORBIDDEN`
4. JWT 형식 불변. 강등은 다음 요청부터 반영

`WebConfig`에 등록. **기본은 미적용**(명시 부착만).

**치환:** 컨트롤러/서비스의 `assertCaptain`·인라인 `SYSTEM_ROLE=ADMIN` 검사를 떼고 어노테이션으로 옮긴다. 상세는 표 A.

### `@RequireCaptainOrNavigator` (신설)

1. 핸들러에 어노테이션이 있으면 인터셉터가 path variable `studyId`를 읽는다 (`studyId` 없으면 구현 오류 — 부착 금지).
2. principal 없거나 계정 없음 → `401`
3. 캡틴이 아니고 해당 스터디 네비게이터도 아니면 → `403 FORBIDDEN`
4. 판정은 `StudyCaptainGuard.assertCaptainOrNavigator`와 **동일 규칙**. 서비스에서는 **호출하지 않는다** (어노테이션이 SSOT).

출석 upsert/GET, 사이트 스터디 수정, 사이트 신청 폼 **저장(PUT)** 등에 붙인다. 상세는 표 B.

### `@RequireOnboarding` (기존)

1. principal 없으면 `401`
2. 온보딩 미완료 → `403 ONBOARDING_REQUIRED`
3. 온보딩·`/auth/me`·닉네임 availability·탈퇴 등 **의도적 미완료 허용** API에는 붙이지 않음 (표 D)

### 신청 폼 GET — 공개 분기 주의

`GET /api/studies/{studyId}/application-form` 은 **OPEN·비숨김이면 비로그인 공개 조회**가 가능하다.  
여기에 `@RequireAdmin` / `@RequireCaptainOrNavigator` / `@RequireOnboarding` 을 **무조건 붙이면 공개 폼이 막힌다.**  
이번에도 **가드 어노테이션을 붙이지 않는다.** DRAFT·숨김 등 비공개 분기의 권한은 **서비스 기존 분기 유지**(필요 시만 내부에서 캡틴·네비게이터 판정). 백오피스 `GET /api/admin/.../application-form` 은 `@RequireAdmin`으로 캡틴만.

---

## 화면 × API × 필요 권한

> beta 기준. 「이번 변경」= 이 스펙 구현 PR 범위. 「예정」= 미구현.

### A. 캡틴만 — `@RequireAdmin` (서비스 캡틴 검사 제거)

| 화면 | Method | Path | 지금 | 이번 |
|------|--------|------|------|------|
| 유저 목록 | GET | `/accounts` | 인증만 **구멍** | **`@RequireAdmin`** |
| 알림 템플릿 | GET | `/api/admin/notification-templates` | 인증만 **구멍** | **클래스 `@RequireAdmin`** |
| 알림 이력 | GET | `/api/admin/notifications` | 인증만 **구멍** | 동일 |
| 신청 폼 (BO) | GET/PUT | `/api/admin/studies/{studyId}/application-form` | `assertCaptain` | **`@RequireAdmin`**, `assertCaptain` **제거** |
| 신청 결과 (BO) | GET | `/api/admin/studies/{studyId}/applications` | `assertCaptain` | 동일 |
| 디스코드 연결 | POST | `/api/admin/studies/{studyId}/discord-link` | `assertCaptain` | 동일 |
| 스터디 등록 | POST | `/api/studies` | 인라인 ADMIN | **`@RequireAdmin`**, 인라인 **제거** |
| 스터디 삭제 | DELETE | `/api/studies/{studyId}` | 인라인 ADMIN | 동일 |
| 역할 변경 | PATCH | `/accounts/{id}/role` | 미구현 | **예정** (구현 시 `@RequireAdmin`) |

### B. 스터디 범위 — `@RequireCaptainOrNavigator` (+ 필요 시 온보딩)

| 화면 | Method | Path | 지금 | 이번 |
|------|--------|------|------|------|
| 스터디 수정 | PATCH | `/api/studies/{studyId}` | `assertCaptainOrNavigator` | **`@RequireCaptainOrNavigator`**, Guard 호출 **제거** |
| 신청 폼 저장 | PUT | `/api/studies/{studyId}/application-form` | `assertCaptainOrNavigator` | **`@RequireCaptainOrNavigator` + `@RequireOnboarding`**, Guard 호출 **제거** |
| 신청 폼 조회 | GET | 동일 | 공개/편집 분기 | **변경 없음** (어노테이션 **금지** — [위 주의](#신청-폼-get--공개-분기-주의)) |
| 출석 upsert | POST | `/api/studies/{studyId}/attendances` | LEADER/CO_LEADER만 (캡틴 미포함) | **`@RequireCaptainOrNavigator` + `@RequireOnboarding`**, 인라인 역할 검사 **제거** (POL-0001) |
| 출석 명부 | GET | 동일 | 인증만 | **`@RequireCaptainOrNavigator` + `@RequireOnboarding`** — 캡틴·담당 네비게이터만 |

### C. 회원 전용 · 온보딩

| 화면 | Method | Path | 지금 | 이번 |
|------|--------|------|------|------|
| 내 스터디 허브·상세 | GET | `/api/me/studies`… | `@RequireOnboarding` | 유지 |
| 북마크 목록 | GET | `/api/me/bookmarks` | 인증만 | **`@RequireOnboarding`** |
| 북마크 추가/해제 | POST/DELETE | `/api/me/bookmarks/...` | 미구현 | **예정** (구현 시 온보딩) |
| 탈퇴 | DELETE | `/api/me` | — | **예정** — 가드 **금지** ([user-leave](../user-leave/spec.md)) |
| 신청 제출 등 | POST | `/api/studies/.../applications` | 미구현 | **예정** |

### D. 가드 금지 (의도적)

`POST /auth/social-login` · `POST /auth/refresh` · `GET /auth/me` · `POST /accounts/onboarding` · `GET /api/nicknames/availability` · **`GET /api/studies/{studyId}/application-form`** (공개 분기)

### E. 범위 밖 (참고)

공개 스터디 목록/상세 · Discord API 키 체인(`POST /api/discord/.../attendances`)

---

## API · 에러 계약

새 엔드포인트 없음.

| 조건 | HTTP | errorCode |
|------|------|-----------|
| 미인증·계정 없음 | 401 | `UNAUTHORIZED` |
| `@RequireAdmin` / `@RequireCaptainOrNavigator` 실패 | 403 | `FORBIDDEN` |
| `@RequireOnboarding` 실패 | 403 | `ONBOARDING_REQUIRED` |

로그인 화면 문구와 API `FORBIDDEN` 본문은 **통일하지 않음**.  
프론트: `ONBOARDING_REQUIRED` → onboarding 페이지 · `FORBIDDEN` → 권한 없음 UI.

---

## 백엔드 구현 지점

- 신설: `RequireAdmin` + `AdminGuardInterceptor` · `RequireCaptainOrNavigator` + 인터셉터 (`studyId` path) — `WebConfig` 등록. 스터디 범위 판정은 `StudyCaptainGuard` 로직 재사용 가능하되 **서비스 직접 호출은 제거**
- 부착: 표 A·B·C 「이번」열
- 제거: 해당 API의 `assertCaptain` / `assertCaptainOrNavigator` / 출석 upsert 인라인 LEADER 검사 / 스터디 등록·삭제 인라인 ADMIN
- 테스트:
  - MEMBER → 표 A API 403 `FORBIDDEN`
  - 비네비게이터 MEMBER → 표 B(출석 GET/POST 등) 403
  - 캡틴 또는 담당 네비게이터 → 표 B 통과 (출석 upsert에 캡틴 포함)
  - 온보딩 미완료 → 온보딩 대상 403 `ONBOARDING_REQUIRED`
  - `GET …/application-form` 공개 스터디는 **비로그인 200** 유지
- 문서: back-office-login 한계/후속·notification 「백오피스 인가」에 이 스펙 링크

프론트 전용 작업 필수 아님(이미 `role !== 'ADMIN'` 쿠키 차단). **서버 가드가 SSOT.**

---

## 한계 / 후속

- 역할 부여 API·화면 (BO 2단계) — 구현 시 `@RequireAdmin`
- 표 「예정」행의 `@RequireOnboarding` — 각 기능 스펙 구현 시 표 갱신
- 네비게이터 백오피스 접근 · `CO_LEADER` 제거 · JWT role claim — 기존 결정 유지
