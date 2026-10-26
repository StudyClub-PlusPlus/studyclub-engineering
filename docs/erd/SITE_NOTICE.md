# SITE_NOTICE — 사이트 공지

캡틴이 스터디클럽 사이트 전체에 알리는 글. 운영 콘솔에서 쓰고 사용자 사이트에서 읽는다 — 같은 행의 두 화면이다.
네비게이터가 자기 반에 보내는 반 공지(`STUDY_NOTICE`, ST-016)와는 다른 테이블이다.

> 스펙: [site-notice](../../specs/site-notice/spec.md)

## 컬럼

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | 게시 순서이기도 하다 — 목록 정렬·이전·다음 공지 계산이 이 값으로 한다 |
| TITLE | VARCHAR(200) | N | 앞뒤 공백을 자른 값. 화면 권장은 40자, 서버 상한이 200 |
| BODY | TEXT | N | 서식 없는 글. 줄바꿈은 `\n` 으로 통일해 저장. 글자 수 상한(20,000)은 앱이 본다 |
| AUTHOR_ACCOUNT_ID | BIGINT | N | 등록한 캡틴. [ACCOUNT](./ACCOUNT.md) ID. FK 없음. 수정해도 바뀌지 않는다 |
| REMOVED_AT | DATETIME | Y | 소프트 삭제 시각. NULL 이면 살아 있는 공지. 한 번 적히면 되돌리지 않는다 |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity`. CREATED_AT 이 **게시 시각** — 예약 게시가 없어 등록 시각과 같다. UPDATED_AT 이 「마지막 수정」 |

## 관계

- N : 1 [ACCOUNT](./ACCOUNT.md) — 작성자 (`AUTHOR_ACCOUNT_ID`). **FK 를 걸지 않는다** (애그리거트 사이 — [database-guide](../backend-development-guide/database-guide.md#외래키-정책)).
  작성자가 탈퇴해 `ACCOUNT` 행이 없어져도 공지는 남고, 콘솔 작성자 칸은 「탈퇴한 회원」으로 보인다

## 상태

상태 컬럼은 없다. 살아 있는지는 `REMOVED_AT` 하나로 가른다.

| 상태 | 조건 | 어디에 보이나 |
|---|---|---|
| 게시 중 | `REMOVED_AT IS NULL` | 사이트 목록·상세, 콘솔 목록 |
| 삭제됨 | `REMOVED_AT IS NOT NULL` | 어디에도 안 보인다. 주소로 들어오면 404 |

초안·예약·고정·비공개는 없다. 등록되면 바로 「게시 중」이다.

## 제약

- 인덱스 `idx_site_notice_removed_id (REMOVED_AT, ID)` — 사이트 목록(`WHERE REMOVED_AT IS NULL ORDER BY ID DESC`)과 이웃 공지(`ID > :id` 최소 · `ID < :id` 최대)가 탄다
- `AUTHOR_ACCOUNT_ID` 에는 인덱스를 두지 않는다 — 규약은 다른 애그리거트 참조에 인덱스를 두라고 하지만, 작성자로 공지를 찾는 조회가 없고 닉네임은 `ACCOUNT` 기본키로 조인해서 쓰일 자리가 없다. 작성자 검색이 생기면 그때 추가한다
- 물리 삭제하지 않는다. 지우기는 `REMOVED_AT` 갱신 한 번이다
- 쓰기(등록·수정·삭제)는 캡틴만. 읽기는 비로그인 포함 누구나 — 인가는 API 가 본다

## 미확정

- `TITLE` 길이 200 · 본문 20,000자 — 기획에 숫자가 없어 스펙이 정한 값이다. 기획이 바꾸면 이 컬럼 타입도 같이 바뀐다 ([스펙 미확정](../../specs/site-notice/spec.md#미확정))
