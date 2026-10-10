# admin-users 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-10-07 | 기준: `beta` @ `b8d8a08`
> 갱신: 2026-10-08 — API 이름을 기획 문서(PRD)에 맞춤 (`/api/admin/users`, `…/system-role`, 필터 `role`, PRD 에러 코드). 스펙 위치 `specs/admin-users/`
>
> **기획 확인 대기 2건을 지금 가정으로 구현한다** — 권한표에 「신청 폼·결과」 표 없음, 반 편성 전 담당 캡틴은 「참여 중」으로 세지 않음(명부 행만 센다). 답이 다르면 아래 [바꾸기 쉬운 자리](#바꾸기-쉬운-자리)만 고친다.

## 대상 엔드포인트

spec.md 의 엔드포인트 전부다.

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/users` | 회원 목록 — 필터·검색·페이지, 이메일 마스킹 |
| POST | `/api/admin/users/{accountId}/email-reveals` | 이메일 원본 + 감사 로그 |
| PATCH | `/api/admin/users/{accountId}/system-role` | 계정 권한 변경 + 감사 로그 |
| GET | `/api/admin/role-permissions` | 역할별 기본 권한표 |
| ~~GET~~ | ~~`/accounts`~~ | 삭제 — 화면이 옮겨 간 뒤 ([PR 나누기](#pr-나누기)) |

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 컨트롤러 | 새 `AdminUserController` (`com.studyclub.api.account`), 클래스에 `@RequireAdmin`, `@RequestMapping("/api/admin")` | authz-guards — 인가는 어노테이션으로만. endpoint-convention — 관객별 컨트롤러, `Admin*` 이름. 기존 `api.auth.AccountController` 는 사용자 쪽(온보딩)이라 섞지 않는다 |
| 목록 조회 | JPQL DAO `AdminAccountJpqlDao` — `BackofficeStudyJpqlDao` 와 같은 모양(조건 조립 → count 쿼리 + 페이지 쿼리) | 이미 있는 패턴. 조건이 선택적이라 Spring Data 메서드 이름으로는 못 쓴다 |
| 역할 필터 | `role` enum(`ALL`·`CAPTAIN`·`NAVIGATOR`·`CREW`, 기본 `ALL`) 하나를 받아 DAO 가 조건으로 바꾼다 — `CAPTAIN`=`SYSTEM_ROLE = ADMIN`, `NAVIGATOR`=담당 스터디 있음, `CREW`=`SYSTEM_ROLE = MEMBER` | PRD 의 `role` 파라미터. 탭과 1:1 이라 화면이 그대로 보낸다 |
| 「참여 중」·「담당」 조건 | DAO 안 상수 한 곳 — `ACTIVE_STATUSES = {ACTIVE, PAUSED}`, `NAVIGATOR_ROLES = {LEADER}`. 「참여 중」은 `PARTICIPANT_ROLE` 을 보지 않는다 | 기획 답에 따라 바뀔 수 있는 조건을 한 곳에 모은다. 서브쿼리·IN 조회가 모두 이 상수를 쓴다 |
| 정렬·휴면 집계 | 페이지 쿼리에서 `STUDY_PARTICIPANT` 상관 서브쿼리 2개(담당 여부 · 참여 중 스터디 수)를 SELECT·ORDER BY 에 둔다. Hibernate HQL 이 ORDER BY 서브쿼리를 못 받으면 같은 모양의 native SQL 로 바꾼다 | 정렬이 서버라 집계가 페이지 쿼리 안에 있어야 한다. 회원 수백 명 규모라 상관 서브쿼리로 충분하다 |
| 담당 스터디 이름 | 페이지의 계정 ID 들로 명부 + 스터디 제목을 **한 번에**(`IN`) 조회해 메모리에서 묶는다 | 행마다 조회하면 N+1. 페이지 20행이라 IN 한 번이면 된다 |
| 검색 `q` | `lower(nickname) LIKE lower(:q)` (온보딩 완료자만, `%`·`_` 이스케이프) **OR** `lower(email) = lower(:q)` | 스펙 — 이름은 부분 일치, 이메일은 전체 일치만 |
| 마스킹 | `common` 모듈에 `com.studyclub.common.privacy.EmailMasking` 신설, `NotificationListResponse.maskEmail` 도 이것을 쓰게 바꾼다 | 그 메서드 주석이 "두 번째 사용처가 생기면 공용 유틸로 승격"이라고 해 둔 경우. 규칙이 한 곳이어야 두 화면의 가린 모양이 같다 |
| 이메일 보기 | 서비스 `@Transactional` 한 메서드에서 대상 조회 → 감사 로그 저장 → 원본 반환. 컨트롤러가 `ResponseEntity` 로 `Cache-Control: no-store` | 저장이 실패하면 예외로 롤백되어 원본이 나가지 않는다 |
| 권한 변경 잠금 | `AccountRepository` 에 `@Lock(PESSIMISTIC_WRITE)` + `select a from Account a where a.systemRole = ADMIN` 메서드를 추가해 행 목록을 받고 개수를 센다 | 스펙 처리 규칙 1. 기존 `findByIdForUpdate` 와 같은 방식 |
| 잠금 범위 | `SYSTEM_ROLE` 에 인덱스를 두지 않는다. MySQL 은 잠금 읽기가 훑은 행을 잠그므로 실제로는 `ACCOUNT` 전체 행이 잠깐 잠긴다 | 캡틴이 드물게 하는 일이고 트랜잭션이 짧다. 문제가 보이면 인덱스로 잠금 범위를 줄인다 |
| 엔티티 메서드 | `Account.changeSystemRole(SystemRole) : boolean` — 값이 바뀌었으면 `true` | setter 금지. 같은 값이면 `false` 로 "변경 없음·감사 기록 없음"을 판정한다. 「본인」·「마지막 캡틴」은 계정 하나로 판단할 수 없는 규칙이라 서비스가 본다 |
| 감사 로그 | domain 모듈 `com.studyclub.domain.audit` — `AdminAuditLog`(BaseEntity, 정적 팩토리 `emailReveal(...)`·`roleChange(...)`), `AdminAuditAction` enum, `AdminAuditLogRepository` | 어떤 애그리거트에도 속하지 않는 insert-only 로그 (`AccountLeaveReason` 과 같은 위치 감각). 팩토리로 만들어 ACTION 과 BEFORE/AFTER 조합이 어긋나지 않게 한다 |
| 마이그레이션 | `V31__admin_audit_log.sql` — 테이블 + 인덱스 2개. 번호는 구현 PR 을 올릴 때 `backend/scripts/check-migration-versions.sh` 로 다시 확인 | 지금 최신이 V30 |
| 권한표 정의 | api 모듈 `com.studyclub.api.account.RolePermission` enum — `key`·`scope`·`label`·`allowedRoles`, 선언 순서 = 표 순서. 행은 POL-0001 (스터디 단위 5 · 사이트 전체 7), 그룹의 열(`roles`)도 enum 옆 정의에서 나온다 | 앞으로 게이팅을 붙일 인가 어노테이션도 api 모듈(`auth.security`)에 있어 같은 모듈에서 참조한다. 역할 키는 `SystemRole.ADMIN`·`ParticipantRole.LEADER`·`SystemRole.MEMBER` 의 이름을 그대로 쓴다 |
| 에러 코드 | `ErrorCode` 에 `CANNOT_CHANGE_OWN_ROLE(409)`·`LAST_ADMIN_REQUIRED(409)` 을 `CONFLICT` 뒤에 추가 | 스펙. `fromStatus(409)` 는 첫 409 인 `CONFLICT` 를 써야 한다 |
| 잠금 사유 계산 | 목록 서비스가 요청자 ID 와 `ADMIN` 수(COUNT 한 번)로 행마다 계산 | 스펙 — 판정은 서버 한 곳 |
| 동시성 테스트 | Testcontainers 를 들이지 않는다. H2 의 `SELECT … FOR UPDATE` 행 잠금으로 두 스레드 동시 강등 테스트를 시도하고, 결과가 불안정하면 판정 로직 단위 테스트 + stage(MySQL) 수동 확인으로 대신한 뒤 PR 에 적는다 | 외부 라이브러리 추가는 합의가 필요하다 (AGENT.md). 테스트 설정도 MySQL 없이 도는 것이 원칙이다 |
| FE 구조 | `features/users/` 를 새로 쓴다 — `types.ts`(응답 타입), `queries.ts`(`useUsers(filter)`·`useRevealEmail`·`useChangeAccountRole`·`useRolePermissions`). 화면은 playground `UsersTable` 을 옮기고 `@studyclub/ui` 의 Badge·Modal·Pagination·Toast·Segmented 를 쓴다 | 백오피스 기존 규약(키·fetcher·훅을 한 파일에). 프로토가 같은 UI 키트를 쓴다 |
| 이메일 원본 보관 (FE) | 페이지 컴포넌트 state(`Map<accountId, email>`)에만 둔다. 목록이 다시 오면 비운다. mutation 결과를 쿼리 캐시에 넣지 않는다 | 스펙 — 화면 메모리에만, 목록 재조회·화면 이탈 시 다시 가림 |
| 권한표 모달 (FE) | 응답의 `groups`→`roles`(열)→`permissions`(행)를 순서대로 그리기만 한다. 열 이름표(`ADMIN`→캡틴 …)·표 제목(`scope`)은 맵 하나, 맵에 없는 키는 키 문자열 그대로 | 행·그룹이 늘어도 FE 를 고치지 않는다 (「신청 폼·결과」 표가 들어올 수 있다) |
| 권한 변경 화면 | 낙관적 갱신 없음. mutation `isPending` 인 줄만 비활성화 + 「변경 중」, 성공 시 `['users']` 무효화 + 디스코드 안내 토스트, 실패 시 `errorMessage` 토스트 | 스펙 「화면 동작」 |
| 디스코드 안내 문구 | playground 에 반영되기 전까지는 임시 문구(「디스코드 설정은 운영자에게 문의해 바꿔 주세요.」)를 상수 하나로 두고, 반영되면 그 문구로 바꾼다 | 문구·모양은 playground 를 따른다 (스펙) |
| FE 에러 처리 | `ApiError` 를 그대로 쓰고 `errorMessage` 만 띄운다 | 이번 화면은 에러 코드로 분기할 곳이 없다 (잠금 사유는 목록 응답이 이미 준다) |

## 바꾸기 쉬운 자리

기획 확인을 기다리는 가정이 바뀌면 여기만 고친다.

| 가정 | 바뀌면 고칠 곳 |
|---|---|
| 권한표에 「신청 폼·결과」 표 없음 | `RolePermission` 에 그룹·행 추가 + FE 열 이름표 맵에 「담당 캡틴」·「다른 캡틴」 |
| 반 편성 전 담당 캡틴은 「참여 중」 아님 (명부 행만 센다 — 반 편성 뒤 명부 행은 POL-0001 대로 센다) | `AdminAccountJpqlDao` 의 「참여 중」 조건에 `STUDY.CREATED_BY` 조건 OR 추가 + 통합 테스트 1건 |
| 「회차 관리」 행 (POL-0001 기준, 프로토에는 없음) | `RolePermission` 한 줄 |

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **Account** (루트) → `AccountRepository` — 목록의 계정 필드, 권한 변경(`changeSystemRole`), 이메일 원본
- **StudyParticipant** → `ACCOUNT_ID`·`STUDY_ID` 로 ID 참조. 담당 여부·참여 중 스터디 수·담당 스터디 목록 (DAO 의 서브쿼리 / IN 조회)
- **Study** → `STUDY_ID` 로 ID 참조. 담당 스터디 제목
- **AdminAuditLog** (독립 로그) → `AdminAuditLogRepository`. 행위한 서비스가 같은 트랜잭션에서 저장한다
- 「본인 변경 금지」·「마지막 캡틴」 은 계정 여러 개를 봐야 하는 규칙이라 `AdminAccountRoleService`(api) 에 둔다. 엔티티는 값 전이만 맡는다

## 구현 순서

BE 와 FE 는 처음부터 병렬로 간다. FE 는 MSW 목으로 화면을 먼저 만든다.

**BE**
1. common — `EmailMasking` + 단위 테스트, `ErrorCode` 2개 추가
2. domain — `Account.changeSystemRole` + 단위 테스트, `AdminAuditLog`·`AdminAuditAction`·`AdminAuditLogRepository`, `AccountRepository` 잠금 조회, `V31__admin_audit_log.sql`
3. api — 회원 목록: DAO·서비스·DTO·컨트롤러 GET + 통합 테스트
4. api — 이메일 보기: 서비스·컨트롤러 POST + 통합 테스트(감사 기록·no-store·롤백)
5. api — 권한 변경: 서비스·컨트롤러 PATCH + 통합 테스트 + 동시성 테스트 시도
6. api — 권한표: `RolePermission`·컨트롤러 GET + 통합 테스트
7. `NotificationListResponse` 가 `EmailMasking` 을 쓰게 교체 (기존 알림 테스트로 회귀 확인)

**FE**
1. mock — 응답 타입·목 데이터·MSW 핸들러(`/api/admin/users` 그룹, 권한표) + 에러 프리셋
2. `features/users/types.ts`·`queries.ts`
3. 목록 화면 — 탭·검색·인원 수·표(이름·휴면·이메일·권한·네비게이터·가입일)·페이지·빈 결과
4. 이메일 「보기」
5. 권한 배지 선택 — 잠금 사유 툴팁, 변경 중, 실패 토스트, 디스코드 안내
6. 권한표 모달

**마무리**
1. 메인이 BE `./gradlew check`, FE `lint`·`typecheck`·`test` 를 다시 돌린다
2. 로컬에서 BE + 백오피스를 함께 띄워 실제 API 로 화면을 확인한다
3. 리뷰 — 전체 리뷰 1회 + 권한 변경·이메일 보기 서비스(잠금·트랜잭션)만 집중 리뷰 1회
4. 스펙 상태를 `구현중` → (머지 후) `구현완료`, `docs/roadmap/tasks.md` 한 줄

## PR 나누기

**BE PR → FE PR** 순서로 두 개를 올린다.

| PR | 담는 것 | 머지 순서 |
|---|---|---|
| BE | 새 엔드포인트 4개, 감사 로그 엔티티·마이그레이션, 마스킹 유틸, 에러 코드. **옛 `GET /accounts` 는 남긴다** | 먼저 |
| FE | 백오피스 유저 화면·쿼리·목. **그리고 옛 `GET /accounts` 삭제**(`AccountController.list`) + endpoint-convention 표 정정 | BE 다음 |

옛 엔드포인트를 BE PR 에서 지우면 FE PR 이 머지되기 전까지 stage 의 유저 화면이 깨진다. 화면을 옮기는 PR 에서 함께 지우면 어느 순간에도 끊기지 않는다.

## 의존성

- **ERD 변경**: 있음 — `ADMIN_AUDIT_LOG` (문서는 스펙 PR #163, 엔티티·마이그레이션은 BE PR)
- **SecurityConfig**: 변경 없음 — `/api/admin` 은 기본 `authenticated()`, 캡틴 판정은 `@RequireAdmin`
- **authz-guards**: `@RequireAdmin`·`AdminGuardInterceptor` (#178, 머지됨)
- **playground**: 이메일 「보기」·디스코드 안내가 아직 반영 전 — 화면 모양·문구만 영향, API 무관. 반영되면 FE PR 에서 맞춘다
- **스펙 미확정**: 감사 로그 보관 기간 — 구현에 영향 없음 (오래된 기록 삭제는 범위 밖)
- **시작 시점**: 스펙 PR #163 머지됨(2026-10-08). API 이름을 PRD 에 맞추는 스펙 수정은 별도 PR

## 리스크

- **잠금 동작이 H2 와 MySQL 에서 다를 수 있다.** 동시성 테스트가 H2 에서 통과해도 MySQL 을 보증하지 않는다 → stage 에서 두 브라우저로 서로 강등하는 수동 확인을 PR 체크리스트에 넣는다.
- **잠금 범위** — 위 기술 결정대로 `ACCOUNT` 전체 행이 잠깐 잠긴다. 그 사이 다른 계정의 온보딩·프로필 수정이 기다린다. 짧아서 감수한다.
- **ORDER BY 서브쿼리** — HQL 이 못 받으면 native SQL 로 바꾸는데, H2(MySQL 모드)와 MySQL 의 방언 차이로 테스트와 운영이 갈릴 수 있다. native 로 가면 H2·MySQL 공통 문법만 쓴다.
- **마스킹 유틸 이동** — 알림 목록 응답이 바뀌지 않아야 한다. 기존 `AdminNotificationIntegrationTest` 로 확인한다.
- **탈퇴와의 차이** — `DELETE /api/me` 는 마지막 캡틴도 탈퇴시킨다 (user-leave 의 결정: SQL 로 복구 가능). 이 스펙의 「마지막 캡틴」 검사는 권한 변경에만 걸린다. 의도된 차이다.
- **FE 의 원본 이메일** — 컴포넌트 state 에만 두지만 React DevTools 로는 보인다. 캡틴 본인의 브라우저라 받아들인다. 쿼리 캐시·localStorage 에는 넣지 않는다.
