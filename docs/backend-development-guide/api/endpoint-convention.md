# Endpoint Convention

## Table of Contents

- [Base URL](#base-url)
- [URL 구조](#url-구조)
- [관객으로 경로를 가른다 — /api/admin](#관객으로-경로를-가른다--apiadmin)
- [HTTP Method 사용](#http-method-사용)
- [응답 포맷](#응답-포맷)
- [판정은 서버가 내려준다](#판정은-서버가-내려준다)
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

## 판정은 서버가 내려준다

**화면이 "그래서 지금 어떤 상태인가" 를 보여줘야 하면, 그 답을 응답 필드로 준다.**
프론트는 날짜·숫자를 받아 같은 판정을 다시 하지 않는다.

**판정** = 여러 값과 정책을 조합해서 나오는 결론. 재료(날짜·인원·정원)는 보여주기용이고, 결론은 서버 한 곳에서 낸다.

| 판정 | 응답 필드 | 재료 — 프론트가 이걸로 다시 계산하면 안 된다 |
|---|---|---|
| 모집 중인가 | `recruitStatus` | 마감 시각 · 정원 · 정원 인원 |
| 출석률 | `attendanceRate` | 회차 · 출석 칸 |
| 지금 진행 중인 회차 | 회차의 상태 필드 | 예정 시각 · 시작·종료 시각 |
| 이 사람이 이걸 할 수 있나 | `canApply` 처럼 `can*` | 역할 · 상태 · 기간 |

### 규칙

1. **판정은 엔티티 메서드 하나에 둔다** ([ddd-guide — 파생값](../ddd-guide.md)). 같은 판정을 쓰는 엔드포인트 —
   사이트용 · `/api/admin` · 목록 · 상세 — 가 **모두 그 메서드를 부르고, 재료도 같은 쿼리로 센다.**
   메서드는 같은데 넘기는 인원 수가 다르면 판정이 갈린다
2. **응답에 판정 필드를 넣는다.** 재료(`18/20` 의 18, 마감 시각)도 같이 줄 수 있지만 표시용이다
3. **시각이 걸린 판정은 서버 시각으로 한다** (`Instant.now()`). 브라우저 시계·시간대에 맡기지 않는다
4. **스펙 응답 표에 적는다** — 소스 칸에 `계산: {메서드}`. 같은 판정이 다른 스펙에도 있으면 그 스펙을 링크한다
5. **화면에 판정이 필요한데 응답에 없으면 프론트에서 만들지 않는다.** 스펙에 필드를 추가하고 백엔드에 요청한다.
   그동안은 `// TODO(api): recruitStatus 필요` 를 남긴다

### 프론트가 해도 되는 것

- 표시 형식 — 날짜 포맷, 보는 사람 시간대로 바꿔 보여주기, 숫자 포맷
- 받은 판정·값으로 정렬·필터·그룹
- 입력 중 검증 — 사용자에게 빨리 알려주는 용도. 최종 판정은 서버
- 낙관적 업데이트 — 다음 조회에서 서버 값으로 덮인다

### 왜

2026-10 에 「정원이 찼나」 하나를 세 곳이 세 가지로 세고 있었다.

| 어디 | 세는 것 |
|---|---|
| 신청 API `checkCapacity` — **정본** ([POL-0004](../../../01-planning/_registry/policies/POL-0004-application.md)) | 기수 명부의 `ACTIVE` 인원 |
| 공개 목록·상세 `recruitStatus` | 최신 모집 회차의 신청서 수 (정책이 바뀌기 전 기준) |
| 백오피스 목록 초안 (#204) | 명부 `ACTIVE`+`PAUSED`. 그리고 프론트가 마감을 UTC **날짜**로 다시 비교 |

같은 스터디가 사이트에서는 모집중, 백오피스에서는 마감이고, 신청은 거절될 수 있었다.
마감 비교는 날짜 단위라 KST 12:00 마감이 다음 날 09:00 까지 약 21시간 열려 보였다.
판정이 서버 한 곳에 있으면 정책이 바뀔 때 고칠 곳도 한 곳이다.

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
| GET | `/api/me/studies` | 내 스터디 — 명부 스터디 + 회차별 내 출석 ([스펙](../../../specs/my-studies/spec.md)) | O |
| GET | `/api/me/study-cohorts/{cohortId}` | 내 수강 기수·출석 상세 (목업) | O |
| PATCH | `/api/me` | 프로필 수정 — 닉네임·시간대를 한 번에 저장, 온보딩 완료 필요 | O |
| GET | `/api/me/marketing-consent` | 마케팅 수신 동의 조회 (`{agreed, agreedAt}`), 온보딩 완료 필요 | O |
| PUT | `/api/me/marketing-consent` | 마케팅 수신 동의 변경, 온보딩 완료 필요 | O |
| GET · POST | `/api/studies/{studyId}/meetings` | 분반 회차 목록 · 추가 ([스펙](../../../specs/study-meeting/spec.md)) | O |
| PUT · DELETE | `/api/studies/{studyId}/meetings/{meetingId}` | 회차 수정 · 삭제 | O |
| POST | `/auth/social-login` | 구글 OAuth 로그인 (미가입 시 자동가입) | X |
| POST | `/auth/refresh` | access token 재발급 | X |
| GET | `/auth/me` | 내 정보 조회 | O |
| GET | `/api/nicknames/availability?value={nickname}` | 실제 DB의 닉네임 사용 가능 여부 (`{available}`), 온보딩 미완료도 허용 | O |
| POST | `/accounts/onboarding` | 만 14세 이상 확인 후 가입 완료, 요청·오류 상세는 [온보딩 spec](../../../specs/user-onboarding/spec.md) 참조 | O |
| GET | `/users` | 유저 목록 (백오피스) | O |
