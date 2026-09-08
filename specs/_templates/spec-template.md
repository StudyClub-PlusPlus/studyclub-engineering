# {도메인} API Spec

> ERD: [링크](../../docs/erd/README.md)
> 생성일: {날짜}
> 상태: 스펙작성중

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/{resources} | {설명} | X | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## {엔드포인트 이름}

### 기본 정보

- **Method**: GET
- **Path**: `/api/{resources}/{id}`
- **인증**: 불필요 / 필요
- **설명**: 한 줄 설명

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| id | Long | {리소스} ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

```json
{
  "id": 1
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | | {TABLE}.ID |

> **소스**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}`

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | {id} 에 해당하는 리소스 없음 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/...`

### 미확정

- [NEEDS CLARIFICATION] {불확실한 부분을 추측하지 말고 여기에 적는다}
