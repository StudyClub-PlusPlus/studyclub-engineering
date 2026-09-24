# STUDY_PROGRAM — 스터디 / 클럽 (정체성)

모집 공고이자 운영 단위의 **영속적 식별자**. 실제 모집·정원·기간·커리큘럼 등
회차마다 달라질 수 있는 값은 [STUDY](./STUDY.md) 로 옮겼다 —
"스터디 자체가 무엇인가"만 여기 남고, "이번 기수는 어떻게 운영되는가"는 STUDY 가 답한다.

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| TITLE | VARCHAR(200) | N | |
| STUDY_KIND | VARCHAR(20) | N | 아래 |

> ONE_LINE_SUMMARY · DESCRIPTION · CATEGORY · THUMBNAIL_URL
> 및 운영 필드(STATUS · APPLICATION_FORM · CURRICULUM ·
> START_AT/END_AT · DISCORD_CHANNEL_URL · DRIVE_URL)는
> 기수마다 달라지므로 전부 [STUDY](./STUDY.md) 로 이동했다.

## STUDY_KIND

| 값 | 뜻 |
|---|---|
| `STUDY` | 스터디. 한 번 모집해 한 번 진행. 이 프로그램에 STUDY 를 딱 1개만 갖는다 |
| `CLUB` | 클럽. 기수제로 반복 — 이 프로그램에 STUDY 가 여러 개 쌓인다 |

**종류는 한 번 정하면 바꾸지 못한다** — 스터디를 클럽으로 바꾸는 길도, 되돌리는 길도 없다. 종류에 따른 참여 신청 차이는 [STUDY](./STUDY.md#참여-신청--프로그램-종류에-따라-다르다) 참고.

## 관리 — 프로그램만 따로 등록하지 않는다

프로그램은 `TITLE`·`STUDY_KIND` 뿐이고, 기수(STUDY) 없는 프로그램은 의미가 없다. 그래서 별도 등록·목록 화면을 두지 않고
스터디 등록 흐름에서 함께 다룬다.

| 언제 | 어떻게 |
|---|---|
| 첫 스터디를 등록할 때 | 「새 프로그램」 — 프로그램과 첫 기수가 한 번에 만들어진다. 종류(`STUDY_KIND`)는 이때 정한다 (기본 `STUDY`) |
| 클럽의 새 기수를 낼 때 | 등록 폼의 「기존 클럽의 새 기수」 또는 클럽 운영 화면의 「다음 기수 만들기」 — 제목은 프로그램 제목, 한 줄 소개·상세 설명·주제는 최신 기수의 것으로 채워 시작한다. 새 기수는 `PROGRAM_ID` 로 같은 프로그램에 붙는다 |

새 기수를 붙일 수 있는 것은 `CLUB` 뿐이다 — `STUDY` 는 기수가 1개다.

**직전 기수가 끝나기(`ENDED`) 전에도 새 기수를 만들 수 있다** — 롤링 모집. 형제 기수의 `STATUS` 는
새 기수 생성을 막는 조건이 아니다. 이 때문에 한 프로그램 안에 `ONGOING` 기수와 `OPEN`(모집 중) 기수가
동시에 존재할 수 있다 — [STUDY](./STUDY.md#채널-삭제와-closed) 의 "최신 기수" 판정이 상태가 아니라
`ID`(생성 순서) 만으로 정해지는 이유다.

## 관계
- 1 : N [STUDY](./STUDY.md) — 실제 회차/기수. 반이 하나뿐인 스터디도, 클럽도 STUDY 를 1개 가진다
- 1 : N [STUDY_BOOKMARK](./STUDY_BOOKMARK.md) — 스터디 시리즈 자체를 북마크 (기수 무관)
- 1 : N [STUDY_REVIEW](./STUDY_REVIEW.md) — 정본 FK 는 STUDY_ID, STUDY_PROGRAM_ID 는 스터디 상세 페이지 후기 조회용 비정규화 컬럼

## 제약

> 탐색 목록 쿼리용 인덱스는 [STUDY](./STUDY.md#제약) 참고.

## 미확정
- 국/영문 이중 제목(`TITLE_KO/EN`) — 표 설계에 있음. 프론트가 ko/en 이라 필요할 수 있다.
