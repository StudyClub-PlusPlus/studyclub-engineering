# STUDY — 스터디 / 클럽 (정체성)

모집 공고이자 운영 단위의 **영속적 식별자**. 실제 모집·정원·기간·커리큘럼 등
회차마다 달라질 수 있는 값은 [STUDY_COHORT](./STUDY_COHORT.md) 로 옮겼다 —
"스터디 자체가 무엇인가"만 여기 남고, "이번 기수는 어떻게 운영되는가"는 코호트가 답한다.

**스터디** = 1회성, **클럽** = 기수제·반복 — 둘은 같은 테이블이고 `STUDY_KIND` 으로 구분한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| SLUG | VARCHAR(100) | N | URL 식별자. UNIQUE |
| TITLE | VARCHAR(200) | N | |
| DESCRIPTION | TEXT | Y | 상세 소개 |
| CATEGORY | VARCHAR(50) | N | 분야 (`AI`, `BACKEND`, `PAPER` …) |
| STUDY_KIND | VARCHAR(20) | N | 아래 |
| THUMBNAIL_URL | VARCHAR(512) | Y | |
| IS_HIDDEN | BOOLEAN | N | 목록 노출 제어. 기본 FALSE |

> STUDY_DELIVERY_FORMAT · STATUS(모집/진행 라이프사이클) · APPLICATION_FORM · CURRICULUM · CAPACITY · RECRUIT_DEADLINE ·
> START_DATE/END_DATE · DISCORD_CHANNEL_URL · DRIVE_URL 은 기수마다 달라질 수 있고
> 지난 기수 값은 보존돼야 하므로 전부 [STUDY_COHORT](./STUDY_COHORT.md) 로 이동했다.

## 관계
- 1 : N [STUDY_COHORT](./STUDY_COHORT.md) — 실제 회차/기수. 반이 하나뿐인 스터디도, 클럽도 코호트를 1개 가진다
- 1 : N [STUDY_BOOKMARK](./STUDY_BOOKMARK.md) — 스터디 시리즈 자체를 북마크 (기수 무관)
- 1 : N [STUDY_REVIEW](./STUDY_REVIEW.md) — 정본 FK 는 STUDY_COHORT_ID, STUDY_ID 는 스터디 상세 페이지 후기 조회용 비정규화 컬럼

## STUDY_KIND

| 값 | 뜻 |
|---|---|
| `STUDY` | 스터디. 한 번 모집해 한 번 진행. 코호트를 딱 1개만 갖는다 |
| `CLUB` | 클럽. 기수제로 반복 — 코호트가 여러 개 쌓인다 |

스터디가 클럽이 되면 `STUDY → CLUB` 으로 바꾼다.

## 제약
- `UNIQUE(SLUG)`

> 탐색 목록 쿼리용 인덱스(`STATUS`, `RECRUIT_DEADLINE` 기준)는 해당 컬럼들과 함께
> [STUDY_COHORT](./STUDY_COHORT.md#제약) 로 이동했다.

## 미확정
- `CATEGORY` 를 문자열 코드로 둘지 `STUDY_CATEGORY` 테이블 FK 로 둘지.
- 국/영문 이중 제목(`TITLE_KO/EN`) — 표 설계에 있음. 프론트가 ko/en 이라 필요할 수 있다.
- 기존 데이터 마이그레이션 — 모든 기존 STUDY 행마다 코호트 1개씩 생성하며 기존 STUDY 컬럼값
  (STUDY_DELIVERY_FORMAT/STATUS/APPLICATION_FORM/CURRICULUM/CAPACITY/RECRUIT_DEADLINE/START_DATE/END_DATE/DISCORD_CHANNEL_URL/DRIVE_URL)
  을 그대로 옮겨 담기. 마이그레이션 계획은 별도 문서에서 검토 후 작성.
