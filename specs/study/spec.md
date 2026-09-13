# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md)
> 생성일: 2026-09-08
> 상태: 스펙확정

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 (fixture) |
| GET | /api/studies/{studyId} | 스터디 상세 조회 | X | 스펙확정 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 스터디 상세 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 불필요 (공개)
- **설명**: 스터디 ID 로 스터디 정체성 + 최신 코호트 정보를 조회한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

```json
{
  "id": 1,
  "slug": "algorithm-study",
  "title": "알고리즘 스터디",
  "description": "매주 알고리즘 문제를 풀고 코드 리뷰하는 스터디",
  "category": "BACKEND",
  "studyKind": "STUDY",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "cohort": {
    "id": 1,
    "deliveryFormat": "ONLINE",
    "status": "OPEN",
    "curriculum": "[{\"week\":1,\"topic\":\"배열\"}]",
    "capacity": 20,
    "recruitDeadline": "2026-10-01T00:00:00Z",
    "startDate": "2026-10-15T00:00:00Z",
    "endDate": "2026-12-15T00:00:00Z"
  }
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 스터디 ID | STUDY.ID |
| slug | String | N | URL 식별자 | STUDY.SLUG |
| title | String | N | 스터디 제목 | STUDY.TITLE |
| description | String | Y | 상세 소개 | STUDY.DESCRIPTION |
| category | String | N | 분야 (enum) | STUDY.CATEGORY |
| studyKind | String | N | STUDY / CLUB | STUDY.STUDY_KIND |
| thumbnailUrl | String | Y | 썸네일 | STUDY.THUMBNAIL_URL |
| cohort | Object | Y | 최신 코호트. 코호트가 없으면 null | — |
| cohort.id | Long | N | 코호트 ID | STUDY_COHORT.ID |
| cohort.deliveryFormat | String | N | 진행 방식 (enum) | STUDY_COHORT.STUDY_DELIVERY_FORMAT |
| cohort.status | String | N | 코호트 상태 (enum) | STUDY_COHORT.STATUS |
| cohort.curriculum | String | Y | 커리큘럼 JSON | STUDY_COHORT.CURRICULUM |
| cohort.capacity | Integer | Y | 정원 | STUDY_COHORT.CAPACITY |
| cohort.recruitDeadline | String | N | 모집 마감 (ISO 8601 UTC) | STUDY_COHORT.RECRUIT_DEADLINE |
| cohort.startDate | String | Y | 시작일 (ISO 8601 UTC) | STUDY_COHORT.START_DATE |
| cohort.endDate | String | Y | 종료일 (ISO 8601 UTC) | STUDY_COHORT.END_DATE |

> **소스**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}`

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |
| 404 | NOT_FOUND | 스터디가 숨김 상태 (isHidden=true) |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/studies/[id]/page.tsx` — 상세 페이지
- `frontend/apps/core-front/src/lib/content.ts` — `getStudy(id)` mock 함수

### 미확정

- [NEEDS CLARIFICATION] cohort 선택 전략: 현재는 studyId 기준 최신(ID 역순) 1개. CLUB 에서 여러 OPEN 코호트가 있을 때 어떤 걸 보여줄지
- [NEEDS CLARIFICATION] isHidden=true 스터디를 404 로 처리할지, 응답에 포함하되 FE 에서 걸러낼지
