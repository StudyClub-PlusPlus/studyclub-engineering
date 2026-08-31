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

**성공 응답에는 래퍼가 없다.** payload 를 그대로 돌려준다 — 성공/실패는 HTTP 상태가 말하므로
바디에 `success` 플래그를 두지 않는다 (상태 코드와 중복이고, 어긋나면 어느 쪽이 진실인지 알 수 없다).

```jsonc
// 200
[{ "id": 1, "title": "알고리즘 스터디", "status": "RECRUITING" }]
```

에러는 **어디서 나든 이 모양 하나**:

```jsonc
// 404
{ "errorCode": "NOT_FOUND", "errorMessage": "스터디를 찾을 수 없습니다." }
```

- 프론트는 `errorMessage` 가 아니라 **`errorCode` 로 분기**한다 (메시지는 표시용)
- 코드 목록과 던지는 법: [`../exception-handling-guide.md`](../exception-handling-guide.md)

## 인증

- 인증이 필요한 엔드포인트: `Authorization: Bearer <JWT>` 헤더
- 공개 엔드포인트는 `SecurityConfig` 에서 `permitAll()` 로 명시

인증이 필요한 요청이 토큰 없이 오면 **401 + `errorCode: "UNAUTHORIZED"`** 가 나간다
(시큐리티 필터가 막는 경우에도 같은 모양).

현재 공개 엔드포인트 (`SecurityConfig` 의 `permitAll` 목록이 정본):
- `GET /`, `GET /api/health`, `GET /actuator/**` — 헬스·상태
- `GET /api/studies` — 스터디 목록
- `POST /auth/social-login`, `POST /auth/refresh` — 로그인·토큰 갱신

화이트리스트 밖은 전부 인증이 필요하다. **없는 경로도 404 가 아니라 401 이 나간다** —
어떤 엔드포인트가 있는지 밖에서 훑을 수 없게 하기 위해서다.

## 현재 엔드포인트 목록

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/health` | 헬스 체크 | X |
| GET | `/api/studies` | 스터디 목록 (현재 하드코딩 픽스처) | X |
| POST | `/auth/social-login` | 구글 OAuth 로그인 (미가입 시 자동가입) | X |
| POST | `/auth/refresh` | access token 재발급 | X |
| GET | `/auth/me` | 내 정보 조회 | O |
| GET | `/users` | 유저 목록 (백오피스) | O |
