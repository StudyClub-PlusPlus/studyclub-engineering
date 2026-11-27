# 시간대 확장: 백엔드 API

대상: stage API (`backend-develop`). 스펙 [timezone](../../specs/timezone/spec.md) §6 · §7 · §10, PRD [시간대 확장](../../01-planning/stories/timezone-expansion/PRD.md) §9. 스테이지의 테스트 계정만 쓴다. 백오피스 API 는 ADMIN 계정, 사용자 사이트 API 는 크루 계정 또는 비로그인으로 부른다. 토큰 값이나 실제 회원 정보는 결과 · 캡처에 기록하지 않는다.

stage 는 Flyway 가 꺼져 있다. 시작 전에 V68 의 이관(아래 `TZ-MIGRATE-*`)을 손으로 한 번 돌렸는지 확인한다.

| ID | 절차 | 기대 결과 |
|---|---|---|
| TZ-MIGRATE-01 | 이관 전 `STUDY.TIMEZONE` 이 `KST` · `PST` · `BOTH` · NULL 인 스터디를 하나씩 골라 `GET /api/admin/studies/{id}` | 각각 `recruitmentTimeZones` 가 `selected [Asia/Seoul]` · `selected [America/Los_Angeles]` · `selected [Asia/Seoul, America/Los_Angeles]` · `unset []` |
| TZ-MIGRATE-02 | 이관 전후 같은 스터디의 `recruitDeadlineAt` 비교 | UTC 값이 1초도 바뀌지 않음. `canApply` · `recruitStatus` 도 그대로 |
| TZ-IANA-01 | `PATCH /api/me` 에 `Asia/Tokyo` · `Europe/London` · `US/Pacific` | 200. 저장값은 `Asia/Tokyo` · `Europe/London` · `America/Los_Angeles`(정본) |
| TZ-IANA-02 | `PATCH /api/me` 에 `+09:00` · `UTC+09:00` · `GMT+9` · `KST` | 400 `INVALID_INPUT`, 메시지 `timeZone: 지역 이름이 있는 IANA 시간대여야 합니다`. 저장값 그대로 |
| TZ-IANA-03 | 행사 등록(`POST /api/admin/events`) `timeZone=America/Vancouver`, 반 수정 `timezone=Europe/Paris` | 둘 다 성공. 네 개 목록 제한 없음 |
| TZ-CAND-01 | ADMIN 으로 `GET /api/admin/member-time-zones` | 200. `asOf` · `items[{timeZone, memberCount}]`. 인원 내림차순, 같으면 IANA 오름차순. 온보딩 안 한 계정 · 무효 값은 없음 |
| TZ-CAND-02 | 크루 하나가 `PATCH /api/me` 로 시간대를 바꾼 뒤 다시 TZ-CAND-01 | 옛 지역 인원 −1, 새 지역 +1. 60초를 기다리지 않아도 바로 반영 |
| TZ-CAND-03 | 그 지역의 마지막 회원이 탈퇴한 뒤 TZ-CAND-01 | 그 지역이 `items` 에서 빠짐 |
| TZ-CAND-04 | 토큰 없이 · 크루 토큰으로 TZ-CAND-01 | 401 · 403 |
| TZ-HEADER-01 | `GET /api/admin/me/display-time-zone` (저장한 적 없음) | `timeZone: null`, `profileTimeZone` = 프로필, `effectiveDisplayTimeZone` = 프로필(없으면 `Asia/Seoul`) |
| TZ-HEADER-02 | `PATCH … {"timeZone":"America/Toronto"}` → GET | `timeZone` · `effectiveDisplayTimeZone` 이 토론토. `GET /api/me` 의 `timeZone` 은 그대로 |
| TZ-HEADER-03 | 헤더를 바꾸기 전후 같은 스터디 `GET /api/admin/studies/{id}` | `recruitDeadlineAt` 동일. `recruitDeadlineFormatted.displayTimeZone` · `localDate` · `localTime` 만 바뀜 |
| TZ-HEADER-04 | `PATCH … {"timeZone":"+09:00"}` · `""` | 400 `INVALID_INPUT`, 저장값 그대로 |
| TZ-STUDY-01 | 백오피스 등록 `POST /api/admin/studies?displayTimeZone=America/Toronto` 에 `recruitDeadline: "YYYY-MM-DD"` · `recruitmentTimeZones: {mode: selected, zones: [Asia/Seoul, America/Los_Angeles]}` | 201. 상세의 `recruitDeadlineAt` = 그 날짜 토론토 23:59:59 의 UTC, `recruitmentTimeZoneLabel` = `한국 / 미국 · LA` |
| TZ-STUDY-02 | 마감을 보내지 않고 다른 칸만 `PATCH …?displayTimeZone=America/Los_Angeles` | `recruitDeadlineAt` 그대로 |
| TZ-STUDY-03 | `recruitmentTimeZones` 에 `{mode: selected, zones: []}` · `{mode: all, zones: [Asia/Seoul]}` · `+09:00` | 400 `INVALID_INPUT` |
| TZ-FILTER-01 | `GET /api/studies?recruitmentZone=Asia/Seoul` 과 `…=America/Los_Angeles` | 한국 + LA 스터디가 두 목록 모두에 나옴. `all` · `unset` 스터디도 두 목록에 나옴. LA 만 고른 스터디는 서울 목록에 없음 |
| TZ-FILTER-02 | `GET /api/studies/recruitment-zones` | 공개 스터디가 고른 지역만 한 줄씩(한국 → 미국 → 캐나다 …). 비공개(DRAFT) 스터디의 지역 · 조합 옵션 · `all` · `unset` 항목 없음. 서울 `recruitmentZoneShortLabel` = `한국`, LA = `미국 · LA` |
| TZ-FILTER-03 | `GET /api/studies?recruitmentZone=%2B09:00` · `?timezone=KST` | 앞은 400. 뒤(옛 Query)는 무시되어 전체 목록 |
| TZ-DEADLINE-01 | 같은 스터디를 `GET /api/studies/{id}?timeZone=Asia/Seoul` · `America/Los_Angeles` · `America/Toronto` (비로그인) | `canApply` · `recruitStatus` 셋 다 같음. `recruitDeadlineFormatted.localDate` · `dDay` 는 다를 수 있음. 약칭 KST · PDT/PST · EDT/EST |
| TZ-DEADLINE-02 | 마감이 지난 스터디를 TZ-DEADLINE-01 처럼 조회 | 셋 다 `canApply=false` · `RECRUIT_CLOSED` · `dDay=null` |
| TZ-DEADLINE-03 | 프로필이 토론토인 크루로 `GET /api/studies/{id}?timeZone=Asia/Seoul` | `displayTimeZone` = `America/Toronto` (사이트는 프로필이 먼저) |
| TZ-VAN-01 | 2026-11 마감인 스터디를 `GET /api/studies/{id}?timeZone=America/Vancouver` 로 조회 | 약칭 `PCT`, `offsetLabel` `UTC-07:00`. 같은 순간 LA 는 `PST` 로 한 시간 이르다 |
| TZ-DASH-01 | `GET /api/admin/stats/summary?timeZone=America/Toronto` (프로필 서울) | 응답 `timeZone` = `America/Toronto` — 프로필로 덮어쓰지 않음 |
| TZ-DASH-02 | Query 없이 TZ-DASH-01, 헤더를 저장한 운영자 | 응답 `timeZone` = 저장한 헤더 |
| TZ-DASH-03 | `GET /api/admin/stats/crew-timezones` | `code` 가 IANA · `other` · `unset`. 5칸 이하. 칸 인원 합 = `totalCrew`. `other` 에만 `breakdown[]` |
| TZ-DASH-04 | `GET /api/admin/stats/study-board?view=RECRUITMENT&timeZone=America/Los_Angeles` | 항목에 `recruitDeadlineFormatted`(LA 기준 날짜 · `dDay`). `deadlineBadge` 는 시간대와 무관하게 같음 |

로컬 회귀 테스트: `backend/api/src/test/java/com/studyclub/api/timezone/` · `StudyListIntegrationTest` · `StudyDeadlineTimeZoneIntegrationTest` · `AdminStudyCrudIntegrationTest` · `AdminStatsIntegrationTest` · `CrewTimeZoneDistributionTest`, 공통 규칙은 `backend/domain/src/test/java/com/studyclub/common/time/`.
