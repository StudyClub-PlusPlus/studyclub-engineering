# timezone Tasks (백엔드)

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)
> 날짜: 2026-11-27 · 기준 `beta` @ `3ece5a41`

## 포맷: `[ID] [P?] 설명`

- **[P]**: 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준. Phase N 이 끝나야 Phase N+1 시작
- `…/common/time` = `backend/common/src/main/java/com/studyclub/common/time`, `…/domain/study` = `backend/domain/src/main/java/com/studyclub/domain/study`, `…/api/{pkg}` = `backend/api/src/main/java/com/studyclub/api/{pkg}`

BE PR 하나다. 스펙 §5 가 후속 PR 로 미룬 회차 · 행사 · 알림 · 메일 응답의 `FormattedInstant` 는 넣지 않는다. `frontend/` 는 건드리지 않는다.

---

## Phase 1: common

- [x] T001 [P] `TimeZoneIds` — `normalize` · `isValid` · deprecated 링크 표, 오프셋 전용 · `Etc/GMT±N` · 64자 초과 거부 — `…/common/time/TimeZoneIds.java`
- [x] T002 [P] `TimeZoneRules` — 밴쿠버 `2026-03-08T10:00Z` 이후 `UTC-07:00` · `PCT`, 약칭 표 — `…/common/time/TimeZoneRules.java`
- [x] T003 `FormattedInstant` record · `TimeZoneFormatService`(`format` · `formatDeadline`(dDay) · `endOfDay` · `startOfDay` · `offsetLabel`) — `…/common/time/`
- [x] T004 [P] `TimeZoneLabels` — CLDR 한국어 라벨 TSV(`backend/common/src/main/resources/com/studyclub/common/time/time-zone-labels.tsv` + `UNICODE-LICENSE.txt`), `shortLabel` · `order` · `recruitmentLabel`
- [x] T005 [P] `ErrorCode.TIME_ZONE_CANDIDATES_UNAVAILABLE(503)` — `backend/common/src/main/java/com/studyclub/common/error/ErrorCode.java`
- [x] T006 단위 테스트 — `backend/domain/src/test/java/com/studyclub/common/time/{TimeZoneIdsTest,TimeZoneFormatServiceTest,TimeZoneLabelsTest}.java`

## Phase 2: domain · 마이그레이션

- [x] T007 `RecruitmentTimeZoneMode` + `RecruitmentTimeZoneModeConverter`(소문자 저장) · `RecruitmentTimeZones` 값 객체 — `…/domain/study/`
- [x] T008 `StudyRecruitmentZone` 엔티티 · `StudyRecruitment.timeZoneMode` · `zones`(`@OneToMany` · `@BatchSize`) · `timeZones()` · `changeTimeZones` — `…/domain/study/`
- [x] T009 `Study` — `timezone` 필드 · `changeTimezone` · `timezone()` 삭제, `canApply(...)` 추가. `StudyTimezone` 삭제
- [x] T010 [P] `Account.adminDisplayTimeZone` · `changeAdminDisplayTimeZone` — `backend/domain/src/main/java/com/studyclub/domain/account/Account.java`
- [x] T011 [P] `EventDraft` 검증 → `TimeZoneIds.normalize`, `EventLimits.TIME_ZONES` 삭제 — `backend/domain/src/main/java/com/studyclub/domain/event/`
- [x] T012 `V68__timezone_expansion.sql` — 컬럼 2 · 테이블 1 · 이관(최신 모집 회차, `RECRUIT_DEADLINE_AT` 불변) — `backend/domain/src/main/resources/db/migration/`. `./backend/scripts/check-migration-versions.sh`
- [x] T013 단위 테스트 — `RecruitmentTimeZonesTest` · `StudyRecruitmentTest`(지역 교체 diff) · `StudyTest`(`canApply`, 시간대 추정 테스트 삭제) · `ClubEventTest`(전 IANA · 오프셋 거부 · 정규화)

## Phase 3: api 공통

- [x] T014 `TimeZoneValidator` → `TimeZoneIds.isValid`. `ValidTimeZone` 문구 — `…/api/auth/validation/`
- [x] T015 `PATCH /api/me` 가 시간대를 실제로 바꾸면 `MemberTimeZonesChanged` 발행 — `…/api/auth/AccountProfileService.java`. 온보딩은 기존 `UserRegisteredEvent` 를 무효화 신호로 쓴다
- [x] T016 [P] 반 `timezone` 정규화 — 엔티티가 한다 (`StudyGroup` 생성자 · `changeTimezone`, `Account.completeOnboarding` · `updateProfile` 도 같다). 서비스는 그대로
- [x] T017 `DisplayTimeZoneResolver`(`forBackOffice` · `forCrewSite`) — `…/api/timezone/`

## Phase 4: 신규 API

- [x] T018 `GET /api/admin/member-time-zones` — `AdminMemberTimeZoneController` · `MemberTimeZoneCandidateService`(TTL 60s · `Clock` · 집계 중 무효화되면 캐시에 넣지 않음) · `MemberTimeZoneCacheInvalidator`(AFTER_COMMIT: `MemberTimeZonesChanged` · `AccountDeleted`) · `AccountRepository.countOnboardedByTimeZone` — `…/api/timezone/`
- [x] T019 `GET · PATCH /api/admin/me/display-time-zone` — `AdminDisplayTimeZoneController` · `AdminDisplayTimeZoneService` — `…/api/timezone/`

## Phase 5: 스터디

- [x] T020 요청 — `RecruitmentTimeZonesRequest` · `StudyDateInput`(순간 또는 `YYYY-MM-DD`), `StudyCreateRequest` · `StudyUpdateRequest` 의 `timezone` → `recruitmentTimeZones` — `…/api/study/`
- [x] T021 응답 — `RecruitmentTimeZonesView`, `StudyListResponse` · `StudyDetailResponse` · `BackofficeStudyListResponse` 에 `recruitmentTimeZones` · `recruitmentTimeZoneLabel` · `recruitDeadlineFormatted` · `startAtFormatted` · `canApply`(사이트) · `displayTimeZone`
- [x] T022 서비스 — `StudyService` 등록 · 수정(날짜 환산 · 모집 시간대 저장) · 상세(표시 시간대), `StudyListService` · `BackofficeStudyListService` 표시 시간대
- [x] T023 DAO — `StudyListJpqlDao` `recruitmentZone` OR 필터, `StudyListFilter`, `BackofficeStudyQueryDao` `TIMEZONE_*` 정렬식 교체
- [x] T024 `GET /api/studies/recruitment-zones` — `StudyListDao.recruitmentZones` (JPQL) · `StudyListService.recruitmentZoneCandidates` · `StudyController`
- [x] T025 컨트롤러 Query — `StudyController`(`recruitmentZone` · `timeZone`) · `AdminStudyController`(`displayTimeZone`, 목록 빈 값 검사 목록)

## Phase 6: 대시보드

- [x] T026 `DashboardTimeZoneResolver` → `DisplayTimeZoneResolver.forBackOffice` — `…/api/stats/`
- [x] T027 `CrewTimeZoneDistribution` 5칸 규칙 · `AdminStatsResponses.TimeZoneGroup(code String, count, percentage, breakdown)` · `CrewTimeZoneGroupCode` 삭제 — `…/api/stats/`
- [x] T028 `study-board` 항목 `recruitDeadlineFormatted` — `AdminStatsService` · `AdminStatsResponses.StudyBoardItem`

## Phase 7: 테스트

- [x] T029 `TimeZoneValidatorTest` 4종 화이트리스트 → 전 IANA 규격
- [x] T030 통합 — `AdminMemberTimeZoneIntegrationTest` · `AdminDisplayTimeZoneIntegrationTest` · `StudyDeadlineTimeZoneIntegrationTest`, 단위 `MemberTimeZoneCandidateServiceTest`(TTL · 무효화 · 503)
- [x] T031 통합 갱신 — `StudyListIntegrationTest`(OR 필터 · 후보) · `AdminStudyCrudIntegrationTest`(모집 시간대 · 날짜 환산) · `AdminStudyListIntegrationTest` · `AdminStudyQueryIntegrationTest` · `AccountProfileIntegrationTest` · `AccountOnboardingIntegrationTest` · `AdminStudyGroupUpdateIntegrationTest` · `AdminClubEventIntegrationTest` · `StudyServiceTest` · `StudyThumbnailIntegrationTest`(시그니처)
- [x] T032 대시보드 — `CrewTimeZoneDistributionTest` · `DashboardTimeZoneResolverTest` · `AdminStatsIntegrationTest` · `AdminStatsServiceTest`
- [x] T033 `cd backend && ./gradlew check` — 통과 (api 1343 · domain 291+). V68 이관 SQL 은 H2(MySQL 모드)로 따로 돌려 최신 회차 · `both` 소문자 · NULL · 마감 불변을 확인했고, MySQL 문법은 `backend-migration-check` CI 가 본다

## Phase 8: 문서

- [x] T034 스펙 상태 — `specs/timezone/spec.md`(구현중 · 실제 계약), `specs/README.md`
- [x] T035 연동 스펙 — `study` · `study-recruit-status` · `dashboard` · `profile-edit` · `user-onboarding` · `study-group` · `event`
- [x] T036 ERD — `docs/erd/ACCOUNT.md` · `STUDY.md` · `STUDY_RECRUITMENT.md` · `STUDY_RECRUITMENT_ZONE.md`(신규) · `docs/erd/README.md` 목록
- [x] T037 `.prober/map/concepts.json` 에 `STUDY_RECRUITMENT_ZONE`, `.prober/tests/timezone-expansion.md`
