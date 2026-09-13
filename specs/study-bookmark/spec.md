# 스터디 북마크 API Spec

> ERD: [STUDY_BOOKMARK](../../docs/erd/STUDY_BOOKMARK.md)
> 생성일: 2026-09-08
> 상태: 구현중

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | `/api/me/bookmarks` | 북마크된 스터디 목록 (페이지네이션) | O | 구현중 |
| POST | `/api/me/bookmarks/{studyCohortId}` | 북마크 추가 | O | 스펙작성중 |
| DELETE | `/api/me/bookmarks/{studyCohortId}` | 북마크 해제 | O | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 공통 사항

- **accountId**: 요청 파라미터가 아닌 JWT 토큰의 Security Context(`authentication.getDetails()`)에서 추출한다.
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
| items | array | N | 북마크된 스터디 목록 | |
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

- `frontend/apps/core-front/src/lib/me.ts` — `TODO(api): GET /api/me/bookmarks`

---

## POST /api/me/bookmarks/{studyCohortId}

### 기본 정보

- **Method**: POST
- **Path**: `/api/me/bookmarks/{studyCohortId}`
- **인증**: 필요
- **설명**: 스터디 기수를 북마크에 추가한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyCohortId | Long | 북마크할 스터디 기수 ID |

### Request Body

없음

### Response — 201

바디 없음

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 404 | `NOT_FOUND` | 존재하지 않는 기수 ID |
| 409 | `CONFLICT` | 이미 북마크된 기수 |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

---

## DELETE /api/me/bookmarks/{studyCohortId}

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/me/bookmarks/{studyCohortId}`
- **인증**: 필요
- **설명**: 스터디 기수 북마크를 해제한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyCohortId | Long | 해제할 스터디 기수 ID |

### Request Body

없음

### Response — 204

바디 없음

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 404 | `NOT_FOUND` | 북마크가 존재하지 않음 |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

---

## 변경이력

| 날짜 | 변경 | 근거 |
|------|------|------|
| 2026-09-08 | 최초 작성 — GET 목록 조회 목업 구현, POST/DELETE 스펙 초안 | `enum_clas_modify` 브랜치 |
