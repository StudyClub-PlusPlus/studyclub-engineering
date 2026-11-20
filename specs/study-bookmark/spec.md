# 스터디 북마크 API Spec

> ERD: [STUDY_BOOKMARK](../../docs/erd/STUDY_BOOKMARK.md)
> Story PRD: 없음 — 찜 Story 가 [레지스트리](../../01-planning/_registry/stories.md)에 없다. 화면은 [IA-012 찜한 스터디](../../01-planning/_registry/informationarchitecture.md) (고아 화면)
> 생성일: 2026-09-08
> 상태: 구현중

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | `/api/me/bookmarks` | 북마크된 스터디 목록 (페이지네이션) | O | 구현중 |
| POST | `/api/me/bookmarks/{studyId}` | 북마크 추가 (멱등) | O | 구현중 |
| DELETE | `/api/me/bookmarks/{studyId}` | 북마크 해제 (멱등) | O | 구현중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 공통 사항

- **accountId**: 요청 파라미터가 아닌 JWT 토큰의 Security Context(`authentication.getPrincipal()`)에서 추출한다. 그래서 본인 북마크만 읽고 쓴다.
- **온보딩**: 세 엔드포인트 모두 `@RequireOnboarding` — 온보딩을 마치지 않은 회원은 `403`. 사이트는 그 회원(과 비로그인 방문자)의 하트를 이 브라우저에만 둔다.
- **500**: 모든 엔드포인트는 예기치 않은 서버 오류 시 `500 INTERNAL_ERROR` 를 반환할 수 있다.

---

## GET /api/me/bookmarks

### 기본 정보

- **Method**: GET
- **Path**: `/api/me/bookmarks`
- **인증**: 필요
- **설명**: 로그인한 회원의 북마크된 스터디 목록을 페이지네이션으로 반환한다

### Query Parameters

| 이름 | 타입 | 기본값 | 제약 | 설명 |
|------|------|--------|------|------|
| offset | int | 0 | 0 이상 | 시작 위치 |
| limit | int | 20 | 1 이상 100 이하 | 페이지 크기 |

### Request Body

없음

### Response — 200

```json
{
  "items": [
    {
      "studyId": 12,
      "title": "java study",
      "category": "BACKEND"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| items | array | N | 북마크된 스터디 목록. 담은 순서(오래된 것 먼저) | |
| items[].studyId | long | N | 스터디 ID — 사이트가 하트 상태를 맞추는 키 | STUDY_BOOKMARK.STUDY_ID |
| items[].title | string | N | 스터디 제목 | STUDY.TITLE |
| items[].category | string | N | 스터디 카테고리 (`BACKEND` \| `FRONTEND` \| `AI` 등) | STUDY.CATEGORY |
| total | long | N | 전체 북마크 수 | 계산: STUDY_BOOKMARK count by ACCOUNT_ID |
| offset | int | N | 요청한 offset 그대로 | |
| limit | int | N | 요청한 limit 그대로 | |


### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 400 | `INVALID_INPUT` | `offset < 0` 또는 `limit ≤ 0` 또는 `limit > 100` |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/features/bookmarks/queries.ts` — `useBookmarks` (하트 버튼 · 찜한 스터디 화면). `limit=100` 으로 한 번 받는다

---

## POST /api/me/bookmarks/{studyId}

### 기본 정보

- **Method**: POST
- **Path**: `/api/me/bookmarks/{studyId}`
- **인증**: 필요
- **설명**: 스터디를 북마크에 추가한다. 이미 담겨 있어도 성공한다(멱등) — 두 기기에서 동시에 눌러도 `UNIQUE(ACCOUNT_ID, STUDY_ID)` 로 한 줄만 남는다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 북마크할 스터디 ID |

### Request Body

없음

### Response — 204

바디 없음. 새로 담았을 때와 이미 담겨 있을 때 같다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 403 | `ONBOARDING_REQUIRED` | 온보딩 미완료 |
| 404 | `NOT_FOUND` | 없는 스터디 또는 공개 전(`DRAFT`) 스터디 |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

---

## DELETE /api/me/bookmarks/{studyId}

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/me/bookmarks/{studyId}`
- **인증**: 필요
- **설명**: 본인의 스터디 북마크를 해제한다. 담겨 있지 않아도 성공한다(멱등)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 해제할 스터디 ID |

### Request Body

없음

### Response — 204

바디 없음

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 403 | `ONBOARDING_REQUIRED` | 온보딩 미완료 |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

---

## 퍼널·계측

- 단계: 활성화 앞 (탐색 → 신청 사이의 관심 표시)
- 이벤트 (front): `Study Bookmarked` · `Study Unbookmarked` (`study_id`, `source`) — 하트 버튼 · 마이페이지 관심 스터디
- 온보딩을 마친 회원은 이 API 에 저장하고, 그 밖에는 브라우저 저장소(`sc_bookmarks`, 로그아웃 때 지운다)에 둔다. 이벤트는 저장 위치와 상관없이 클릭에서 난다
- 이 문서로 바뀌는 이벤트는 없다. A/B 없음

## 변경이력

| 날짜 | 변경 | 근거 |
|------|------|------|
| 2026-09-08 | 최초 작성 — GET 목록 조회 목업 구현, POST/DELETE 스펙 초안 | `enum_clas_modify` 브랜치 |
| 2026-11-18 | POST/DELETE 구현 — 둘 다 멱등 `204`(409 · 해제 404 제거), GET 에 `studyId` 추가, 사이트 하트를 서버 저장으로 | bug-50 |
