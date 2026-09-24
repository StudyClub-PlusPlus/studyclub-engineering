# Endpoint Convention

## Table of Contents

- [Base URL](#base-url)
- [URL 구조](#url-구조)
- [관객으로 경로를 가른다 — /api/admin](#관객으로-경로를-가른다--apiadmin)
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

## 관객으로 경로를 가른다 — `/api/admin`

**누가 쓰는 API 인지로 경로를 먼저 가른다.** 같은 리소스라도 크루가 보는 것과 운영자가 고치는 것은 다른 화면, 다른 권한, 다른 수명을 갖는다.

| 접두 | 관객 | 인증 | 예 |
|---|---|---|---|
| `/api/...` | 크루(사용자)·비로그인 | 공개이거나 본인 것 | `GET /api/studies` · `GET /api/me/studies` |
| `/api/admin/...` | 운영자·캡틴 (백오피스 화면) | **항상 인증**. 권한은 `StudyCaptainGuard` 등이 본다 | `PUT /api/admin/studies/{id}/application-form` |

규칙:

1. **백오피스 화면이 부르는 API 는 `/api/admin` 아래 둔다.** 리소스 경로는 그대로 이어 쓴다 — `/api/admin/studies/{studyId}/applications`
2. **컨트롤러도 관객으로 나눈다.** 한 컨트롤러에 공개 GET 과 운영 PUT 을 같이 두지 않는다. 태그·문서·권한이 섞여 읽는 사람이 무엇이 공개인지 모른다
3. **`/api/admin` 은 기본이 인증**이다 (`SecurityConfig` 가 `anyRequest().authenticated()`). 공개로 열 일이 생기면 그건 `/api` 쪽에 따로 만든다 — admin 경로에 `permitAll` 을 뚫지 않는다
4. **파일 이름도 관객을 따른다** — `Admin<Resource>Controller`. `BackOffice*` 처럼 화면 이름을 쓰지 않는다
5. 접두가 없는 옛 경로(`/auth`, `/accounts`, `/back-office`)는 **새로 만들지 않는다.** 손대는 김에 `/api/...` 로 옮긴다

### 관객이 둘이면 엔드포인트도 둘이다

**같은 일을 두 관객이 한다면 경로를 재사용하지 말고 각각 만든다.** 권한 판정이 다르기 때문이다.

| 경로 | 누가 | 판정 |
|---|---|---|
| `PUT /api/studies/{id}/application-form` | 그 스터디 네비게이터 **또는** 캡틴 | `assertCaptainOrNavigator` — 스터디 범위 |
| `PUT /api/admin/studies/{id}/application-form` | 캡틴만 | `assertCaptain` — 사이트 범위 |

핸들러 본문은 공유하되(같은 private 메서드) **게이트는 각자 건다.** 한 경로에
`if (백오피스에서 왔나)` 를 두면 그 분기가 곧 권한 우회 지점이 된다.

**자주 나는 사고** — 백오피스에만 만들어 두면, 그 기능을 쓸 수 있어야 할 네비게이터가 막힌다.
"백오피스는 캡틴만"(POL-0001)과 "이 일은 네비게이터도 한다"가 동시에 참이면 **경로가 둘 필요하다.**

**왜** — 권한은 잊어버리기 쉽다. 경로로 갈라 두면 "admin 아래면 인증"이라는 한 문장이 방어선이 되고, 애너테이션을 깜빡해도 새지 않는다. 반대로 공개 API 가 운영용 컨트롤러에 섞여 있으면, 나중에 그 컨트롤러 전체에 권한을 거는 순간 사용자 화면이 조용히 깨진다.

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
// 200 — 단건 또는 목록 (페이지네이션 불필요)
[{ "id": 1, "title": "알고리즘 스터디", "status": "RECRUITING" }]
```

**페이지네이션이 필요한 목록**은 예외적으로 envelope 을 허용한다.
`items` + 페이지 메타데이터를 함께 돌려줘야 하기 때문이다.
래퍼 필드명은 `items` 고정, 메타는 `total` · `offset` · `limit` 을 포함해야 한다.

```jsonc
// 200 — 페이지네이션 목록
{
  "items": [{ "title": "java study", "status": "OPEN" }],
  "total": 42,
  "offset": 0,
  "limit": 20
}
```

> ⚠️ **Spring `Page<T>` / `Slice<T>` 를 컨트롤러에서 그대로 반환하지 않는다.**
> Spring 페이지네이션 객체는 `content` · `totalElements` · `pageable` · `sort` 등
> 프레임워크 고유 필드를 내보낸다. 프론트와의 계약은 위 `items/total/offset/limit`
> 네 필드뿐이다. 응답 DTO `record` 를 직접 만들어 반환한다.

```java
// ❌ Spring Page 를 그대로 반환 — content/totalElements/pageable/sort 등 프레임워크 필드가 노출된다
@GetMapping
public Page<StudySummary> list(Pageable pageable) { ... }

// ✅ 프로젝트 응답 계약에 맞는 커스텀 DTO
public record StudyListResponse(List<StudySummary> items, long total, int offset, int limit) {}

@GetMapping
public StudyListResponse list(@RequestParam(defaultValue = "0") int offset,
                              @RequestParam(defaultValue = "20") int limit) { ... }
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
- `GET /v3/api-docs`, `GET /scalar`, `GET /webjars/**` — API 문서와 그 JS 번들

화이트리스트 밖은 전부 인증이 필요하다. **없는 경로도 404 가 아니라 401 이 나간다** —
어떤 엔드포인트가 있는지 밖에서 훑을 수 없게 하기 위해서다.

## 현재 엔드포인트 목록

**정본은 실행 중인 서버의 API 문서다** — 아래 표는 손으로 관리하므로 반드시 뒤처진다.

| | |
|---|---|
| Scalar UI | `http://localhost:8080/scalar` |
| OpenAPI 스펙(JSON) | `http://localhost:8080/v3/api-docs` |

스펙은 springdoc 이 컨트롤러에서 생성한다. 인증이 필요한 엔드포인트에는 메서드에
`@SecurityRequirement(name = "bearerAuth")` 를 달아야 문서에 자물쇠가 붙는다 (안 달면 공개로 보인다).
문서를 감춰야 하면 `API_DOCS_ENABLED=false` 로 스펙·UI 가 함께 꺼진다.

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| GET | `/api/health` | 헬스 체크 | X |
| GET | `/api/studies` | 스터디 목록 (현재 하드코딩 픽스처) | X |
| GET | `/api/me/studies` | 내 참여·신청·일정·북마크 목록 (목업) | O |
| GET | `/api/me/study-cohorts/{cohortId}` | 내 수강 기수·출석 상세 (목업) | O |
| POST | `/auth/social-login` | 구글 OAuth 로그인 (미가입 시 자동가입) | X |
| POST | `/auth/refresh` | access token 재발급 | X |
| GET | `/auth/me` | 내 정보 조회 | O |
| GET | `/api/nicknames/availability?value={nickname}` | 실제 DB의 닉네임 사용 가능 여부 (`{available}`), 온보딩 미완료도 허용 | O |
| POST | `/accounts/onboarding` | 만 14세 이상 확인 후 가입 완료, 요청·오류 상세는 [온보딩 spec](../../../specs/user-onboarding/spec.md) 참조 | O |
| GET | `/users` | 유저 목록 (백오피스) | O |
