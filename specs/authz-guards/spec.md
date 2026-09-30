# 요청 인가 가드 — `@RequireAdmin` · `@RequireOnboarding`

> 관련: [back-office-login](../back-office-login/spec.md) 한계/후속 · [user-onboarding](../user-onboarding/spec.md) · [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md) · `RequireOnboarding` / `OnboardingGuardInterceptor` / `StudyCaptainGuard`

백오피스·회원 API에 **요청마다** 인가를 건다. JWT에 role claim을 넣지 않는다. 역할 부여(`PATCH …/role`)는 [back-office-login 2단계](../back-office-login/spec.md#2단계--역할-부여-별도-pr) — **범위 밖**.

---

## WHAT

### 문제

1. `platform=BACK_OFFICE` 로그인은 ADMIN만 통과하지만, **이후 요청은 role을 안 본다.** MEMBER JWT로 `GET /accounts`, `GET /api/admin/notifications` 등이 통과한다.
2. `@RequireOnboarding`은 있으나 **`ParticipantHubController`에만** 붙어 있어, user-onboarding의 「회원 전용 = 미완료면 403 `ONBOARDING_REQUIRED`」와 어긋난다.

### 목표

| 가드 | 상태 | 이번 할 일 |
|------|------|------------|
| `@RequireOnboarding` | 있음 | 회원 전용 API 부착 범위 정리 (인터셉터 유지) |
| `@RequireAdmin` | 없음 | 동일 패턴으로 신설. 요청마다 DB에서 `SYSTEM_ROLE=ADMIN` 확인. **구멍 API에만** 부착 |

### 하지 않는 것

- JWT role claim / refresh 정책 변경 (back-office-login에서 기각)
- `PATCH /accounts/{id}/role` (2단계)
- 이미 `assertCaptain`·인라인 ADMIN인 API에 어노테이션 추가·전면 치환 → 후속 가능안은 [논의점](#논의점)
- 출석 upsert의 ADMIN(캡틴) 통과 여부 수정 → [논의점 §2](#2-출석-upsert--admin캡틴)
- `StudyCaptainGuard`(스터디 범위)를 어노테이션으로 대체

---

## HOW

### 판정 층

| 층 | 판정 | 수단 |
|----|------|------|
| 계정 — 캡틴 | `SYSTEM_ROLE = ADMIN` | **`@RequireAdmin` + `AdminGuardInterceptor`** (신설, 구멍만) |
| 계정 — 온보딩 | `ONBOARDING_COMPLETED_AT IS NOT NULL` | **`@RequireOnboarding`** (기존) |
| 스터디 — 네비게이터 | `PARTICIPANT_ROLE ∈ {LEADER, CO_LEADER}` (+ 캡틴 정책) | **`StudyCaptainGuard`** (유지, 어노테이션 대체 안 함) |

백오피스·사이트 전체 ADMIN API는 **캡틴만**. 네비게이터 백오피스 진입은 열지 않음.  
용어: `SYSTEM_ROLE=ADMIN` ≈ 캡틴, `MEMBER` ≈ 크루. 네비게이터는 `SYSTEM_ROLE`이 아님.

### `@RequireAdmin` (신설)

방식은 back-office-login 한계/후속에서 확정됨.

1. `@RequireAdmin`(클래스/메서드) → 인터셉터 실행
2. principal(`JWT sub` = `ACCOUNT.ID`) 없거나 계정 없음 → `401 UNAUTHORIZED`
3. `SYSTEM_ROLE != ADMIN` → `403 FORBIDDEN`
4. JWT 형식 불변. 강등은 다음 요청부터 반영

`WebConfig`에 `AdminGuardInterceptor` 등록. **기본은 미적용**(명시 부착만) — 온보딩과 동일.

이번 부착: `GET /accounts`(메서드), `AdminNotificationController`(클래스). 상세는 아래 표 A.

### `@RequireOnboarding` (기존)

1. principal 없으면 `401`
2. 온보딩 미완료 → `403 ONBOARDING_REQUIRED`
3. 온보딩·`/auth/me`·닉네임 availability·탈퇴 등 **의도적 미완료 허용** API에는 붙이지 않음 (표 D)

이미 서비스에 있는 `assertCaptain` 등은 **지우지 않음**. 구멍에만 `@RequireAdmin`을 덧붙인다.

---

## 화면 × API × 필요 권한

> beta 기준. 「이번 변경」만 PR 범위. 「예정」= 미구현·별도 논의.

### A. 캡틴 — `@RequireAdmin`

| 화면 | Method | Path | 지금 | 이번 | 비고 |
|------|--------|------|------|------|------|
| 유저 목록 | GET | `/accounts` | 인증만 **구멍** | **`@RequireAdmin`** | |
| 알림 템플릿 | GET | `/api/admin/notification-templates` | 인증만 **구멍** | **클래스 `@RequireAdmin`** | |
| 알림 이력 | GET | `/api/admin/notifications` | 인증만 **구멍** | 동일 | |
| 신청 폼/결과·디스코드 | … | `/api/admin/studies/...` | `assertCaptain` | 변경 없음 | |
| 스터디 등록/삭제 | POST/DELETE | `/api/studies`… | 인라인 ADMIN | 변경 없음 | 통일은 논의점 |
| 역할 변경 | PATCH | `/accounts/{id}/role` | 미구현 | **예정** | BO 2단계 |

### B. 스터디 범위 — `StudyCaptainGuard` 유지

| 화면 | Method | Path | 지금 | 이번 | 비고 |
|------|--------|------|------|------|------|
| 스터디 수정 | PATCH | `/api/studies/{studyId}` | `assertCaptainOrNavigator` | 변경 없음 | |
| 신청 폼 저장 | PUT | `…/application-form` | 동일 | **`@RequireOnboarding` 추가** | |
| 신청 폼 조회 | GET | 동일 | 공개/편집 분기 | 변경 없음 | |
| 출석 upsert | POST | `…/attendances` | LEADER/CO_LEADER만 (ADMIN 미포함) | **`@RequireOnboarding`만**. ADMIN 정렬은 **범위 밖** | 논의점 §2 |
| 출석 명부 | GET | 동일 | 인증만 | **`@RequireOnboarding`**. 역할 축소는 **예정** | 논의점 §3 |

### C. 회원 전용 · 온보딩

| 화면 | Method | Path | 지금 | 이번 |
|------|--------|------|------|------|
| 내 스터디 허브·상세 | GET | `/api/me/studies`… | `@RequireOnboarding` | 유지 |
| 북마크 목록 | GET | `/api/me/bookmarks` | 인증만 | **`@RequireOnboarding`** |
| 북마크 추가/해제 | POST/DELETE | `/api/me/bookmarks/...` | 미구현 | **예정** (구현 시 온보딩) |
| 탈퇴 | DELETE | `/api/me` | — | **예정** — 가드 **금지** ([user-leave](../user-leave/spec.md)) |
| 신청 제출 등 | POST | `/api/studies/.../applications` | 미구현 | **예정** |

### D. 가드 금지 (의도적)

`POST /auth/social-login` · `POST /auth/refresh` · `GET /auth/me` · `POST /accounts/onboarding` · `GET /api/nicknames/availability`

### E. 범위 밖 (참고)

공개 스터디 목록/상세 · Discord API 키 체인(`POST /api/discord/.../attendances`)

---

## API · 에러 계약

새 엔드포인트 없음.

| 조건 | HTTP | errorCode |
|------|------|-----------|
| 미인증·계정 없음 | 401 | `UNAUTHORIZED` |
| `@RequireAdmin` 실패 | 403 | `FORBIDDEN` |
| `@RequireOnboarding` 실패 | 403 | `ONBOARDING_REQUIRED` |
| `StudyCaptainGuard` 등 | 403 | `FORBIDDEN` |

로그인 화면 문구와 API `FORBIDDEN` 본문은 **통일하지 않음**.  
프론트: `ONBOARDING_REQUIRED` → onboarding 페이지 · `FORBIDDEN` → 권한 없음 UI.

---

## 백엔드 구현 지점

- 신설: `RequireAdmin`, `AdminGuardInterceptor` (`auth.security`, 온보딩과 대칭) + `WebConfig` 등록
- 부착: 표 A·B·C의 「이번」열 (요약: `AccountController.list`, `AdminNotificationController`, bookmarks GET, Attendance*, application-form PUT)
- 테스트: MEMBER → 구멍 API 403 `FORBIDDEN` · 온보딩 미완료 → `ONBOARDING_REQUIRED` · ADMIN/완료는 통과. `AdminNotificationIntegrationTest` 등에 MEMBER 거부 추가
- 문서: back-office-login 한계/후속·notification 「백오피스 인가」에 이 스펙 링크

프론트 전용 작업 필수 아님(이미 `role !== 'ADMIN'` 쿠키 차단). **서버 가드가 SSOT.**

---

## 논의점

이번 PR 기본값은 위 표에 반영됨. 아래는 후속/별도 이슈용.

### 1. `@RequireAdmin` 전략 — (a) 이번 / (b)·(c) 후속

| 안 | 내용 |
|----|------|
| **(a) 구멍만** ← 이번 | 열린 API만. 기존 `assertCaptain`/인라인 유지 |
| **(b) 이중 방어** | `/api/admin/**` 일괄 `@RequireAdmin` + 서비스 검사 유지 |
| **(c) 치환** | 사이트 전체 캡틴 판정을 어노테이션으로 옮기고 서비스 ADMIN 검사 제거 (회귀 큼) |

`POST`/`DELETE /api/studies`에 `@RequireAdmin`을 붙이는 것도 (a)에선 불필요 → (b) 계열 후속.

### 2. 출석 upsert ↔ ADMIN(캡틴)

지금은 참가자 LEADER/CO_LEADER만 통과. POL-0001은 캡틴·네비게이터. `assertCaptainOrNavigator` 정렬은 **별도 이슈** — 이번엔 `@RequireOnboarding`만.

### 3. 출석 GET 역할 축소

로그인만이면 명부 조회 가능. 캡틴/네비게이터만으로 좁힐지는 별도 논의. 이번은 온보딩만.

---

## 한계 / 후속

- 역할 부여 API·화면 (BO 2단계)
- 표 「예정」행의 `@RequireOnboarding` — 각 기능 스펙 구현 시 표 갱신
- 네비게이터 백오피스 접근 · 출석 upsert↔POL · JWT role claim — 위 논의점 / 기존 결정 유지
