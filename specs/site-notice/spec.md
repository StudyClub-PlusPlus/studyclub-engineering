# 사이트 공지 API Spec — 캡틴이 올리고, 누구나 읽는다

> ERD: [SITE_NOTICE](../../docs/erd/SITE_NOTICE.md)
> 생성일: 2026-10-25
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 스터디클럽 웹사이트에 공지를 올릴 수 있다](../../01-planning/stories/captain-post-notice/PRD.md) (ST-033)
> - [크루는 스터디클럽 공지를 확인할 수 있다](../../01-planning/stories/crew-view-notices/PRD.md) (ST-034)
>
> 기준 프로토타입: playground `/proto/console/notices` (쓰는 쪽) · `/proto/core/ko/notices` (읽는 쪽)
> 실제 경로: back-office-front `/notices` · core-front `/[locale]/notices` · `/[locale]/notices/[id]`

## 엔드포인트 목록

**사용자 사이트 — `/api/notices` (`SiteNoticeController`)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/notices | 공지 목록 — 제목 · 게시일. 게시일 내림차순, 10건씩 | X | 스펙작성중 |
| GET | /api/notices/{noticeId} | 공지 상세 — 제목 · 게시일 · 본문 + 이전·다음 공지 | X | 스펙작성중 |

**백오피스 — `/api/admin/notices` (`AdminSiteNoticeController`, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/notices | 공지 목록 — 작성자 · 마지막 수정 포함. 제목 검색, 열 정렬, 20건씩 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/notices/{noticeId} | 공지 하나 — 편집 팝업을 채운다 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/notices | 공지 등록 — 제목 · 본문. 등록 즉시 사이트에 보인다 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/notices/{noticeId} | 공지 수정 — 제목 · 본문 | O (ADMIN) | 스펙작성중 |
| DELETE | /api/admin/notices/{noticeId} | 공지 삭제 — 소프트 삭제 | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## 먼저 읽을 것

**사이트 전체 공지다.** 네비게이터가 자기 반에 보내는 스터디 공지(ST-016, `specs/study-notice`)와는 다른 기능이고 다른 테이블이다.
이름이 겹치지 않게 코드·테이블·폴더 전부 `SiteNotice` · `SITE_NOTICE` · `site-notice` 로 쓴다.

**공개 단계가 없다.** 등록하면 그 순간 사이트에 보인다. 초안 · 예약 · 고정 · 분류 · 알림 메일이 없다.
그래서 **게시 시각 = 등록 시각(`CREATED_AT`)** 이고, 게시 시각 컬럼을 따로 두지 않는다.

**본문은 서식 없는 글이다.** 서버는 받은 글자를 그대로 저장하고 그대로 돌려준다. 줄바꿈을 살리고 URL 을 링크로 바꾸는 일은 화면이 한다.
HTML 로 해석하지 않으므로 서버가 태그를 걸러 내거나 바꾸지 않는다.

**삭제는 소프트 삭제다.** 행을 지우지 않고 `REMOVED_AT` 만 적는다. 되돌리는 길은 없다.
삭제된 공지는 사이트·콘솔 어느 응답에도 나오지 않고, 주소로 들어오면 404 다. **거르는 일은 전부 서버가 한다.**

**순서는 등록 순서다.** 게시 시각이 등록 시각이라 게시일 내림차순은 `ID` 내림차순과 같다.
목록 정렬과 이전·다음 계산은 `ID` 로 한다 — 같은 초에 두 건이 들어와도 순서가 흔들리지 않는다.

### 인가

- `/api/admin/notices/**` 는 `@RequireAdmin`. 토큰의 계정이 `SYSTEM_ROLE = ADMIN` 이 아니면 403, 토큰이 없으면 401. 라우팅으로 막지 않고 서버가 요청마다 본다
- `GET /api/notices` · `GET /api/notices/*` 두 패턴만 보안 설정의 공개 GET 목록에 올린다 — 비로그인 방문자도 읽는다. `/api/notices/**` 를 통째로 열지 않는다
- 인가 실패는 공지가 있는지보다 먼저 판정한다 — 없는 ID 로 크루가 부르면 404 가 아니라 403
- 권한표의 「사이트 공지 발행」(`NOTICE_SITE`) 은 이미 캡틴만으로 들어가 있다. 이 스펙은 그 행을 바꾸지 않는다

### 기획 문서와 다른 곳

- `GET /api/admin/notices/{noticeId}` 를 더 둔다. 편집 팝업이 본문을 채워야 하는데, 콘솔 목록 응답에 본문을 다 실으면 20건마다 본문 전체가 따라온다. 팝업을 열 때 한 건만 받는다
- 콘솔 목록의 검색·정렬은 서버가 한다. 20건씩 서버 페이지라 화면에서 정렬하면 한 페이지 안에서만 섞인다
- 게시 시각 컬럼을 따로 두지 않는다. `CREATED_AT` 이 게시 시각이다 — 예약 게시가 없어 둘이 언제나 같다
- 소프트 삭제 컬럼은 기획의 `DELETED_AT` 이 아니라 ERD 규약대로 `REMOVED_AT` 이다

---

## 공지 목록 (사이트)

### 기본 정보

- **Method**: GET
- **Path**: `/api/notices`
- **인증**: 불필요
- **설명**: 삭제되지 않은 공지를 최신순으로. 제목과 게시일만 — 본문·작성자는 주지 않는다

### Path Parameters

없음

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 10 | 1 ~ 100. 화면은 10 고정 |

### Request Body

없음

### Response — 200

```json
{
  "items": [
    { "noticeId": 12, "title": "11월 스터디 모집 일정 안내", "publishedAt": "2026-10-20T09:00:00Z" },
    { "noticeId": 11, "title": "디스코드 서버 점검 안내", "publishedAt": "2026-10-18T02:30:00Z" }
  ],
  "total": 2,
  "offset": 0,
  "limit": 10
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].noticeId | Long | N | | SITE_NOTICE.ID |
| items[].title | String | N | 제목 전체. 한 줄로 자르는 건 화면이 한다 | SITE_NOTICE.TITLE |
| items[].publishedAt | String | N | 게시 시각. UTC ISO 8601 | SITE_NOTICE.CREATED_AT |
| total | Long | N | 삭제되지 않은 공지 수 | 계산: `COUNT WHERE REMOVED_AT IS NULL` |
| offset · limit | Integer | N | 요청 값 그대로 | — |

- 정렬: `ID DESC` 고정. 바꾸는 파라미터는 없다
- `offset` 이 `total` 이상이면 `items = []`, `total` 은 실제 값

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `offset < 0` · `limit` 이 1~100 밖 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/notices/page.tsx` — 서버 컴포넌트. `?page=N` 을 `offset = (N-1) × 10` 으로 바꿔 부른다
- `frontend/apps/core-front/src/lib/api.ts` — `fetchNotices(offset, limit)`. 캐시하지 않는다(`no-store`) — 등록 즉시 보여야 한다

---

## 공지 상세 (사이트)

### 기본 정보

- **Method**: GET
- **Path**: `/api/notices/{noticeId}`
- **인증**: 불필요
- **설명**: 공지 한 건과 이웃 두 건의 제목. 이웃도 삭제되지 않은 것 중에서 고른다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| noticeId | Long | 공지 ID |

### Query Parameters / Request Body

없음

### Response — 200

```json
{
  "noticeId": 11,
  "title": "디스코드 서버 점검 안내",
  "body": "10월 19일(일) 02:00~04:00 KST 서버 점검이 있습니다.\n\n자세한 내용: https://studyclub.life/ko/notices/11",
  "publishedAt": "2026-10-18T02:30:00Z",
  "newer": { "noticeId": 12, "title": "11월 스터디 모집 일정 안내", "publishedAt": "2026-10-20T09:00:00Z" },
  "older": null
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| noticeId | Long | N | | SITE_NOTICE.ID |
| title | String | N | 전체. 상세는 자르지 않는다 | SITE_NOTICE.TITLE |
| body | String | N | 저장한 그대로. 줄바꿈은 `\n` | SITE_NOTICE.BODY |
| publishedAt | String | N | UTC ISO 8601 | SITE_NOTICE.CREATED_AT |
| newer | Object | Y | **더 최신** 공지 — 화면의 「다음 공지」. 이 공지가 가장 최신이면 `null` | 계산: `REMOVED_AT IS NULL AND ID > :id` 중 가장 작은 ID |
| newer.noticeId · title · publishedAt | Long · String · String | N | 이동할 공지의 제목과 게시일 | SITE_NOTICE.ID · TITLE · CREATED_AT |
| older | Object | Y | **더 오래된** 공지 — 화면의 「이전 공지」. 가장 오래된 공지면 `null` | 계산: `REMOVED_AT IS NULL AND ID < :id` 중 가장 큰 ID |
| older.noticeId · title · publishedAt | Long · String · String | N | | SITE_NOTICE.ID · TITLE · CREATED_AT |

- 이웃이 삭제됐으면 그 건을 건너뛰고 그다음 공지를 준다. 조건에 `REMOVED_AT IS NULL` 이 들어 있어 따로 처리할 게 없다
- 공지가 이 한 건뿐이면 `newer` · `older` 둘 다 `null`
- 이름을 `next` · `prev` 로 두지 않았다 — 「다음」이 최신인지 오래된 것인지 응답만 보고 알 수 없어서다. 프로토의 변수 이름과 같다
- 작성자 · 마지막 수정 시각은 주지 않는다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `noticeId` 가 숫자가 아님 |
| 404 | NOT_FOUND | 없는 ID · 삭제된 공지 — 둘을 구분하지 않는다 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/notices/[id]/page.tsx` — 404 는 `notFound()`
- `frontend/apps/core-front/src/lib/api.ts` — `fetchNotice(noticeId)`. `no-store`

---

## 공지 목록 (백오피스)

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/notices`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 삭제되지 않은 공지 전부. 작성자·마지막 수정이 붙는다. 제목 검색과 열 정렬은 서버가 한다

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| q | String | N | — | 제목 부분 일치, 대소문자 무시. 앞뒤 공백을 자르고 빈 문자열이면 조건 없음. 최대 100자. `%` · `_` 는 글자로 취급한다(LIKE 이스케이프) |
| sort | String | N | `publishedAt` | `publishedAt` \| `title` \| `updatedAt` — 화면의 열 이름과 같다 |
| order | String | N | `desc` | `asc` \| `desc` |
| offset | Integer | N | 0 | 0 이상 |
| limit | Integer | N | 20 | 1 ~ 100. 화면은 20 고정 |

### 정렬

| sort | 기준 컬럼 |
|---|---|
| `publishedAt` | `ID` — 게시 시각이 등록 시각이라 같은 순서다 |
| `title` | `TITLE` (DB 콜레이션 `utf8mb4_unicode_ci`, 대소문자 무시) |
| `updatedAt` | `UPDATED_AT` |

- 같은 값끼리는 `ID DESC` 로 다시 정렬한다 — 페이지를 넘길 때 순서가 흔들리지 않게
- 기본은 `publishedAt desc`. 화면도 처음부터 그 열이 강조된 상태로 시작한다

### Request Body

없음

### Response — 200

```json
{
  "items": [
    {
      "noticeId": 12,
      "title": "11월 스터디 모집 일정 안내",
      "author": "honggildong",
      "publishedAt": "2026-10-20T09:00:00Z",
      "updatedAt": "2026-10-21T01:12:40Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items[].noticeId | Long | N | | SITE_NOTICE.ID |
| items[].title | String | N | | SITE_NOTICE.TITLE |
| items[].author | String | N | 등록한 캡틴의 닉네임. 계정이 탈퇴해 없으면 `"탈퇴한 회원"` — 출석부·신청자 목록과 같은 문구 | ACCOUNT.NICKNAME (`SITE_NOTICE.AUTHOR_ACCOUNT_ID` 로 LEFT JOIN) |
| items[].publishedAt | String | N | UTC ISO 8601 | SITE_NOTICE.CREATED_AT |
| items[].updatedAt | String | N | 마지막 수정. 등록만 했으면 `publishedAt` 과 같다 | SITE_NOTICE.UPDATED_AT |
| total | Long | N | 검색을 건 뒤 수 | 계산 |
| offset · limit | Integer | N | 요청 값 그대로 | — |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `q` 100자 초과 · `sort` · `order` 가 위 값 밖 · `offset < 0` · `limit` 범위 밖 |
| 401 | UNAUTHORIZED | 토큰 없음 · 토큰의 계정이 없음 |
| 403 | FORBIDDEN | 캡틴이 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/app/notices/page.tsx` — 검색·정렬·페이지를 주소(`?q=&sort=&order=&page=`)에 둔다. 회원 목록과 같은 방식
- `frontend/apps/back-office-front/src/features/site-notices/queries.ts` — `useSiteNotices(filter)`

---

## 공지 하나 (백오피스)

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/notices/{noticeId}`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 편집 팝업을 채울 한 건. 목록 행에는 본문이 없어서 팝업을 열 때 이걸 부른다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| noticeId | Long | 공지 ID |

### Query Parameters / Request Body

없음

### Response — 200

```json
{
  "noticeId": 12,
  "title": "11월 스터디 모집 일정 안내",
  "body": "11월 스터디 모집은 10월 27일(월)부터 시작합니다.",
  "author": "honggildong",
  "publishedAt": "2026-10-20T09:00:00Z",
  "updatedAt": "2026-10-21T01:12:40Z"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| noticeId | Long | N | | SITE_NOTICE.ID |
| title | String | N | | SITE_NOTICE.TITLE |
| body | String | N | 저장한 그대로 | SITE_NOTICE.BODY |
| author | String | N | 목록과 같다 | ACCOUNT.NICKNAME |
| publishedAt | String | N | | SITE_NOTICE.CREATED_AT |
| updatedAt | String | N | | SITE_NOTICE.UPDATED_AT |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `noticeId` 가 숫자가 아님 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | 위와 같다 |
| 404 | NOT_FOUND | 없는 ID · 삭제된 공지 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/features/site-notices/queries.ts` — `useSiteNotice(noticeId)`. 팝업이 열릴 때만 부른다

---

## 공지 등록

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/notices`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 제목 · 본문으로 공지 한 건을 만든다. 작성자는 토큰의 계정. 응답이 돌아온 순간 사이트 목록 맨 위에 있다

### Request Body

```json
{
  "title": "11월 스터디 모집 일정 안내",
  "body": "11월 스터디 모집은 10월 27일(월)부터 시작합니다.\n자세한 일정은 디스코드 공지 채널을 확인해 주세요."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | String | O | 앞뒤 공백을 자르고 **자른 값을 저장한다**. 자른 뒤 1~200자. 화면의 「권장 40자」는 안내일 뿐 서버는 200자까지 받는다 |
| body | String | O | 공백·줄바꿈만으로 이루어지면 비어 있는 것으로 본다. 1~20,000자. 앞뒤 공백·줄바꿈은 자르지 않는다 — 글쓴이가 넣은 그대로 보인다 |

- 글자 수는 Java `String.length()` 기준(UTF-16 단위)이다. 이모지 하나가 2로 센다
- 줄바꿈 `\r\n` 은 `\n` 으로 바꿔 저장한다. 본문에서 서버가 바꾸는 건 이것뿐이다

- 작성자(`AUTHOR_ACCOUNT_ID`)는 받지 않는다. 보내도 무시한다
- 줄바꿈 통일 말고는 본문의 글자를 바꾸지 않는다. HTML 이스케이프·태그 제거·URL 변환은 서버가 하지 않는다 — 화면이 글자 그대로 그리기 때문이다

### Response — 201 Created

본문 없음. `Location: /api/admin/notices/{noticeId}`.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 제목이 비었거나 200자 초과 · 본문이 비었거나 20,000자 초과 |
| 401 | UNAUTHORIZED | 토큰 없음 · 토큰의 계정이 없음 |
| 403 | FORBIDDEN | 캡틴이 아님 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/features/site-notices/queries.ts` — `useCreateSiteNotice()`. 성공하면 목록 키를 무효화해 다시 받는다
- 빈 칸 검사는 화면이 먼저 한다(그 칸 아래 사유). 서버 400 은 둘째 방어선이다

---

## 공지 수정

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/notices/{noticeId}`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: 제목 · 본문을 바꾼다. 팝업이 두 값을 다 보내므로 둘 다 필수다. `UPDATED_AT` 이 갱신된다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| noticeId | Long | 공지 ID |

### Request Body

등록과 같다. `title` · `body` 둘 다 필수, 같은 규칙.

- 작성자는 바뀌지 않는다 — 처음 등록한 캡틴이 남는다
- 값이 그대로여도 204 로 답한다. 「바뀐 게 없다」를 따로 판정하지 않는다. 다만 `UPDATED_AT` 은 실제로 바뀐 게 있을 때만 갱신된다 — 감사 컬럼은 손으로 채우지 않는다

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 등록과 같다 · `noticeId` 가 숫자가 아님 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | 위와 같다 |
| 404 | NOT_FOUND | 없는 ID · 삭제된 공지 |

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/features/site-notices/queries.ts` — `useUpdateSiteNotice()`

---

## 공지 삭제

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/admin/notices/{noticeId}`
- **인증**: 필요 — `@RequireAdmin`
- **설명**: `REMOVED_AT = now` 를 적는다. 행은 남는다. 이 뒤로 사이트·콘솔 어디에도 나오지 않는다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| noticeId | Long | 공지 ID |

### Request Body

없음

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `noticeId` 가 숫자가 아님 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | 위와 같다 |
| 404 | NOT_FOUND | 없는 ID · **이미 삭제된 공지** — 두 번 눌러도 두 번째는 404 |

- 되돌리는 API 는 없다. 삭제 확인 단계는 화면이 가진다

### 프론트엔드 사용처

- `frontend/apps/back-office-front/src/features/site-notices/queries.ts` — `useDeleteSiteNotice()`

---

## 스키마

**테이블 1개 추가** — [`SITE_NOTICE`](../../docs/erd/SITE_NOTICE.md). ERD 문서는 이 PR 에, 마이그레이션(`V{n}__site_notice.sql`)과 엔티티는 구현 PR 에 넣는다.
번호는 구현 PR 을 올릴 때의 `beta` 최신 번호 다음. 지금 `beta` 최신은 V40(스터디 시간대)이다. ST-016 반 공지 PR 은 V40·V41 을 쓰고 있어 `beta` 와 이미 겹치므로, 그쪽이 번호를 다시 받으면 이 테이블의 번호도 그 뒤로 간다.

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| TITLE | VARCHAR(200) | N | |
| BODY | TEXT | N | 서식 없는 글. 20,000자 상한은 앱이 본다 |
| AUTHOR_ACCOUNT_ID | BIGINT | N | 등록한 캡틴. FK 없음 |
| REMOVED_AT | DATETIME | Y | 소프트 삭제 시각. NULL 이면 살아 있다 |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity`. CREATED_AT 이 게시 시각 |

- 인덱스 `(REMOVED_AT, ID)` — 사이트 목록·이웃 계산이 「살아 있는 것 중 ID 순」으로 탄다
- 삭제도 `REMOVED_AT` 을 적는 UPDATE 라 `UPDATED_AT` 이 같이 올라간다. 삭제된 행은 어디에도 안 보이니 화면에는 영향이 없다
- 그 밖에 읽는 컬럼: `ACCOUNT.NICKNAME` (작성자 표시). 기존 테이블은 바꾸지 않는다

## 테스트 (구현 PR 기준)

통합 — 스펙의 성공·에러 응답 그대로.

| 대상 | 경우 | 기대 |
|---|---|---|
| GET 사이트 목록 | 토큰 없음 | 200, `ID DESC`, 삭제 건 없음, `total` 은 살아 있는 수, 작성자 필드 없음 |
| | `offset ≥ total` · `limit=0` · `limit=101` | 200 `items=[]` · 400 · 400 |
| GET 사이트 상세 | 가운데 공지 | `newer` 는 더 큰 ID 중 최소, `older` 는 더 작은 ID 중 최대 |
| | 바로 옆이 삭제됨 | 그 건을 건너뛴 이웃 |
| | 가장 최신 · 가장 오래된 · 하나뿐 | `newer=null` · `older=null` · 둘 다 `null` |
| | 삭제된 ID · 없는 ID · `abc` | 404 · 404 · 400 |
| GET 콘솔 목록 | ADMIN | 200, `author` 닉네임, 삭제 건 없음 |
| | `q` 부분 일치(대소문자 무시) · `%` 포함 | 걸림 · 글자로 취급 |
| | `sort=title&order=asc` · `sort=updatedAt` | 그 열 기준, 제목은 대소문자 무시, 같은 값은 `ID DESC` |
| | 작성자 계정이 탈퇴 | `author = "탈퇴한 회원"`, 공지는 그대로 |
| | MEMBER · 토큰 없음 · `sort=foo` · `q` 101자 | 403 · 401 · 400 · 400 |
| GET 콘솔 하나 | ADMIN · 삭제된 ID | 200 본문 포함 · 404 |
| | 작성자 계정이 탈퇴 | `author = "탈퇴한 회원"` |
| POST | ADMIN, 정상 | 201 + `Location`, 작성자 = 요청자, 바로 사이트 목록 맨 위 |
| | 제목 공백만 · 201자 · 본문 줄바꿈만 · 20,001자 | 400 |
| | 제목 앞뒤 공백 | 자른 값이 저장됨 |
| | 본문에 `<b>태그</b>` · 앞뒤 줄바꿈 · `\r\n` | 글자 그대로 · 그대로 · `\n` 으로 저장 |
| | MEMBER | 403, 행 없음 |
| PATCH | ADMIN, 값이 바뀜 | 204, 값 반영, `UPDATED_AT` 갱신, 작성자 불변 |
| | 삭제된 ID · 빈 제목 | 404 · 400 |
| | MEMBER · 토큰 없음 | 403 · 401, 값 그대로 |
| | MEMBER 가 없는 ID 로 | 403 — 404 가 아니다 |
| DELETE | ADMIN | 204, `REMOVED_AT` 기록, 사이트 상세 404, 목록에서 빠짐 |
| | 같은 ID 두 번 | 두 번째 404 |
| | MEMBER · 토큰 없음 | 403 · 401, `REMOVED_AT` 그대로 NULL |

## 퍼널·계측

해당 없음 — 공지 열람·등록은 가입·활성화 이벤트를 만들지 않는다. 지표에 기대하는 변화도 없다.

## 범위 밖

- 본문 서식(굵게 · 목록 · 링크 삽입) · 이미지 · 표
- 분류 · 상단 고정 · 예약 게시 · 초안 · 알림 메일 · 새 공지 뱃지
- 조회수 · 댓글 · 반응
- 영어 본문 — 한 언어로만 쓴다. 영어 화면도 같은 글을 보인다
- 삭제 복구 · 삭제된 공지 목록
- 사이트 검색

## 결정 기록

- **`SiteNotice` 로 이름을 가른다** — 같은 시기에 반 공지(`StudyNotice`, ST-016)가 들어온다. 패키지·테이블·프론트 폴더가 `notice` 하나면 둘이 섞인다
- **게시 시각 컬럼을 두지 않는다** — 예약 게시가 없어 게시 시각은 언제나 등록 시각이다. 열이 둘이면 어긋날 길만 생긴다
- **정렬·이웃은 `ID` 로** — 게시일과 같은 순서이면서 같은 초에 들어온 두 건도 순서가 고정된다
- **소프트 삭제 컬럼 이름은 `REMOVED_AT`** — 기획은 `DELETED_AT` 으로 적었지만 ERD 규약이 소프트 삭제 컬럼을 `REMOVED_AT` 으로 정해 두었다. 규약을 따르고, 기획 문서는 구현 PR 에서 맞춘다
- **콘솔용 한 건 조회를 둔다** — 목록 행에 본문을 싣지 않기 위해서다. 사이트 상세를 콘솔이 같이 쓰지 않는다 — 관객이 다른 경로는 섞지 않는다
- **수정은 PATCH, 두 필드 모두 필수** — 팝업이 제목·본문을 한 번에 저장하므로 부분 수정이 없다. 그래도 기획과 스터디 수정 API 가 쓰는 PATCH 를 그대로 쓴다 — 메서드를 PUT 으로 달리 둘 이유가 없다
- **정렬은 `sort` + `order` 두 파라미터로 받는다** — 어느 열로 정렬할지(`sort`)와 오름차순인지 내림차순인지(`order`)를 따로 보낸다. 스터디 목록은 `ID_DESC` 처럼 열과 방향을 합친 값 하나로 받지만, 공지 목록은 열이 셋이고 열마다 방향을 뒤집을 수 있어 합치면 값이 여섯 개가 된다. 화면이 지금 누른 열과 방향을 그대로 보내는 쪽이 단순하다
- **삭제된 공지는 404** — 「있었는데 지워졌다」를 알려 줄 이유가 없다. 없는 ID 와 같게 답한다
- **작성자 탈퇴 표시는 서버가 문구로** — 출석부·신청자 목록이 이미 `"탈퇴한 회원"` 을 서버에서 내려 준다. 같은 방식

## 미확정

- [NEEDS CLARIFICATION] 제목 200자 · 본문 20,000자 상한 — 기획에 숫자가 없어 이 스펙이 정했다. 반 공지(제목 60 · 본문 1,500)보다 넉넉하게 둔 이유는 사이트 공지가 일정표·여러 단락을 담기 때문이다. 기획이 다른 값을 원하면 여기만 바꾼다
