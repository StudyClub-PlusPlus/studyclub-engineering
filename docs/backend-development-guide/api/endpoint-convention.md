# Endpoint Convention

## Table of Contents

- [Base URL](#base-url)
- [URL 구조](#url-구조)
- [HTTP Method 사용](#http-method-사용)
- [응답 포맷](#응답-포맷)
- [인증](#인증)
- [현재 엔드포인트 목록](#현재-엔드포인트-목록)

## Base URL

| 환경 | URL |
|------|-----|
| 로컬 | `http://localhost:8080` |
| 스테이지 | `https://api.stage.studyclub-plusplus.com` |
| 프로덕션 | `https://api.studyclub-plusplus.com` |

## URL 구조

```
/{resource}              # 컬렉션
/{resource}/{id}         # 단일 리소스
/{resource}/{id}/{sub}   # 하위 리소스
```

- 복수형 명사 사용: `/studies`, `/users`, `/events`
- kebab-case: `/study-groups` (camelCase 금지)
- 동사 금지: `/getStudies` (X) → `GET /studies` (O)

## HTTP Method 사용

| Method | 용도 | 예시 |
|--------|------|------|
| GET | 조회 | `GET /studies` |
| POST | 생성 | `POST /studies` |
| PUT | 전체 수정 | `PUT /studies/{id}` |
| PATCH | 부분 수정 | `PATCH /studies/{id}` |
| DELETE | 삭제 | `DELETE /studies/{id}` |

## 응답 포맷

`ApiResponse<T>` 래퍼를 사용:

```json
{
  "success": true,
  "data": { ... },
  "message": null
}
```

에러 시:

```json
{
  "success": false,
  "data": null,
  "message": "Study not found"
}
```

## 인증

- 인증이 필요한 엔드포인트: `Authorization: Bearer <JWT>` 헤더
- 공개 엔드포인트는 `SecurityConfig` 에서 `permitAll()` 로 명시

현재 공개 엔드포인트:
- `POST /auth/google` — 구글 로그인
- `GET /health` — 헬스 체크

## 현재 엔드포인트 목록

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/health` | 헬스 체크 | X |
| POST | `/auth/google` | 구글 OAuth 로그인 | X |
| GET | `/users/me` | 내 정보 조회 | O |
| GET | `/studies` | 스터디 목록 | O |
