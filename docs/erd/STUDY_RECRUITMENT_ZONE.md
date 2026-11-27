# STUDY_RECRUITMENT_ZONE — 모집 회차의 모집 지역

[STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md) 가 `RECRUITMENT_TZ_MODE = selected` 일 때 고른 지역 하나가 한 행이다.
모집 안내와 사이트 목록 필터(`recruitmentZone`)에만 쓴다. 신청을 막거나 반을 나누지 않는다 ([POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md)).
계약은 [timezone 스펙](../../specs/timezone/spec.md) §3.2 · §4.3.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| STUDY_RECRUITMENT_ID | BIGINT | N | 부모 모집 회차 (논리 FK — 외래키 없음, 유니크 인덱스 앞자리) |
| TIME_ZONE | VARCHAR(64) | N | 정본 IANA ID (`Asia/Seoul`). deprecated 링크(`US/Pacific`)는 저장 전에 정본으로 바꾼다. 오프셋만 있는 ID 는 들어오지 않는다 |
| CREATED_AT | DATETIME(6) | N | |
| UPDATED_AT | DATETIME(6) | N | |

## 관계
- N : 1 [STUDY_RECRUITMENT](./STUDY_RECRUITMENT.md) — 같은 애그리거트의 자식. 모집 회차(`StudyRecruitment`)를 거쳐서만 바뀐다

## 상태
없음.

## 제약
- `UNIQUE(STUDY_RECRUITMENT_ID, TIME_ZONE)` (`uk_study_recruitment_zone`) — 같은 지역을 두 번 고르지 않는다
- `RECRUITMENT_TZ_MODE = selected` 이면 1행 이상, `unset` · `all` 이면 0행 — 앱(`RecruitmentTimeZones`)이 지킨다
- 같은 오프셋의 다른 지역(서울 · 도쿄)은 합치지 않는다

## 이관 (V68)
`STUDY.TIMEZONE` 을 스터디별 최신(ID 최대) 모집 회차로 옮겼다. `KST` → `Asia/Seoul`, `PST` → `America/Los_Angeles`, `BOTH` → 둘 다. NULL 은 행을 만들지 않는다(`unset`).
