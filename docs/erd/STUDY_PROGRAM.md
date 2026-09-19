# STUDY_PROGRAM — 스터디 / 클럽 (정체성)

모집 공고이자 운영 단위의 **영속적 식별자**. 실제 모집·정원·기간·커리큘럼 등
회차마다 달라질 수 있는 값은 [STUDY](./STUDY.md) 로 옮겼다 —
"스터디 자체가 무엇인가"만 여기 남고, "이번 기수는 어떻게 운영되는가"는 STUDY 가 답한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| TITLE | VARCHAR(200) | N | |

> SLUG · ONE_LINE_SUMMARY · DESCRIPTION · CATEGORY · STUDY_KIND · THUMBNAIL_URL · IS_HIDDEN
> 및 운영 필드(STUDY_DELIVERY_FORMAT · STATUS · APPLICATION_FORM · CURRICULUM · CAPACITY ·
> START_AT/END_AT · DISCORD_CHANNEL_URL · DRIVE_URL)는
> 기수마다 달라지므로 전부 [STUDY](./STUDY.md) 로 이동했다.

## 관계
- 1 : N [STUDY](./STUDY.md) — 실제 회차/기수. 반이 하나뿐인 스터디도, 클럽도 STUDY 를 1개 가진다
- 1 : N [STUDY_BOOKMARK](./STUDY_BOOKMARK.md) — 스터디 시리즈 자체를 북마크 (기수 무관)
- 1 : N [STUDY_REVIEW](./STUDY_REVIEW.md) — 정본 FK 는 STUDY_ID, STUDY_PROGRAM_ID 는 스터디 상세 페이지 후기 조회용 비정규화 컬럼

## 제약

> 탐색 목록 쿼리용 인덱스는 [STUDY](./STUDY.md#제약) 참고.

## 미확정
- 국/영문 이중 제목(`TITLE_KO/EN`) — 표 설계에 있음. 프론트가 ko/en 이라 필요할 수 있다.
