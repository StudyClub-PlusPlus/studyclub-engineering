# timezone 구현 계획 (백엔드)

> Spec: [spec.md](./spec.md) | PRD: [시간대 확장](../../01-planning/stories/timezone-expansion/PRD.md) | 날짜: 2026-11-27 | 기준: `beta` @ `3ece5a41` (최신 마이그레이션 `V67`)
>
> **BE PR 하나**로 낸다. `frontend/` 는 손대지 않는다. 스펙 부록 A 대로 beta 계약(`STUDY.TIMEZONE` enum · 목록 `timezone` Query · `crew-timezones` 4분류 · 대시보드 프로필 우선)을 **호환 없이** 새 계약으로 바꾸므로 back-office-front · core-front 연결 PR 과 같이 배포한다.

## 대상 엔드포인트

| Method | Path | 변경 |
|---|---|---|
| GET | `/api/admin/member-time-zones` | 신규. 회원 시간대 후보, 서버 메모리 캐시 60초 |
| GET · PATCH | `/api/admin/me/display-time-zone` | 신규. 운영자 표시 시간대 |
| GET | `/api/studies/recruitment-zones` | 신규. 공개 스터디 목록 필터 드롭다운 후보 (§3.2 「필터 드롭다운 후보」). 기존 후보 API 없음 |
| GET | `/api/studies` | `timezone` Query 삭제 → `recruitmentZone`(단일 IANA). `timeZone` Query(조회자 대체값) 추가. 항목에 모집 시간대 · 서버 포맷 시각 · `canApply` |
| GET | `/api/studies/{studyId}` | `timeZone` Query 추가. 상세 응답 변경(아래) |
| PATCH | `/api/studies/{studyId}` | `timezone` → `recruitmentTimeZones`. 날짜만 보낸 마감 · 시작일을 조회자 시간대로 환산 |
| GET | `/api/admin/studies` · `/api/admin/studies/{studyId}` | `displayTimeZone` Query 추가. `timezone` → `recruitmentTimeZones` + 라벨 + 서버 포맷 시각 |
| POST · PATCH | `/api/admin/studies` · `/api/admin/studies/{studyId}` | `displayTimeZone` Query 추가. `timezone` → `recruitmentTimeZones`. 날짜만 보낸 마감 · 시작일을 헤더 시간대로 환산 |
| PATCH | `/api/me` · POST 온보딩 | `timeZone` 검증 → §3.1 (전 IANA · 정규화) |
| PATCH | `/api/admin/studies/{studyId}/groups/{groupId}` | 반 `timezone` 검증 → §3.1 · 정규화 |
| POST · PUT | `/api/admin/events` | `EventLimits.TIME_ZONES` 4개 제한 삭제 → §3.1 |
| GET | `/api/admin/stats/summary` · `study-board` · `attendance-trend` | `timeZone` Query(헤더) 우선 → `ADMIN_DISPLAY_TIME_ZONE` → `TIME_ZONE` → 서울. `study-board` 항목에 `recruitDeadlineFormatted` |
| GET | `/api/admin/stats/crew-timezones` | KST/ET/PT/UNKNOWN 4칸 → IANA 최대 5칸(`other` · `unset`, `other.breakdown[]`) |

## 기술 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 공통 규칙 위치 | `backend/common` 의 `com.studyclub.common.time` — `TimeZoneIds`(검증 · 정규화) · `TimeZoneRules`(밴쿠버 · 약칭) · `TimeZoneFormatService`(포맷 · 날짜 환산) · `FormattedInstant` · `TimeZoneLabels`(표시 라벨 · 정렬). 모두 정적 메서드, Spring 없음 | 스펙 §3.3 · §11. common 은 `java-library` 라 빈을 만들지 않는다. 엔티티(EventDraft) · DTO 정적 팩터리에서 바로 부를 수 있다 |
| common 단위 테스트 | `backend/domain/src/test/java/com/studyclub/common/time/` 에 둔다 | common 에는 테스트 의존성이 없고, 이번 작업은 build.gradle 을 바꾸지 않는다(지시서 제외 3). domain 이 common 을 `api` 로 물고 JUnit · AssertJ 가 있다 |
| IANA 검증 | `TimeZoneIds.normalize(String) → Optional<String>`. 비었음 · 64자 초과 · `normalized()` 가 `ZoneOffset`(`+09:00`, `EST`, `MST`) · 접두 오프셋(`UTC+09:00`, `GMT+9`, `UT+1`) · `Etc/GMT±N` · POSIX 규칙(`PST8PDT`, `SystemV/*`) · `ZoneId.getAvailableZoneIds()` 밖 → 거부. `UTC` · `Etc/UTC` 류는 `UTC` 로 | §3.1 「오프셋만 있는 ID 거부」. 대시보드 §4.1 이 `UTC` 를 허용한다 |
| deprecated 정규화 | tzdata `backward` 의 옛 이름 · 분류 이름 링크 전부(123개, `US/Aleutian` → `America/Adak` 등)를 `TimeZoneIds.LINKS` 표로 둔다. 다른 나라 존으로 합친 도시(Amsterdam → Brussels 등)는 합치지 않는다. 규칙 이름(`CET` · `EET` · `MET` · `WET` · `PST8PDT` · `SystemV/*`)은 거부. `TimeZoneIdsTest` 가 JDK 의 모든 ID 를 돌려 링크 · 분류 이름이 남지 않는지 본다 | JDK 에는 링크 → 정본 API 가 없고, 외부 라이브러리(ICU)는 추가하지 않는다 |
| `@ValidTimeZone` | `TimeZoneValidator` 가 `TimeZoneIds.isValid` 를 부른다. 정본 ID 로 바꾸는 일은 엔티티(`Account` · `StudyGroup` · `EventDraft`)가 저장 전에 한다 | 검증기는 값을 바꿀 수 없다. 온보딩 · `PATCH /api/me` · 반 설정이 같은 검증기 |
| 밴쿠버 | `TimeZoneRules.zoneAt(zone, instant)`: `America/Vancouver` 이고 `instant ≥ 2026-03-08T10:00Z` 면 `UTC-07:00` 고정, 약칭 `PCT`. 날짜 → UTC 환산(`TimeZoneFormatService.endOfDay/startOfDay`)도 같은 규칙 | Playground `time-zone-rules.ts` 와 같은 기준 시각. JDK tzdata 가 BC 영구 서머타임을 모르면 11월에 `UTC-8` 로 되돌아간다 |
| 약칭 | `Asia/Seoul` KST, `America/New_York` · `America/Toronto` EST/EDT, `America/Los_Angeles` PST/PDT, `America/Vancouver` PST/PDT → PCT. 그 밖은 JDK `zzz`(영문) 약칭, `GMT+03:00` 같은 오프셋 모양이면 `null` | §3.5 |
| `FormattedInstant` | record. `instant` 는 ISO-8601 UTC 문자열, `dDay` 는 마감 계열에만 채우고 마감 뒤 · 없음은 `null` | §3.3. `dDay` 는 판정에 쓰지 않는다 |
| 응답 필드 이름 | 원래 UTC 필드(`recruitDeadlineAt` · `startAt`)는 그대로 두고 `recruitDeadlineFormatted` · `startAtFormatted` 를 더한다. 목록에는 최상위 `displayTimeZone` | 요청 본문의 `recruitDeadline`(입력)과 응답 객체 이름이 겹치지 않게. 기존 UTC 필드를 읽는 화면을 깨지 않는다 |
| 날짜 입력 | `recruitDeadline` · `startAt` 이 ISO 순간 또는 `YYYY-MM-DD` 를 받는다(`StudyDateInput`). 날짜면 마감은 그 날 23:59:59, 시작은 00:00:00 을 표시 시간대로 해석해 UTC 로 | PRD §6 「입력 당시 헤더 시간대의 23:59:59」. 순간을 보내던 기존 화면도 그대로 동작한다 |
| 표시 시간대 결정 | `DisplayTimeZoneResolver`(api) 하나. 백오피스: Query → `ADMIN_DISPLAY_TIME_ZONE` → `TIME_ZONE` → 서울. 크루 사이트: `TIME_ZONE` → Query → 서울. 명시 Query 가 무효면 400 | §3.4. 대시보드 resolver 는 백오피스 규칙에 위임한다(§2.2.1) |
| 모집 시간대 모델 | `StudyRecruitment.timeZoneMode`(`RECRUITMENT_TZ_MODE`, 소문자 저장 컨버터) + 자식 엔티티 `StudyRecruitmentZone`(`@OneToMany` cascade · orphanRemoval · `@BatchSize`). 값 객체 `RecruitmentTimeZones(mode, zones)` 가 불변식(selected ≥1 · 중복 없음 · 유효 IANA, 나머지 모드는 빈 목록)을 검사 | §3.2 · §4.2 · §4.3. 같은 모집 회차 애그리거트 안의 자식이다 |
| 자식 교체 | `StudyRecruitment.changeTimeZones` 는 빠진 지역만 지우고 새 지역만 더한다 | Hibernate 는 같은 flush 에서 INSERT 를 DELETE 보다 먼저 보내 `UNIQUE(STUDY_RECRUITMENT_ID, TIME_ZONE)` 가 깨진다 |
| 동시 수정 | 모집 회차를 바꾸는 수정(정원 · 마감 · 모집 시간대)은 최신 모집 회차 ID 만 먼저 찾고(`findLatestIdByStudyId`, 엔티티를 1차 캐시에 올리지 않는다) 회차와 지역 자식을 `findByIdWithZonesForUpdate`(`FOR UPDATE` + `LEFT JOIN FETCH zones`) 한 번으로 읽는다. 지역을 지연 로딩하면 MySQL REPEATABLE READ 에서 잠금 전 스냅숏을 읽는다. 헤더 저장(`AdminDisplayTimeZoneService`)도 `ACCOUNT` 행을 `findByIdForUpdate` 로 잠가 프로필 수정과 줄 세운다(`Account` 는 전체 칸 UPDATE). 읽기(`timeZones()`)는 어긋난 행도 예외 없이 읽는다(`all` 에 남은 지역 무시, 지역 없는 `selected` = `unset`) | 두 수정이 모드 행 · 지역 행을 따로 건드리면 둘 다 커밋돼 `all` + 지역이 남는다. 그 행 하나로 공개 목록 전체가 400 이 되면 안 된다 |
| N+1 | 목록은 `findLatestByStudyIdIn` 한 번 + 자식 `@BatchSize(100)` 한 번 | 페이지 크기만큼 자식 쿼리를 내지 않는다 |
| 목록 필터 | JPQL: 최신 모집 회차가 없거나, 모드가 `selected` 가 아니거나(`all` · `unset`), `selected` 이고 자식에 그 지역이 있으면 통과 | §3.2 OR 규칙. 모집 회차 없는 스터디는 `unset` 과 같다 |
| 필터 후보 | `GET /api/studies/recruitment-zones` — 공개(`STATUS <> DRAFT`) 스터디의 최신 모집 회차 중 `selected` 지역 distinct. 정렬은 `TimeZoneLabels.order`(한국 → 미국 → 캐나다 → 오스트레일리아 → 영국 → 나머지 이름순) | PRD §4. 다른 필터 · 페이지와 무관 |
| 라벨 | `TimeZoneLabels` 가 CLDR 한국어 도시명 표(Playground `time-zone-labels.json` 를 TSV 로 옮김, Unicode 라이선스 동봉)를 읽는다. `recruitmentZoneShortLabel`: 서울 `한국`, LA `미국 · LA`, 나머지 `국가 · 도시`. `recruitmentTimeZoneLabel`: `all` `모든 시간대에서 모집` · `unset` `미정` · `selected` 짧은 라벨을 정렬해 ` / ` 로 | Playground `recruitment-timezones.ts` 와 같은 문구 · 순서 |
| `canApply` | `Study.canApply(crewCount, deadline, capacity, asOf)` = `recruitStatus == RECRUITING`. 목록 · 상세에 싣는다 | 스펙 §10 「한국 · LA · 토론토 `canApply` 동일」. 판정은 엔티티 메서드 하나 |
| `STUDY.TIMEZONE` | 컬럼은 남기고 엔티티 매핑 · `StudyTimezone` enum · 일정 문구 추정(`Study.timezone()`)을 지운다 | §4.3 「읽기 전용 · 폐기 예정, 신규 쓰기 중단」. 이관 SQL 만 읽는다 |
| 백오피스 `TIMEZONE_*` 정렬 | 이름을 유지하고 식을 `selected → all → unset`(모집 회차 없음 = unset) 으로 | 정렬 enum 은 FE 가 보내는 값이다. 지운 컬럼을 정렬에 쓸 수 없다 |
| 후보 캐시 | `MemberTimeZoneCandidateService` — `AtomicReference<Snapshot>` + `Clock`, TTL 60초. 집계 중에 무효화가 오면 그 결과는 캐시에 넣지 않는다(세대 번호). `MemberTimeZonesChanged`(api 내부 이벤트, `PATCH /api/me` 가 시간대를 실제로 바꿈) · `UserRegisteredEvent`(온보딩 처음 완료) · `AccountDeleted` 를 `@TransactionalEventListener(AFTER_COMMIT, fallbackExecution = true)` 로 받아 비운다 | §6. 새 의존성(Redis · Caffeine) 없이 JDK 로. 커밋 전 무효화는 옛 값을 다시 채울 수 있다 |
| 후보 조회 실패 | `DataAccessException` → 503 `TIME_ZONE_CANDIDATES_UNAVAILABLE`. 옛 스냅숏은 버리지 않는다(다음 요청 재시도) | §6 「조회 실패 시 503」. 빈 집계와 구분 |
| 후보 집계 | JPQL `GROUP BY a.timeZone` (`ONBOARDING_COMPLETED_AT IS NOT NULL`). 탈퇴는 계정 행이 지워져 자동 제외. 무효 값은 빼고, deprecated 값은 정본으로 합친다 | §6 |
| `crew-timezones` | `CrewTimeZoneDistribution`(api/stats) 순수 함수. 지역 = 유효 IANA(정본), `unset` = null · 빈 값 · 무효. 지역 정렬 인원 내림차순 · 동률 IANA 오름차순. 합계(지역 수 + unset 1) ≤ 5 전부 / > 5 · unset 있음 상위 3 + other + unset / > 5 · unset 없음 상위 4 + other. 출력 순서 지역 → other → unset. 활성 크루 0명이면 `timeZoneGroups = []` | dashboard §4.5 확장 개정안. `CrewTimeZoneGroupCode` 삭제, `code` 는 문자열 |
| 대시보드 `timeZone` | `DashboardTimeZoneResolver` → `DisplayTimeZoneResolver.forBackOffice`. 명시 Query 무효 · 빈 값 400 유지 | dashboard §2.2.1 |

## 마이그레이션

`beta` 최신은 `V67` → **`V68__timezone_expansion.sql`**. 열린 PR #556(`V68` · `V69` · `V70`) · Draft #553(`V68`)과 번호가 겹친다 — 머지 순서대로 번호를 다시 맞춘다(PR 본문 「머지 전 확인」).

1. `ACCOUNT.ADMIN_DISPLAY_TIME_ZONE VARCHAR(64) NULL`
2. `STUDY_RECRUITMENT.RECRUITMENT_TZ_MODE VARCHAR(16) NOT NULL DEFAULT 'unset'`
3. `STUDY_RECRUITMENT_ZONE` (`ID` · `STUDY_RECRUITMENT_ID` · `TIME_ZONE VARCHAR(64)` · `CREATED_AT` · `UPDATED_AT`, `UNIQUE(STUDY_RECRUITMENT_ID, TIME_ZONE)`, 논리 FK — 외래키 없음)
4. 이관(§4.4): 스터디별 **최신(ID 최대) 모집 회차**에 `STUDY.TIMEZONE` 을 옮긴다. `KST` → `selected` + `Asia/Seoul`, `PST` → `selected` + `America/Los_Angeles`, `BOTH`/`both` → `selected` + 둘, `NULL` → `unset` 그대로. 일정 문구로 추정하지 않는다
5. **`RECRUIT_DEADLINE_AT` 은 건드리지 않는다** (§4.5 A안). `STUDY.TIMEZONE` 은 지우지 않는다

stage 는 Flyway 가 꺼져 있어(Hibernate `update`) 1~3 은 엔티티로 생기지만 **4 이관은 손으로 한 번** 돌려야 한다 — PR 본문에 적는다. 새 컬럼에 `@ColumnDefault("'unset'")` 을 달아 stage 의 기존 행도 `unset` 으로 채워지게 한다.

## 애그리거트 매핑

[ddd-guide.md](../../docs/backend-development-guide/ddd-guide.md) 기준.

- **Account** → `adminDisplayTimeZone` + `changeAdminDisplayTimeZone(String)`. 표시 시간대 결정 규칙은 api `DisplayTimeZoneResolver`
- **StudyRecruitment** (모집 회차 루트) → `timeZoneMode` · 자식 `StudyRecruitmentZone` · `timeZones()`(값 객체) · `changeTimeZones(RecruitmentTimeZones)`
- **Study** → `canApply(...)` 판정 추가, `timezone` 필드 · `timezone()` 추정 삭제
- **ClubEvent** → `EventDraft` 가 `TimeZoneIds.normalize` 로 검증 · 정규화
- **StudyGroup** → 서비스가 정규화한 값을 `changeTimezone` 에 넘긴다

## 구현 순서

1. common — `time` 패키지 5개 + 라벨 TSV · 라이선스, 에러 코드 `TIME_ZONE_CANDIDATES_UNAVAILABLE`
2. domain — `RecruitmentTimeZoneMode`(+ 컨버터) · `RecruitmentTimeZones` · `StudyRecruitmentZone` · `StudyRecruitment` 변경 · `Account.adminDisplayTimeZone` · `Study` 정리 · `EventDraft` · `EventLimits`, `V68`
3. api 공통 — `TimeZoneValidator` · 온보딩 · 프로필 · 반 정규화, `DisplayTimeZoneResolver`, `MemberTimeZonesChanged`
4. api 신규 — `member-time-zones` (캐시 · 무효화 · 503), `display-time-zone`
5. api 스터디 — 요청 · 응답 · DAO · 서비스 · 필터 후보
6. api 대시보드 — resolver · `crew-timezones` · `study-board`
7. 테스트 — common 단위, domain 단위, 통합(아래), 기존 4종 화이트리스트 테스트 교체
8. 문서 — 스펙 상태 · 연동 스펙 · ERD · `.prober`

## 테스트 (스펙 §10)

| 항목 | 테스트 |
|---|---|
| 전 IANA · 오프셋 거부 · 정규화 | `TimeZoneIdsTest`(단위), `TimeZoneValidatorTest`, 온보딩 · 프로필 · 반 · 행사 통합 |
| 밴쿠버 `PCT` / `UTC-07:00` | `TimeZoneFormatServiceTest` — 2026-03-08 10:00Z 직전 · 직후, 2026-11-05 LA 19:00 PST = 밴쿠버 20:00 PCT |
| 회원 후보 캐시 무효화 | `AdminMemberTimeZoneIntegrationTest` — GET → 프로필 PATCH → GET 반영, 온보딩 완료 · 탈퇴 반영, 미온보딩 · null 제외, 정렬, 503, 401 · 403 |
| 표시 시간대 | `AdminDisplayTimeZoneIntegrationTest` — GET fallback, PATCH 저장 · 프로필 불변, 무효 400, PATCH 뒤 마감 UTC 불변 |
| 한국 + LA OR 필터 · all · unset | `StudyListIntegrationTest` — 서울 · LA 필터 양쪽 노출, `all` · `unset` · 모집 회차 없음 포함, 다른 지역 제외, 무효 400 · 필터 후보(비공개 제외 · 조합 없음) |
| 같은 UTC 마감 서울 · LA · 토론토 | `StudyDeadlineTimeZoneIntegrationTest` — `canApply` · `recruitStatus` 동일, `dDay` · `localDate` 다름, 마감 1ms 전 · 같은 순간 · 직후 |
| 날짜 입력 → UTC | 등록 · 수정에 `displayTimeZone` 별 23:59:59 환산, 순간 입력은 그대로, 마감 미수정 PATCH 는 UTC 불변 |
| `crew-timezones` 5칸 3분기 | `CrewTimeZoneDistributionTest`(단위) + `AdminStatsIntegrationTest` |
| 대시보드 헤더 우선 | `DashboardTimeZoneResolverTest` — Query > 저장 헤더 > 프로필 > 서울, 무효 400 |
| 이관 SQL | `backend-migration-check` CI(빈 MySQL). H2 테스트는 Flyway 를 끈다 |

## 의존성

- **ERD**: `ACCOUNT` · `STUDY` · `STUDY_RECRUITMENT` 갱신, `STUDY_RECRUITMENT_ZONE` 신규
- **SecurityConfig**: 변경 없음 — `GET /api/studies/*` 공개, `/api/admin/**` 는 `@RequireAdmin`
- **FE**: back-office-front 헤더 · 모집 시간대 필드 · 대시보드 분포, core-front 목록 필터 · 카드 라벨이 새 계약을 읽어야 한다(별도 PR)

## 리스크

- **FE 동시 배포** — `timezone` 필드 · Query 가 사라져 옛 화면은 시간대를 못 그린다. 기존 UTC 필드는 남겨 날짜 표시는 깨지지 않는다
- **stage 이관** — Flyway off 라 V68 의 이관 4 를 손으로 돌리기 전까지 stage 스터디는 전부 `unset`
- **마이그레이션 번호** — #556 · #553 과 `V68` 충돌. 먼저 머지되는 쪽 기준으로 다시 매긴다
