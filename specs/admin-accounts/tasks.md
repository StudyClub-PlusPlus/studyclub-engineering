# admin-accounts Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-10-07

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (같은 Phase 안의 다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. 같은 트랙(BE/FE) 안에서 Phase N 이 끝나야 Phase N+1 시작
- **BE 트랙과 FE 트랙은 처음부터 병렬**이다. FE 는 MSW 목으로 먼저 만든다
- 경로 약어: `common/` = `backend/common/src/main/java/com/studyclub/common/`, `domain/` = `backend/domain/src/main/java/com/studyclub/domain/`, `api/` = `backend/api/src/main/java/com/studyclub/api/`, `api-test/` = `backend/api/src/test/java/com/studyclub/api/`, `bo/` = `frontend/apps/back-office-front/src/`, `mock/` = `frontend/packages/mock/src/`

---

## BE 트랙 — PR 1 (옛 `GET /accounts` 는 남긴다)

### Phase B1: 공용 · 도메인

- [ ] T001 [P] 이메일 마스킹 유틸 — `common/privacy/EmailMasking.java` (`mask(String)`: 앞 1자 + `***` + `@` 이후, null·`@` 없음·`@` 가 맨 앞이면 `***`) + 단위 테스트 `api-test/privacy/EmailMaskingTest.java` (`common` 모듈에는 테스트 의존성이 없어 그것을 쓰는 api 모듈에 둔다 — 빌드 설정을 바꾸지 않는다)
- [ ] T002 [P] 에러 코드 2개 — `common/error/ErrorCode.java` 에 `SELF_ROLE_CHANGE(409)`·`LAST_ADMIN(409)` 을 `CONFLICT` **뒤에** 추가 (문구는 spec 「계정 권한 변경 › Error Responses」). `api-test/web/ErrorCodeTest.java` 에 `fromStatus(409) == CONFLICT` 유지 확인 추가
- [ ] T003 [P] 계정 권한 전이 — `domain/account/Account.java` 에 `changeSystemRole(SystemRole) : boolean`(null 이면 예외, 같은 값이면 `false`) + `api-test/auth/AccountTest.java` 에 단위 테스트
- [ ] T004 [P] 감사 로그 엔티티 — `domain/audit/AdminAuditLog.java`(BaseEntity, 정적 팩토리 `emailReveal(actorId, targetId)`·`roleChange(actorId, targetId, before, after)`, setter 없음), `domain/audit/AdminAuditAction.java`(`EMAIL_REVEAL`·`ROLE_CHANGE`), `domain/audit/AdminAuditLogRepository.java`. 인덱스 2개를 `@Table(indexes=…)` 에 (ERD [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md))
- [ ] T005 [P] 마이그레이션 — `backend/domain/src/main/resources/db/migration/V31__admin_audit_log.sql`. 번호는 `backend/scripts/check-migration-versions.sh` 로 확인. 엔티티(T004)와 컬럼·인덱스 이름이 같아야 한다
- [ ] T006 ADMIN 잠금 조회 — `domain/account/AccountRepository.java` 에 `@Lock(PESSIMISTIC_WRITE)` + `select a from Account a where a.systemRole = ADMIN` 메서드 (`findByIdForUpdate` 옆, 왜 잠그는지 주석). T003 과 같은 모듈이지만 파일이 다르다

### Phase B2: 회원 목록 (GET `/api/admin/accounts`)

- [ ] T010 목록 조건·응답 — `api/account/AdminAccountListFilter.java`(record: systemRole·navigator·q), `api/account/AdminAccountListResponse.java`(record: items·total·offset·limit, 항목 record 는 spec 응답 표 그대로 — `maskedEmail`·`navigatorOf[{studyId,title}]`·`dormant`·`roleChangeBlockedReason`)
- [ ] T011 목록 DAO — `api/account/AdminAccountJpqlDao.java`(`BackofficeStudyJpqlDao` 모양: 조건 조립 → `count` + 페이지). 「참여 중」·「담당」 조건은 **클래스 상수 한 곳**(plan 「바꾸기 쉬운 자리」). 정렬 5단계(spec 「정렬」), `q` = 이름 부분 일치(온보딩 완료자, LIKE 이스케이프) OR 이메일 전체 일치(대소문자 무시). HQL 이 ORDER BY 서브쿼리를 못 받으면 H2·MySQL 공통 문법 native SQL 로
- [ ] T012 담당 스터디 일괄 조회 — 페이지 계정 ID 들로 `STUDY_PARTICIPANT`(담당 조건) + `STUDY.TITLE` 을 IN 한 번에, `JOINED_AT DESC`. T011 과 같은 DAO 또는 `StudyParticipantRepository` 쿼리
- [ ] T013 목록 서비스 — `api/account/AdminAccountQueryService.java`: 입력 검증(offset ≥ 0, limit 1~100, q 100자, 공백 trim), DAO 호출, `EmailMasking`, `name`(온보딩 전 null), `dormant`, `roleChangeBlockedReason`(요청자 ID · ADMIN COUNT 1회, SELF 먼저)
- [ ] T014 컨트롤러 — `api/account/AdminAccountController.java`: 클래스에 `@RequireAdmin`·`@RequestMapping("/api/admin")`·`@SecurityRequirement(name = "bearerAuth")`·`@Tag`, `GET /accounts`. 잘못된 enum·boolean 파라미터는 400 `INVALID_INPUT`
- [ ] T015 통합 테스트 — `api-test/account/AdminAccountListIntegrationTest.java`: spec 「테스트」 표의 GET 목록 행 전부 (정렬, 마스킹·원본 없음, 필터 AND, 이름 부분·이메일 전체/일부, 온보딩 전, 하차·완주 네비게이터 제외, 담당 캡틴처럼 `MEMBER` 역할 `ACTIVE` 행도 참여로 셈, 본인 SELF, offset 범위 밖, 403/401/400)

### Phase B3: 이메일 보기 (POST `/api/admin/accounts/{accountId}/email-reveals`)

- [ ] T020 서비스 — `api/account/AdminAccountEmailService.java`: `@Transactional` 한 메서드에서 대상 조회(없으면 404) → `AdminAuditLog.emailReveal` 저장 → 원본 반환
- [ ] T021 엔드포인트 — `AdminAccountController` 에 `POST /accounts/{accountId}/email-reveals`, `ResponseEntity` 로 `Cache-Control: no-store`, 응답 `{ id, email }`
- [ ] T022 통합 테스트 — `api-test/account/AdminAccountEmailRevealIntegrationTest.java`: 200 + no-store + 감사 1행(요청자·대상 ID, BEFORE/AFTER null) / 404·403 감사 0행 / 감사 저장 실패 시 원본 미반환·롤백 (저장소를 실패시키는 `@MockitoSpyBean` 등)

### Phase B4: 계정 권한 변경 (PATCH `/api/admin/accounts/{accountId}/role`)

- [ ] T030 요청 DTO — `api/account/AdminAccountRoleRequest.java`(`@NotNull SystemRole systemRole`), `AdminAccountRoleResponse.java`(`id`·`systemRole`)
- [ ] T031 서비스 — `api/account/AdminAccountRoleService.java`: spec 「처리 규칙」 1~7 순서 그대로 — ADMIN 잠금 조회(T006) → 404 → SELF 409 → 같은 값 200(감사 없음) → LAST_ADMIN 409 → `changeSystemRole` → `AdminAuditLog.roleChange`. 서비스 안에서 요청자 권한을 다시 보지 않는다 (authz-guards)
- [ ] T032 엔드포인트 — `AdminAccountController` 에 `PATCH /accounts/{accountId}/role` (`@Valid`)
- [ ] T033 통합 테스트 — `api-test/account/AdminAccountRoleIntegrationTest.java`: MEMBER→ADMIN 200 + 감사 1행(`MEMBER`→`ADMIN`) / 같은 값 200 감사 0행 / 본인 409 / 404 / MEMBER 요청 403 / `systemRole=LEADER`·누락 400
- [ ] T034 단위 테스트 — `api-test/account/AdminAccountRoleServiceTest.java`: LAST_ADMIN 판정(ADMIN 1명일 때 다른 ADMIN 을 내리는 상황을 리포지터리 목으로 구성), 판정 순서
- [ ] T035 동시성 테스트 시도 — `api-test/account/AdminAccountRoleConcurrencyTest.java`: ADMIN 2명이 두 스레드에서 동시에 서로를 내리면 한쪽만 200·다른 쪽 409 LAST_ADMIN·ADMIN 1명 남음. **H2 에서 불안정하면** `@Disabled` 하지 말고 파일을 빼고 PR 에 「stage 수동 확인」으로 남긴다 (plan 기술 결정)

### Phase B5: 권한표 (GET `/api/admin/role-permissions`)

- [ ] T040 [P] 권한 정의 — `api/account/RolePermission.java` enum (key·scope·label·allowedRoles, 선언 순서 = 표 순서, POL-0001 스터디 단위 5 · 사이트 전체 7) + 그룹별 열 정의
- [ ] T041 응답·엔드포인트 — `api/account/RolePermissionResponse.java`, `AdminAccountController` 에 `GET /role-permissions` (enum 에서 조립, 화면 문구 외 계산 없음)
- [ ] T042 통합 테스트 — `api-test/account/RolePermissionIntegrationTest.java`: ADMIN 200(그룹·행·허용이 POL-0001 과 같은 순서) / MEMBER 403

### Phase B6: 정리

- [ ] T050 [P] 알림 마스킹 교체 — `api/notification/NotificationListResponse.java` 의 private `maskEmail` 을 `EmailMasking.mask` 로. `api-test/notification/AdminNotificationIntegrationTest.java` 그대로 통과
- [ ] T051 `cd backend && ./gradlew check` 통과 (spotless 포함)

---

## FE 트랙 — PR 2 (BE PR 머지 뒤 머지)

### Phase F1: 목 · 타입

- [ ] T101 [P] 목 데이터·핸들러 — `mock/msw/handlers/accounts.ts`: 그룹을 `/api/admin/accounts` 로 옮기고 `ApiAdminAccount`·목록 응답 타입을 spec 모양으로. `GET` 목록(필터·`q`·`offset`/`limit` 를 목에서 흉내 — 이메일은 **전체 일치만**), `POST /{id}/email-reveals`, `PATCH /{id}/role`(SELF·LAST_ADMIN 규칙 흉내) 프리셋: 정상 · 빈 결과 · 403 · 404 · 409 SELF_ROLE_CHANGE · 409 LAST_ADMIN. 목 데이터는 `example.com` 만
- [ ] T102 [P] 권한표 목 — `mock/msw/handlers/role-permissions.ts` (spec 응답 예시 그대로) + `mock/msw/handlers/index.ts` 등록
- [ ] T103 타입·쿼리 — `bo/features/users/types.ts`(spec 응답 타입, 필터 타입), `bo/features/users/queries.ts`: `userKeys`(`['users', 'list', filter]` 등), `useUsers(filter)`, `useRevealEmail()`, `useChangeAccountRole()`(낙관적 갱신 없음, 성공 시 `['users']` 무효화), `useRolePermissions(enabled)`(`staleTime` 길게). 옛 `GET /accounts` 호출 제거

### Phase F2: 화면

- [ ] T110 목록 — `bo/app/users/page.tsx` (+ 필요하면 `bo/features/users/components/`): 프로토 `UsersTable` 기준 — 제목, 역할 탭(전체·캡틴·네비게이터·크루 → `systemRole`/`navigator`), 검색(placeholder 「이름 · 이메일 검색」, 입력 디바운스), 「총 N명」(`total`), 표(이름+휴면 · 이메일 · 권한 · 네비게이터 · 가입일), 네비게이터 칸(첫 스터디 + `+N`, 전체는 title), 이름 null 이면 `maskedEmail` 로컬파트, 빈 결과 문구 「조건에 맞는 유저가 없습니다.」, 페이지(`@studyclub/ui` Pagination, 한 페이지면 숨김), 탭·검색 변경 시 첫 페이지, `offset ≥ total` 이면 마지막 페이지로 다시 요청. 로딩·에러 상태
- [ ] T111 이메일 「보기」 — 이메일 칸 옆 버튼. 처리 중 표시·중복 클릭 방지, 성공하면 그 줄만 원본, 원본은 페이지 state(`Map`)에만 두고 목록이 다시 오면 비운다. 실패는 `errorMessage` 토스트
- [ ] T112 권한 배지 선택 — 프로토 `RoleBadgeSelect` 기준(캡틴·크루, 현재 값 표시, 바깥·Esc 닫힘, `position: fixed`). `roleChangeBlockedReason` 이면 잠그고 사유 툴팁(spec 문구). 고르면 그 줄만 비활성화 + 「변경 중」, 성공하면 목록 무효화 + **디스코드 안내 토스트**(문구 상수 하나, 임시 「디스코드 설정은 운영자에게 문의해 바꿔 주세요.」), 실패하면 기존 배지 유지 + `errorMessage` 토스트
- [ ] T113 권한표 모달 — 제목 옆 ⓘ → `@studyclub/ui` Modal. 응답 `groups`→`roles`→`permissions` 를 순서대로 그리기만 한다 (행·열을 코드에 박지 않음). 역할·`scope` 이름표 맵 하나, 맵에 없는 키는 키 그대로. `STUDY` 표 제목 옆 「네비게이터 권한은 담당 스터디에 국한」
- [ ] T114 [P] 컴포넌트 테스트 — `bo/features/users/*.test.ts(x)`: 탭→파라미터 매핑, 이름 null 표기, 잠금 사유 표시, 권한표가 응답의 그룹 수만큼 그려짐

### Phase F3: 정리 (같은 FE PR)

- [ ] T120 옛 엔드포인트 삭제 — `api/auth/AccountController.java` 의 `list()`(GET `/accounts`)와 그 import 제거. `POST /accounts/onboarding` 은 유지. 관련 주석·`api/auth/dto/AccountDtos.java` 문서 주석의 `GET /accounts` 언급 정리
- [ ] T121 문서 — `docs/backend-development-guide/api/endpoint-convention.md` 의 `GET /users` 행을 새 엔드포인트 4개로
- [ ] T122 `frontend/` 에서 `pnpm --filter back-office-front lint`·`typecheck`·`test`, BE 는 `./gradlew check` (T120)

---

## 마무리 (메인 세션)

- [ ] T200 각 PR 의 검사를 메인이 다시 돌려 확인
- [ ] T201 로컬에서 BE + 백오피스를 함께 띄워 실제 API 로 화면 확인 (목록·검색·보기·권한 변경·권한표)
- [ ] T202 리뷰 — 전체 리뷰 1회 + `AdminAccountRoleService`·`AdminAccountEmailService` 집중 리뷰 1회
- [ ] T203 stage 수동 확인 — 캡틴 둘이 서로를 동시에 내리기(MySQL 잠금), 이메일 보기 감사 기록
- [ ] T204 spec 상태 `구현중` → 머지 뒤 `구현완료`, `docs/roadmap/tasks.md` 한 줄

## Checkpoint

- [ ] 모든 Phase 완료
- [ ] spec.md 상태를 `구현완료` 로 변경
- [ ] `/spec review admin-accounts` 검증 통과
