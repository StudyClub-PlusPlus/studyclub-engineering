# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_RECRUITMENT](../../docs/erd/STUDY_RECRUITMENT.md)
> Story PRD: [등록](../../planning/stories/captain-create-study/PRD.md) · [수정·삭제](../../planning/stories/captain-edit-delete-study/PRD.md) · [공개](../../planning/stories/captain-publish-study/PRD.md) · [다음 기수](../../planning/stories/captain-reregister-cohort/PRD.md) · [운영 콘솔 목록](../../planning/stories/captain-list-all-studies/PRD.md)
> 생성일: 2026-09-08 (GET) · 2026-09-11 (POST 절 추가)
> 갱신: 2026-09-19 — 신청 폼·제출·결과 API 는 [study-application/spec.md](../study-application/spec.md) 로 분리
> 갱신: 2026-09-20 — STUDY_COHORT 테이블 폐기. 코호트 필드는 STUDY 로 통합, 모집 마감은 STUDY_RECRUITMENT 로 분리. 응답·요청 구조 반영
> 갱신: 2026-09-22 — 스키마 정리 제안 반영(**백엔드 미반영, 제안 단계**): `STUDY_KIND` 를 STUDY_PROGRAM 으로 이동, `SLUG`·`IS_HIDDEN`·`PUBLISH_AT`·`STUDY.CAPACITY`·`STUDY_DELIVERY_FORMAT` 삭제, 공개 = `STUDY_RECRUITMENT.START_AT` 유무, 상태 5단계, 상시 모집 폐지
> 갱신: 2026-09-22 — PATCH/DELETE 스펙 추가 (#117 을 이 스펙의 스키마 제안에 맞춰 반영: `isHidden` 삭제, `studyKind` 는 STUDY_PROGRAM 소속이라 수정 불가, `recruitDeadline` null 불가, `capacity`·`startAt`·`discordChannelUrl`·`driveUrl` 수정 항목 추가)
> 갱신: 2026-09-23 — `timezone` 필드 추가(**제안 단계, 백엔드 미반영**): 등록 폼에서 운영자가 KST/PST/동시 진행 중 직접 고르는 선택 입력. GET/POST/PATCH 세 곳에 반영. 운영 콘솔 목록에 컬럼 추가. 이 필드가 생기기 전 데이터는 값이 없어 사이트가 일정·킥오프 문구로 추정하거나 「시간대 미정」으로 보인다 — [crew-browse-studies PRD](../../planning/stories/crew-browse-studies/PRD.md#3-시간대-필터)
> 갱신: 2026-09-24 — **공개 판정 정정**(PR #129 리뷰): 「공개 = `START_AT` 유무」를 「공개 = `STATUS != DRAFT`」로 바꾼다. `START_AT` 은 `STATUS` 와 별개 필드라 한쪽만 바뀌는 동기화 버그 여지가 있고, 지금 등록 API가 `START_AT=now` 를 채우는 별도 버그와도 얽혀 있었다 — `STATUS` 하나로 판정하면 두 문제 다 공개 여부에는 영향을 주지 않는다. 상세: [ERD](../../docs/erd/STUDY.md#공개-여부) · [POL-0002](../../01-planning/_registry/policies/POL-0002-study-status.md#공개-여부)
> 갱신: 2026-09-27 — 백오피스 정보 탭 연동. GET 응답에 `programId`·`oneLineSummary`·`schedule`·`discordChannelUrl`·`driveUrl` 추가, PATCH 가 `capacity`·`startAt`·`discordChannelUrl`·`driveUrl` 을 받는다(`null` = 비움, 키 생략 = 유지). **정원 저장 위치는 아직 `STUDY.CAPACITY`** 다 — 아래 「스터디 수정」 참고. `timezone` 은 컬럼이 없어 여전히 미구현
> 갱신: 2026-09-28 — category 유효값 표를 11종(`StudyCategory` enum)으로 정정
> 갱신: 2026-09-29 — 팀 결정: 스터디 상세도 백오피스용 `GET /api/admin/studies/{studyId}` 를 따로 둔다. 운영 콘솔은 이 경로를, 사용자 사이트 상세는 캡틴·네비게이터에게만 DRAFT 를 보여 준다
> 갱신: 2026-09-29 — **관객별 엔드포인트로 나눈다**: 백오피스가 부르는 것은 `/api/admin/studies`(`AdminStudyController`, 캡틴만), 사용자 사이트는 `/api/studies`. 두 관객이 다 하는 일(목록·상세·수정)만 경로가 둘이고 로직은 `StudyService` 를 공유한다. 등록·삭제·공개는 `/api/admin` 으로 옮긴다. 근거·순서: 아래 「관객별 엔드포인트」
> 갱신: 2026-09-29 — **작성자(`CREATED_BY`) 추가 (제안 단계, 백엔드 미반영)**: 스터디를 등록한 계정을 서버가 기록한다. 운영 콘솔 목록에 「작성자」 열을 넣고 「출석률」 열을 뺐다 — [captain-list-all-studies PRD](../../planning/stories/captain-list-all-studies/PRD.md)
> 갱신: 2026-09-30 — 스터디 상세 FE 구현 완료(`StudyDetailView` + `useStudyDetail` 훅이 `GET /api/studies/{studyId}` 를 직접 호출). `sort` 파라미터 없음 확정 — 목록은 항상 최신순 고정.
> 갱신: 2026-10-05 — 스키마 정리 반영(V26~V30): 정원은 최신 모집 회차(`RECRUITMENT_CAPACITY`), `SLUG`·`IS_HIDDEN`·`STUDY_DELIVERY_FORMAT` 삭제, `CREATED_BY` 추가. 목록 단계 필터도 최신 회차 신청 수 기준

## 엔드포인트 목록

**사용자 사이트 — `/api/studies` (`StudyController`)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 (DRAFT 제외) | X | 구현완료 |
| GET | /api/studies/{studyId} | 스터디 상세 조회 — DRAFT 는 캡틴·그 스터디 네비게이터에게만, 그 밖엔 404 | 선택 | 구현완료 |
| PATCH | /api/studies/{studyId} | 스터디 수정 (네비게이터가 맡은 스터디를) | O (캡틴·네비게이터) | 구현완료 (`timezone` 제외). 부르는 사이트 화면은 아직 없다 |

**백오피스 — `/api/admin/studies` (`AdminStudyController`, 캡틴만)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/studies | 스터디 목록 (DRAFT 포함, `category`·`studyKind`·`status`·`studyId`·`offset`·`limit`) | O (ADMIN) | 구현완료 — 콘솔 목록은 아직 `/api/studies` 를 부른다 (교체 여부 팀 확인 중) |
| GET | /api/admin/studies/{studyId} | 스터디 상세 (DRAFT 포함) | O (ADMIN) | 구현완료 — 콘솔 상세가 부른다 |
| POST | /api/admin/studies | 스터디 등록 (새 프로그램 · 클럽의 새 기수) | O (ADMIN) | 구현완료 — 옛 `POST /api/studies` 는 없앴다 |
| GET | /api/admin/study-programs | 프로그램 목록 (`studyKind` 필수). 등록 모달의 「기존 클럽의 새 기수」 드롭다운이 `CLUB` 으로 부른다 — `programId`·`title`·`latestStudyId` 만 준다 | O (ADMIN) | 구현완료 |
| PATCH | /api/admin/studies/{studyId} | 스터디 수정 | O (ADMIN) | 구현완료 (`timezone` 제외) — 사이트용과 로직 공유, 콘솔 정보 탭이 부른다 |
| DELETE | /api/admin/studies/{studyId} | 스터디 삭제 | O (ADMIN) | 구현완료 — 옛 `DELETE /api/studies/{studyId}` 는 없앴다 |
| POST | /api/admin/studies/{studyId}/publish | 스터디 공개 (= 모집 시작) | O (ADMIN) | 스펙확정 |
| POST | /api/admin/studies/{studyId}/unpublish | 공개 취소 | O (ADMIN) | 스펙확정 |

신청 폼 설계 · 신청 제출 · 신청 결과 · 디스코드 연동은 [study-application/spec.md](../study-application/spec.md). 옛 경로 `PATCH /api/studies/{studyId}/cohorts/{cohortId}/application-form` 은 폐기.

> 프로그램을 따로 등록·수정하는 길은 없다 — 프로그램은 제목·종류뿐이고 기수 없는 프로그램은 의미가 없어 생성은 스터디 등록이 함께 한다 ([STUDY_PROGRAM](../../docs/erd/STUDY_PROGRAM.md)). 위 목록 하나만 둔 이유다.

> **STUDY_COHORT 폐기**: 이 스펙은 초기에 `STUDY_COHORT` 테이블을 별도로 두었으나, 실제 도메인 모델은 코호트 필드를 `STUDY` 에 통합했다. 모집 마감·정원은 `STUDY_RECRUITMENT` 가 담당한다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

> 목록·상세 응답의 `recruitStatus`(모집중/모집마감 파생 판정)와 `currentApplicants`
> 의 집계 기준은 [study-recruit-status/spec.md](../study-recruit-status/spec.md) 가 정본이다.

### 관객별 엔드포인트

> 규칙: [endpoint-convention](../../docs/backend-development-guide/api/endpoint-convention.md#관객으로-경로를-가른다--apiadmin) ·
> [share/2026-09-24](../../share/2026-09-24-admin-api-path.md) · 권한: [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)

**백오피스가 부르는 API 는 `/api/admin` 아래 둔다.** 백오피스에는 캡틴만 들어온다(POL-0001).
**같은 일을 사용자 사이트에서도 하면 그 일만 경로를 하나 더 둔다** — 권한 판정이 다르기 때문이다.

| 하는 일 | 백오피스 (캡틴) | 사용자 사이트 | 경로가 둘인 이유 / 하나인 이유 |
|---|---|---|---|
| 목록 | DRAFT 포함 | DRAFT 제외 | 보이는 범위와 조건·응답 모양이 다르다 |
| 상세 | DRAFT 포함 | DRAFT 는 캡틴·그 스터디 네비게이터에게만 | 네비게이터는 백오피스에 못 들어와 사이트에서 맡은 스터디를 읽고 고친다. 그 밖의 사람에게 DRAFT 는 404 — `StudyApplicationFormService#getForm` 과 같은 방식 |
| 수정 | 캡틴 | 캡틴 · 맡은 스터디의 네비게이터 | POL-0001 — 네비게이터도 「스터디 정보 수정」 권한이 있지만 백오피스엔 못 들어온다 |
| 등록 · 삭제 · 공개 | 캡틴 | — | 캡틴만 하는 일(POL-0001 「사이트 전체」). 쓰지 않을 사이트 경로를 만들지 않는다 |

**새 엔드포인트가 필요한 이유** ([common-guide](../../docs/common-guide.md) — 기존 API 로 안 되는 이유): 수정 경로 하나에
「캡틴만」과 「캡틴·네비게이터」 두 판정이 섞이면 호출 화면으로 분기해야 한다 — 규약이 금지하는 권한 우회 지점이다.
등록·삭제는 캡틴만 하는 일이라 백오피스 경로에만 둔다.

**사이트 상세가 권한을 보는 이유**: 사이트 상세는 원래 공개 경로지만, 네비게이터가 맡은 DRAFT 스터디를 사이트에서 읽어야
고칠 수 있다. 가르는 기준이 「어느 화면에서 불렀나」가 아니라 **「호출자가 누구인가」**(토큰의 계정)라서 규약이 금지하는
분기가 아니다. 공개 경로에도 JWT 필터가 돌아 토큰이 있으면 계정을 안다. 권한이 없으면 403 이 아니라 **404** — 공개 전
스터디가 있다는 사실도 드러내지 않는다.

#### 구현 모양 — 로직은 공유, 권한 검사는 관객마다

`StudyApplicationFormService` 와 같은 모양이다. 컨트롤러는 인증 주체를 꺼내 서비스의 **관객별 진입 메서드**를 부른다.
진입 메서드가 권한을 검사하고, 본문은 **권한을 모르는 private 메서드**로 공유한다.

```java
// StudyService (api.study) — 관객별 진입 메서드: 권한 검사 → 공유 본문

// 사이트 — DRAFT 가 아니면 누구나, DRAFT 는 캡틴·그 스터디 네비게이터만. 그 밖엔 404
@Transactional(readOnly = true)
public StudyDetailResponse getDetail(Long studyId, Long accountId) { // accountId: 비로그인이면 null
    Study study = findAny(studyId);
    if (study.getStatus() == StudyStatus.DRAFT
            && !studyCaptainGuard.isCaptainOrNavigator(accountId, studyId)) {
        throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
    }
    return toDetail(study);
}

// 백오피스 — 캡틴만. DRAFT 포함
@Transactional(readOnly = true)
public StudyDetailResponse getDetailForBackOffice(Long accountId, Long studyId) {
    studyCaptainGuard.assertCaptain(accountId, "백오피스는 캡틴(ADMIN)만 접근할 수 있습니다.");
    return toDetail(findAny(studyId));
}

// 사이트 — 캡틴 또는 맡은 스터디의 네비게이터
@Transactional
public void updateFromSite(Long accountId, Long studyId, StudyUpdateRequest request) {
    studyCaptainGuard.assertCaptainOrNavigator(accountId, studyId, "스터디 수정 권한이 없습니다.");
    applyUpdate(findAny(studyId), request);
}

// 백오피스 — 캡틴만
@Transactional
public void updateFromBackOffice(Long accountId, Long studyId, StudyUpdateRequest request) {
    studyCaptainGuard.assertCaptain(accountId, "스터디 수정 권한이 없습니다.");
    applyUpdate(findAny(studyId), request);
}

// create(accountId, request) · delete(accountId, studyId) — 캡틴 전용이라 진입 메서드 하나. 첫 줄이 assertCaptain

// 공유 본문 — 권한 검사를 하지 않는다
private void applyUpdate(Study study, StudyUpdateRequest request) {
    // 검증 · 필드 반영 · 최신 모집 회차 UPDATE (지금 update 의 본문)
}

private StudyDetailResponse toDetail(Study study) {
    return StudyDetailResponse.from(study, applicantCount(study), latestRecruitDeadlineAt(study));
}
```

`findAny` 는 없으면 404 인 조회 헬퍼다. 상태를 먼저 봐서 공개 스터디에는 권한 조회를 하지 않는다. `isCaptainOrNavigator` 는 예외 대신 참·거짓을 돌려주는 `StudyCaptainGuard` 메서드다.

- **공유 본문 안에 한쪽 관객의 규칙을 넣지 않는다.** 지금 `update` 는 안에서 `assertCaptainOrNavigator` 를 부른다 —
  백오피스 경로가 이걸 그대로 부르면 네비게이터가 `/api/admin` 을 통과한다
- 권한 검사는 전부 `StudyCaptainGuard` 로. 지금 `create`·`delete` 의 `SystemRole.ADMIN` 직접 비교는 `assertCaptain` 으로 바꾼다
- 이름 접미사(`FromSite`·`FromBackOffice`·`ForBackOffice`)는 **경로가 둘인 일에만** 붙인다. 캡틴 전용인 `create`·`delete` 는 그대로
- 요청 DTO(`StudyCreateRequest`·`StudyUpdateRequest`)와 상세 응답(`StudyDetailResponse`)은 두 경로가 같이 쓴다.
  백오피스에만 필요한 필드가 생기면 그때 백오피스 응답을 따로 둔다 (목록은 이미 `BackofficeStudyListResponse` 로 따로다)
- 컨트롤러·DTO·서비스는 모두 `api.study` 패키지 — [module-structure](../../docs/backend-development-guide/module-structure.md#package-convention)
- 권한은 `@PreAuthorize(hasRole)` 가 아니라 `StudyCaptainGuard` 로 본다 — `hasRole` 로 올리는 건 [share/2026-09-24](../../share/2026-09-24-admin-api-path.md)에서 다음 작업으로 미뤘다

#### 이전 순서

스테이지가 중간에 깨지지 않게 **새 경로를 먼저 열고 → 화면을 옮기고 → 옛 경로를 닫는다.**

1. ✅ **백엔드 — 추가**: `AdminStudyController` 에 `GET /{studyId}` · `POST` · `PATCH /{studyId}` · `DELETE /{studyId}`. 옛 경로는 그대로 둔다
2. **백오피스 프론트**: `features/studies/queries.ts` 의 상세·수정·삭제를 `/api/admin/studies/{id}` 로 바꾼다.
   ✅ 상세·수정·삭제는 옮겼다. **목록은 남았다** — `GET /api/admin/studies` 가 `status`·페이지를 지원하지만 교체 여부는 팀 확인 중이다.
   등록 모달(`StudyCreateDialog`, `TODO(api)`)은 처음부터 `POST /api/admin/studies`
3. ✅ **백엔드 — 제거**: `StudyController` 의 `POST` · `DELETE` 를 없앤다. `PATCH` 는 `updateFromSite` 로 연결.
   옛 `POST` 는 부르는 화면이 없었고 옛 `DELETE` 를 부르던 콘솔은 2단계에서 같이 옮겨서, 과도기 없이 한 번에 뺐다
4. ✅ **백엔드 — 사이트 상세 권한별 공개 범위**: DRAFT 는 캡틴·그 스터디 네비게이터에게만. 숨김 플래그(`IS_HIDDEN`)는 V27 에서 삭제했다.
   (한때 상세를 사이트 경로 하나로 합쳤다가, 팀 결정으로 백오피스 상세를 다시 뒀다 — 2026-09-29)

#### 테스트

[testing-guide](../../docs/backend-development-guide/testing-guide.md) 대로 **엔드포인트마다** 통합 테스트 = 성공 1건 + 실패 코어.

| 엔드포인트 | 성공 | 401 | 400 | 403 | 404 |
|---|---|---|---|---|---|
| `GET /api/admin/studies/{id}` | DRAFT 도 200 | 토큰 없음 | — | 크루 · **네비게이터** | 없는 id |
| `POST /api/admin/studies` | 201 + `Location` | 토큰 없음 | 필수 누락 | 크루 · 네비게이터 | — |
| `PATCH /api/admin/studies/{id}` | 204 | 토큰 없음 | 검증 실패 | 크루 · **네비게이터** | 없는 id |
| `DELETE /api/admin/studies/{id}` | 204 | 토큰 없음 | — | 크루 · 네비게이터 | 없는 id |
| `PATCH /api/studies/{id}` | 네비게이터 204 | 토큰 없음 | 검증 실패 | 크루 · 다른 스터디 네비게이터 | 없는 id |
| `GET /api/studies/{id}` | 공개 200 · DRAFT 는 캡틴·그 스터디 네비게이터 200 | — | — | — (403 대신 404) | 없는 id · DRAFT 를 크루·다른 스터디 네비게이터·비로그인이 조회 |

굵게 표시한 칸이 이번 분리의 핵심이다 — **네비게이터가 `/api/admin` 에서는 403** 이어야 한다.
사이트 상세의 권한별 공개 범위는 `StudyDetailVisibilityIntegrationTest` 가 덮는다.
진입 메서드별 역할 조합(캡틴·네비게이터·크루·비로그인)은 `StudyServiceTest` 단위 테스트로 덮는다.

---

## 스터디 목록 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies`
- **인증**: 불필요 (공개)
- **설명**: 공개된 스터디 목록을 조회한다

### 상태

구현완료 — DB 기반으로 동작 중 (카테고리·상태·키워드·마감일 필터 포함). 필드 단위 응답 스펙은 미작성.

### Query Parameters

| 이름     | 타입   | 필수 | 설명                                                                                                                              |
| -------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| keyword  | String | N    | 제목·소개 부분일치 검색 (대소문자 무관)                                                                                           |
| status   | String | N    | 모집 상태 필터. `recruiting` / `ongoing` / `closed`                                                                               |
| timezone | String | N    | 시간대 필터. `KST` / `PST` / `both`                                                                                               |
| category | String | N    | 분야 필터 (API enum 값, 예: `AI_ML`·`ALGORITHM`). 유효값은 [CATEGORY_DISPLAY](../../frontend/apps/core-front/src/lib/api.ts) 참고 |

> **정렬**: 지원하지 않는다 — 항상 최신순(등록 순번) 고정.

> **공개 기준**: 목록에는 `STATUS != DRAFT` 인 스터디만 나온다. 별도 숨김 플래그는 없다(`IS_HIDDEN` 은 V27 에서 삭제)
> (`STATUS` 가 5단계라 `= OPEN` 만으로는 `ONGOING`·`ENDED`·`CLOSED` 를 놓친다).
> **모집 시작 일자(`START_AT`) 는 공개 판정에 쓰지 않는다** — `STATUS` 와 별개 필드라 동기화가 어긋날
> 수 있어서다([ERD](../../docs/erd/STUDY.md#공개-여부) 참고). `status` 필터 값은 5단계로 늘어난다.
>
> **사이트 상태 표기**: `DRAFT` 안 보임 / `OPEN` = 모집 중 / `ONGOING` = 진행 중 / `ENDED`·`CLOSED` = 종료 ([ERD](../../docs/erd/STUDY.md#사용자-사이트-표기)).
>
> **FE 사용처 갱신(2026-09-22)**: 사용자 사이트 목록·상세 카드가 시작일(`startAt`)·시간대를 항상
> 표시한다. 필드 단위 응답 스펙을 쓸 때 `startAt` 을 반드시 포함할 것 — 상세 조회 응답과 같은 소스
> (`STUDY.START_AT`)다. 모집 마감일은 카드에 따로 텍스트로 두지 않고, 상단 상태 배지(`모집중 (D-N)`·
> `모집중 (미정)`·`진행중`·`모집 마감`)로만 표현한다 — `recruitDeadline`·`recruitStatus` 로 계산한다.
> D-N 산정은 `recruitDeadline` 하나면 된다. 목록에서는 정렬·신청하기·찜을 더 이상 제공하지 않는다
> (둘러보기 전용으로 축소, 신청은 상세에서만 한다). playground 근거:
> [crew-browse-studies PRD](../../planning/stories/crew-browse-studies/PRD.md).
>
> **운영 콘솔 목록 갱신(2026-09-22)**: 「진행 일정」(`schedule`, 자유 텍스트) 열을 빼고 **스터디 시작일**
> (`startAt`) 열을 넣었다 — 정렬·필터를 걸 수 있는 값이라야 목록에 둔다는 원칙에 맞춘다. **종류**
> (`studyKind`) 열과 드롭다운 필터도 추가했다 — 기수가 아니라 프로그램의 속성이지만 운영자가 클럽만
> 걸러 보는 일이 많다. **시간대**(`timezone`) 열도 추가했다(2026-09-23) — 등록 폼에서 운영자가
> 직접 고르는 값이라 KST/PST 문구를 추정할 필요가 없어졌다. 이 화면의 정본 Story PRD 는 사내
> 워크스페이스에 있다(PUBLIC 레포라 링크 생략 — [AGENT.md](../../AGENT.md)); 이 repo 안의 정본은
> playground 화면 명세다:
> [studies/spec.ts](../../frontend/apps/playground/src/app/(proto)/proto/console/studies/spec.ts).
>
> **운영 콘솔 목록 갱신(2026-09-29)**: **작성자** 열을 추가하고 **출석률** 열을 뺐다. 작성자는 등록한
> 캡틴의 닉네임(`ACCOUNT.NICKNAME`)이고 `STUDY.CREATED_BY` 로 찾는다 — 컬럼이 없던 시절
> 등록된 스터디는 비어 있어 「—」로 보인다. 출석률은 기수 운영 화면의 출석 탭에서만 본다 — 목록 응답에
> 넣지 않는다. 정본: [captain-list-all-studies PRD](../../planning/stories/captain-list-all-studies/PRD.md)

---

## 스터디 목록 조회 (백오피스)

- **Method / Path**: `GET /api/admin/studies` — `AdminStudyController` · 구현완료
- **인증**: `ACCOUNT.SYSTEM_ROLE=ADMIN` (`assertCaptain`)
- **Query**: `category`(StudyCategory) · `studyKind`(STUDY/CLUB) · `status`(StudyStatus) · `studyId`(Long) — 모두 선택. `offset`(기본 0) · `limit`(기본 20) 페이지네이션 지원
- **설명**: DRAFT 포함 전 상태. 등록 직후 스터디가 여기 나온다
- **Response — 200**: `{ items: [{ studyId, title, status, category, studyKind, recruitmentCapacity, recruitmentStartAt, recruitDeadlineAt, startAt, timezone, hasApplicationForm }], total, offset, limit }` (`BackofficeStudyListResponse`)
- **프론트엔드 사용처**: 아직 없음 — 콘솔 목록(`features/studies/queries.ts` `useStudies`)은 공개 `/api/studies` 를 부른다. 교체 여부는 팀 확인 중

---

## 스터디 상세 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 선택 — 없어도 공개 스터디는 보인다. 토큰(헤더 또는 쿠키)이 있으면 캡틴·그 스터디 네비게이터인지 보고 DRAFT 도 보여 준다
- **설명**: 스터디 ID 로 스터디 정보를 조회한다. 운영 콘솔은 아래 「스터디 상세 조회 (백오피스)」를 쓴다 ([사이트 상세가 권한을 보는 이유](#관객별-엔드포인트))

### Path Parameters

| 이름    | 타입 | 설명      |
| ------- | ---- | --------- |
| studyId | Long | 스터디 ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

실제 응답(`StudyDetailResponse`). 아래 필드 표의 `recruitDeadline` 은 응답에서 `recruitDeadlineAt` 이고,
`timezone` 은 아직 응답에 없다(컬럼 미구현). `deliveryFormat` 은 스키마 정리로 제거되었다 — 프론트엔드 타입과 이 스펙 응답 예시 모두 포함하지 않는다.

```json
{
  "id": 1,
  "programId": 1,
  "programTitle": "알고리즘 스터디",
  "title": "알고리즘 스터디",
  "oneLineSummary": "매주 알고리즘 문제를 풀고 코드 리뷰합니다.",
  "description": "매주 알고리즘 문제를 풀고 코드 리뷰하는 스터디",
  "category": "ALGORITHM",
  "studyKind": "STUDY",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "status": "OPEN",
  "recruitStatus": "RECRUITING",
  "curriculum": "[{\"week\":1,\"topic\":\"배열\"}]",
  "capacity": 20,
  "schedule": "매주 목 20:00 · 8주 과정",
  "recruitDeadlineAt": "2026-10-01T00:00:00Z",
  "startAt": "2026-10-15T00:00:00Z",
  "endAt": "2026-12-15T00:00:00Z",
  "discordChannelUrl": "https://discord.com/channels/123/456",
  "driveUrl": "https://drive.google.com/drive/folders/abc"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 스터디 ID | STUDY.ID |
| programId | Long | N | 스터디 프로그램 ID | STUDY.PROGRAM_ID |
| programTitle | String | N | 프로그램 제목. 콘솔 정보 탭이 읽기 전용으로 표시 | STUDY_PROGRAM.TITLE (PROGRAM_ID 로 조인) |
| title | String | N | 스터디 제목 | STUDY.TITLE |
| oneLineSummary | String | N | 한 줄 소개 | STUDY.ONE_LINE_SUMMARY |
| description | String | Y | 상세 소개 (마크다운 허용. 등록 시 「목표 / 진행 방식 / 참가 대상 / 특이사항」 기본 템플릿) | STUDY.DESCRIPTION |
| category | String | N | 분야 (enum). 유효값은 아래 표 참조 | STUDY.CATEGORY |
| studyKind | String | N | STUDY / CLUB. 프로그램의 종류 | STUDY_PROGRAM.STUDY_KIND (PROGRAM_ID 로 조인) |
| thumbnailUrl | String | Y | 썸네일 | STUDY.THUMBNAIL_URL |
| status | String | N | 라이프사이클 (enum). DRAFT / OPEN / ONGOING / ENDED / CLOSED — [전이 규칙](../../docs/erd/STUDY.md#상태--status-운영진행-라이프사이클) | STUDY.STATUS |
| recruitStatus | String | Y | 모집 상태 (enum). `status != OPEN` 이면 null | 계산: STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT 경과 또는 RECRUITMENT_CAPACITY 도달 (id 최대인 회차 기준) → [상세](../study-recruit-status/spec.md#판정-규칙) |
| curriculum | String | Y | 커리큘럼 JSON | STUDY.CURRICULUM |
| capacity | Integer | Y | 모집 정원. null = 제한 없음 | STUDY_RECRUITMENT.RECRUITMENT_CAPACITY — id 최대인 회차 1건 |
| recruitDeadline | String | N | 모집 마감 (ISO 8601 UTC). 상시 모집은 없다 | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT — id 최대인 회차 1건 |
| schedule | String | Y | 진행 일정 (자유 텍스트) | STUDY.SCHEDULE |
| timezone | String | Y | 기준 시간대 (enum). `KST` / `PST` / `BOTH`(동시 진행). 운영자가 등록 폼에서 직접 고른다 — null 이면 사이트가 `schedule`/킥오프 문구로 추정하거나 「시간대 미정」으로 표시 | STUDY.TIMEZONE |
| startAt | String | Y | 진행 시작 일시 (ISO 8601 UTC). `recruitDeadline`·`schedule` 과는 다른 값 | STUDY.START_AT |
| endAt | String | Y | 종료일 (ISO 8601 UTC) | STUDY.END_AT |
| discordChannelUrl | String | Y | 참고용 채널 링크 하나(주로 로비). 없으면 사이트 기본 초대 링크로 안내. **사이트 상세는 캡틴과 참여 중단이 아닌 참여자(네비게이터 포함)에게만 채우고 그 밖엔 null** ([share](../../share/2026-09-30-study-detail-private-urls.md)). 자동화(채널 조회·삭제 감지)의 근거로 쓰지 않는다 — [상세](../../docs/erd/STUDY.md#채널-삭제와-closed) | STUDY.DISCORD_CHANNEL_URL |
| driveUrl | String | Y | 참고용 자료 드라이브 링크. 사이트 상세의 채움 조건은 `discordChannelUrl` 과 같다 | STUDY.DRIVE_URL |

> **소스**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}`

#### category 유효값 (StudyCategory enum)

| 코드 | 라벨 |
|------|------|
| `AI_ML` | AI · ML |
| `ALGORITHM` | 알고리즘 |
| `DATA` | 데이터 |
| `SOFTWARE` | 소프트웨어 개발 |
| `CAREER` | 커리어 |
| `BOOK_CLUB` | 북클럽 |
| `LANGUAGE` | 어학 |
| `LIFESTYLE` | 라이프스타일 |
| `PRODUCT` | 기획 · PM |
| `BUSINESS` | 비즈니스 |
| `OTHER` | 기타 |

> 2026-09-21 14종 → 11종으로 합쳤다 (CS → ALGORITHM, BACKEND·FRONTEND·MOBILE → SOFTWARE, PLANNING·PM → PRODUCT, DESIGN → OTHER). 정본은 `StudyCategory` enum. **단일 값** — 다중 주제는 지원하지 않는다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |
| 404 | NOT_FOUND | 공개 전(`STATUS = DRAFT`)인데 호출자가 캡틴도 그 스터디 네비게이터도 아님 (비로그인 포함). 403 이 아니다 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/studies/[id]/page.tsx` — 상세 페이지
- `frontend/apps/core-front/src/lib/content.ts` — `getStudy(id)` mock 함수
- 운영 콘솔은 이 경로를 쓰지 않는다 — 아래 `GET /api/admin/studies/{studyId}` 를 쓴다
- 구현: `StudyService#getDetail(studyId, accountId)`. 공개 판정은 `STATUS != DRAFT` 하나 — `Study#isPubliclyVisible`(OPEN 만)과 다르다.
  숨김 플래그(`IS_HIDDEN`)는 V27 에서 삭제했다 — 목록(`StudyListJpqlDao`)도 `STATUS != DRAFT` 하나로 거른다

### 미확정

- [NEEDS CLARIFICATION] CLUB 에서 같은 STUDY_PROGRAM 아래 여러 STUDY 가 있을 때 어떤 기수를 기본으로 보여줄지 (현재는 studyId 직접 지정)
- [NEEDS CLARIFICATION] `startAt` 이 비어 있는 기존 데이터의 처리 — 등록·수정 요청에는 필드가 생겼지만(위 참고), 이 필드가 생기기 전 데이터는 여전히 비어 있을 수 있다. playground mock 은 대표 날짜·킥오프 문구·모집 마감일로 값을 추정해 채운다(FE 전용 임시 처리) — 실제 데이터 백필 여부와 방법 미정. [crew-browse-studies PRD](../../planning/stories/crew-browse-studies/PRD.md) 참고
- 공개 여부는 `STATUS != DRAFT` 로 정한다 — `DRAFT` 면 404, 아니면 조회 가능. 별도 숨김 플래그(`IS_HIDDEN`)는 없다. 모집 시작 일자(`START_AT`)는 판정에 쓰지 않는다 — [ERD](../../docs/erd/STUDY.md#공개-여부) 참고.

---

## 스터디 상세 조회 (백오피스)

- **Method / Path**: `GET /api/admin/studies/{studyId}` — `AdminStudyController` · 구현완료
- **인증**: `ACCOUNT.SYSTEM_ROLE=ADMIN` (`assertCaptain`)
- **설명**: 사이트 상세와 같은 응답이되 **DRAFT 도 보여 준다.** 서비스 `getDetailForBackOffice` → 공유 본문 `toDetail`.
  등록 응답의 `Location` 이 가리키는 곳
- **Response — 200**: `StudyDetailResponse` (사이트 상세와 같다)
- **Error Responses**

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | ADMIN 아님 (네비게이터 포함) |
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |

- **프론트엔드 사용처**: `back-office-front` `features/studies/queries.ts` 의 `useStudyDetail`

---

## 스터디 등록

> 유저스토리: 운영자(ADMIN)가 새 스터디를 등록한다.

### 인수 기준

| ID   | 기준                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1 | title·oneLineSummary·category 세 필수 항목을 채우면 등록된다                                                                                      |
| AC-2 | 등록한 스터디는 공개 API 에 노출되지 않는다 — 등록 직후는 항상 `STATUS=DRAFT`(비공개)다. 운영 콘솔 조회에는 포함된다                              |
| AC-3 | recruitDeadline 을 지정하면 그날이 지나면 `RECRUIT_CLOSED` 로 판정된다                                                                            |
| AC-4 | recruitDeadline 을 비우면 등록되지 않는다(400). 상시 모집은 없다                                                                                  |
| AC-5 | category 가 목록 카드 색·아이콘의 기준이다                                                                                                        |
| AC-6 | `studyProgramId` 없이 등록하면 새 프로그램이 첫 기수와 함께 만들어지고, 종류는 `studyKind`(기본 `STUDY`)로 정해진다. 등록 후 종류는 바뀌지 않는다 |
| AC-7 | `studyProgramId` 를 주면 그 프로그램의 새 기수로 붙는다. 프로그램이 `CLUB` 이 아니면 400                                                          |
| AC-8 | capacity 를 비우면 제한 없음, 값이 있으면 1 이상의 정수여야 한다                                                                                  |

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/studies` — `AdminStudyController`. 옛 `POST /api/studies` 는 없앴다
- **인증**: 필요 — `ACCOUNT.SYSTEM_ROLE=ADMIN` 만 (`assertCaptain`) (지금 단계에서는 **캡틴 = 운영자**. 일반 회원에게 셀프서비스로 캡틴 자격을 여는 건 이후 Story)
- **설명**: 캡틴(=ADMIN)이 새 스터디(`STUDY_PROGRAM.STUDY_KIND` 는 요청의 `studyKind`, 기본 `STUDY`, `STATUS=DRAFT`)를 등록한다. 프로그램은 따로 등록하지 않는다 — 새 프로그램이면 첫 기수와 함께 만들고, 클럽의 새 기수는 `studyProgramId` 로 붙인다. `STUDY_RECRUITMENT` 행 1개를 항상 함께 생성한다. `recruitDeadline` 은 필수다 — 상시 모집은 없다.

### Request Body

```json
{
  "title": "AI 논문 스터디",
  "oneLineSummary": "AI 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI_ML",
  "thumbnailUrl": null,
  "recruitDeadline": "2026-11-01T00:00:00Z",
  "capacity": 20,
  "schedule": "매주 목 20:00 · 8주 과정",
  "timezone": null,
  "startAt": null,
  "discordChannelUrl": null,
  "driveUrl": null
}
```

| 필드              | 타입    | 필수 | 검증                                                                                                                                                                 | 소스                                                                                      |
| ----------------- | ------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| studyProgramId    | Long    | N    | null 이면 title 로 StudyProgram 자동 생성(새 프로그램). 값이 있으면 해당 프로그램이 존재하고 `STUDY_KIND=CLUB` 이어야 함 — 스터디는 기수가 1개다                     | STUDY.PROGRAM_ID (STUDY_PROGRAM 참조)                                                     |
| studyKind         | String  | N    | `STUDY` / `CLUB`. **새 프로그램일 때만** 받는다 (기본 `STUDY`). `studyProgramId` 가 있으면 무시하지 않고 400 — 기존 프로그램의 종류는 여기서 바꾸지 않는다           | STUDY_PROGRAM.STUDY_KIND                                                                  |
| title             | String  | Y    | 1~60자 (trim 후)                                                                                                                                                     | STUDY.TITLE                                                                               |
| oneLineSummary    | String  | Y    | 비어 있으면 등록 불가                                                                                                                                                | STUDY.ONE_LINE_SUMMARY                                                                    |
| description       | String  | N    | —                                                                                                                                                                    | STUDY.DESCRIPTION                                                                         |
| category          | String  | Y    | StudyCategory enum 값 중 하나. 유효값은 GET 응답의 enum 표 참조                                                                                                      | STUDY.CATEGORY                                                                            |
| thumbnailUrl      | String  | N    | —                                                                                                                                                                    | STUDY.THUMBNAIL_URL                                                                       |
| recruitDeadline   | String  | Y    | 필수. 미래여야 함                                                                                                                                                    | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT (NOT NULL). 항상 STUDY_RECRUITMENT 행 1개 함께 생성 |
| capacity          | Integer | N    | 1 이상의 정수. 비우면(null) 제한 없음                                                                                                                                | STUDY_RECRUITMENT.RECRUITMENT_CAPACITY                                                    |
| schedule          | String  | N    | 자유 텍스트                                                                                                                                                          | STUDY.SCHEDULE                                                                            |
| timezone          | String  | N    | `KST` / `PST` / `BOTH` 중 하나, 또는 null(미정). enum 이 아닌 값은 400                                                                                               | STUDY.TIMEZONE                                                                            |
| startAt           | String  | N    | ISO 8601 UTC. 진행이 실제로 시작하는 일시 — `recruitDeadline`·`schedule` 과는 다른 값. 등록 시점엔 보통 비어 있고, 수정(PATCH, 미구현)으로 나중에 채우는 경우가 많다 | STUDY.START_AT                                                                            |
| discordChannelUrl | String  | N    | http(s) URL. 클럽 새 기수는 보통 직전 기수와 같은 값                                                                                                                 | STUDY.DISCORD_CHANNEL_URL                                                                 |
| driveUrl          | String  | N    | http(s) URL. 클럽 새 기수는 보통 직전 기수와 같은 값                                                                                                                 | STUDY.DRIVE_URL                                                                           |

**서버가 자동으로 채우는 필드 (요청에 포함하지 않음):**

| 필드                       | 고정값                     | 비고                                                                                                                                          |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| STUDY.STATUS               | `DRAFT`                    | 등록 후 ADMIN이 [공개(모집 시작)](#스터디-공개--공개-취소)로 OPEN 으로 전환                                                                   |
| STUDY_RECRUITMENT.START_AT | `null`                     | 등록 시 채우지 않는다 — 공개할 때(`STATUS: DRAFT → OPEN`) 함께 채운다. 공개 판정 자체는 `STATUS` 로 한다                                      |
| STUDY_PROGRAM.TITLE        | 요청의 `title`             | 새 프로그램일 때만. 프로그램 제목은 첫 기수 제목을 따른다                                                                                     |
| STUDY.CREATED_BY           | 요청한 계정의 `ACCOUNT.ID` | 작성자. 인증 토큰의 계정으로 채우고 요청 바디로 받지 않는다. 등록 뒤 바뀌지 않는다 — PATCH 가 건드리지 않는다. **제안 단계, 컬럼 미구현** |

### Response — 201 No Content

응답 바디 없음. `Location` 헤더에 생성된 스터디 URI를 담는다.

```
Location: /api/admin/studies/{id}
```

### Error Responses

| 상태 | errorCode     | 조건                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | INVALID_INPUT | title·oneLineSummary·category·recruitDeadline 누락, title 60자 초과, category 가 유효하지 않은 enum 값, recruitDeadline 이 과거, capacity 가 1 미만, studyKind 가 유효하지 않은 값, timezone 이 유효하지 않은 enum 값, `studyProgramId` 와 `studyKind` 를 함께 보냄, `studyProgramId` 가 없는 프로그램이거나 `CLUB` 이 아님. 실패한 필드 전부를 `필드명: 사유` 형태로 응답 |
| 401  | UNAUTHORIZED  | 로그인 필요                                                                                                                                                                                                                                                                                                                                                                |
| 403  | FORBIDDEN     | `SYSTEM_ROLE` 이 `ADMIN` 아님                                                                                                                                                                                                                                                                                                                                              |

500(저장 실패)은 별도 errorCode 없이 처리.

### 프론트엔드 사용처

`back-office-front` `components/StudyCreateDialog.tsx` — 아직 `TODO(api)`, 연결 시 `POST /api/admin/studies`. 프로토타입: `frontend/apps/playground/src/proto/console/components/StudyCreateDialog.tsx`(등록 · 다음 기수 만들기), `StudyForm.tsx`

### 미확정

- ~~권한 범위~~ → **결정**: `SYSTEM_ROLE=ADMIN` 만 개설 가능 ("캡틴 = 운영자", 지금 단계). 일반 회원에게 캡틴 자격을 부여하는 신청/승인 플로우는 범위 밖 — 필요해지면 별도 Story

- ~~DRAFT → OPEN 전환 주체~~ → **결정**: 개설자(=ADMIN)가 직접 전환한다. 별도 승인 단계 없음 — ERD 상태 다이어그램의 "운영자 공개"를 개설자 본인이 수행하는 것으로 해석
- ~~상시 모집~~ → **폐지**: `recruitDeadline` 은 필수이고 `RECRUIT_DEADLINE_AT` 은 NOT NULL 이다. 계속 이어지는 참여는 `STUDY_PROGRAM.STUDY_KIND=CLUB` 의 기수 이월로 표현한다 ([STUDY](../../docs/erd/STUDY.md)). 스키마 변경 필요: V19 가 NULL 허용으로 바꿨으므로 다시 NOT NULL (기존 NULL 행 처리 필요)
- ~~종류 전환~~ → **결정**: `STUDY_PROGRAM.STUDY_KIND` 는 한 번 정하면 변경하지 못한다. 변경 API 를 두지 않는다
- ~~`publishAt` (공개 예약)~~ → **폐지**: 예약 공개는 없다. `STUDY.PUBLISH_AT` 컬럼과 응답의 `publishAt` 을 두지 않는다. 등록 후 `STATUS=DRAFT` 로 비공개 상태이며, 캡틴이 모집을 시작하면(=공개) `OPEN` 이 된다
- **[NEEDS CLARIFICATION] 이름 중복** — 운영 규칙상 스터디 이름은 겹치지 않게 관리한다. 클럽 새 기수 제목을 프로그램 제목 그대로 채우면 기수마다 같아지므로, 기수 표기를 붙일지 `STUDY.TITLE` 유니크 제약을 둘지 정해야 한다
- **[NEEDS CLARIFICATION] 진행 일정 타입** — 지금은 `STUDY.SCHEDULE VARCHAR(255)` 자유 텍스트. 기간 정렬·필터가 필요하면 `START_AT`/`END_AT` 로 받아야 한다
- ~~다중 카테고리~~ → **결정**: 지원하지 않는다. `category` 단일 값만 받는다 — 등록 폼도 라디오 버튼(단일 선택)으로 맞췄다. 여러 분야에 걸쳐도 대표 분야 하나만 고른다
- **운영 종료(`ENDED → CLOSED`) API 미구현** — 캡틴이 채널 삭제를 확인하고 누르는 수동 전환이며(자동 검증 없음), `PROGRAM_ID` 안에서 `ID` 가 가장 큰 행에서만 허용해야 한다 — [ERD](../../docs/erd/STUDY.md#채널-삭제와-closed). 만들 때 이 제약을 서버에서도 검증할 것

---

## 스터디 공개 · 공개 취소

> 유저스토리: 운영자(ADMIN)가 등록해 둔 스터디를 공개(= 모집 시작)하거나 내린다.

### 기본 정보

| | publish | unpublish |
|---|---|---|
| Method | POST | POST |
| Path | `/api/admin/studies/{studyId}/publish` | `/api/admin/studies/{studyId}/unpublish` |
| 인증 | `ACCOUNT.SYSTEM_ROLE=ADMIN` | `ACCOUNT.SYSTEM_ROLE=ADMIN` |
| Request Body | 없음 | 없음 |
| Response | 204 No Content | 204 No Content |

캡틴 전용이라 `/api/admin` 만 둔다. 네비게이터 불가. 서버에 확인 단계 없음 (확인 팝업은 FE 절차).

### 동작

| 동작 | 선행 조건 | 결과 |
|------|-----------|------|
| publish (공개) | `STATUS=DRAFT` AND `APPLICATION_FORM.questions` ≥ 1 | `STATUS=OPEN`, 최신 회차(id MAX) `STUDY_RECRUITMENT.START_AT = now()` |
| unpublish (공개 취소) | `STATUS=OPEN` | `STATUS=DRAFT`, 최신 회차 `STUDY_RECRUITMENT.START_AT = null`. 신청·크루·반·출석 변경 없음. 알림/이력 없음. |

- 공개 = 모집 시작. 사이트 노출 여부는 `STATUS != DRAFT` 단일 판정.
- `START_AT` 은 "모집이 언제 시작됐는가"라는 사실 데이터 — 노출 판정의 근거가 아님 ([ERD](../../docs/erd/STUDY.md#공개-여부)).
- `ONGOING`·`ENDED`·`CLOSED` 에서 unpublish 는 불가 (409).
- 프로토타입은 공개·공개 취소 모두 확인 팝업을 거친다. 서버에 확인 단계는 없다.

### Error Responses

**publish**

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | ADMIN 아님 (네비게이터 포함) |
| 404 | NOT_FOUND | studyId 없음 |
| 409 | CONFLICT | 이미 `OPEN`·`ONGOING`·`ENDED`·`CLOSED` 상태 |
| 409 | APPLICATION_FORM_REQUIRED | `APPLICATION_FORM` 없거나 `questions` 0개 |

**unpublish**

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | ADMIN 아님 (네비게이터 포함) |
| 404 | NOT_FOUND | studyId 없음 |
| 409 | CONFLICT | `DRAFT` 상태에서 unpublish, 또는 `ONGOING`·`ENDED`·`CLOSED` 에서 unpublish |

### 신규 ErrorCode

```java
APPLICATION_FORM_REQUIRED(409, "신청 폼을 먼저 연결하세요.")
```

FE가 "신청 폼을 먼저 연결하세요." 안내를 별도로 표시해야 하므로 전용 코드 추가. 신청 폼 판정 기준: `APPLICATION_FORM.questions` 배열 길이 ≥ 1 (NOT NULL 만으로 불충분).

### 구현 메모

- `publish(accountId, studyId)` · `unpublish(accountId, studyId)` — 캡틴 전용이라 진입 메서드 각각 하나. 첫 줄 `assertCaptain`. `create`·`delete` 패턴과 동일. `FromSite`/`ForBackOffice` 접미사 없음.
- 신청 폼 판정: `study.getApplicationForm()` null 이거나 `questions` 배열 길이 0 → `APPLICATION_FORM_REQUIRED`. APPLICATION_FORM JSON 구조 정본: [study-application/spec.md §APPLICATION_FORM](../study-application/spec.md)
- 상태 전이는 `Study` 엔티티의 의미 있는 메서드(`Study#publish()` · `Study#unpublish()`)로. setter 금지.
- 최신 회차: `STUDY_RECRUITMENT` 에서 `id` MAX 인 행. publish 시 `START_AT = now()`, unpublish 시 `START_AT = null`.

### 테스트 요구사항

| 엔드포인트 | 성공 | 401 | 403 | 404 | 409-CONFLICT | 409-APP_FORM |
|---|---|---|---|---|---|---|
| `POST /api/admin/studies/{id}/publish` | DRAFT+폼 있음 → 204, STATUS=OPEN, 최신 회차 START_AT 채워짐 | 토큰 없음 | 네비게이터 | 없는 id | 이미 OPEN | 폼 없음/questions 0개 |
| `POST /api/admin/studies/{id}/unpublish` | OPEN → 204, STATUS=DRAFT, 최신 회차 START_AT=null | 토큰 없음 | 네비게이터 | 없는 id | DRAFT·ONGOING·ENDED·CLOSED | — |

### 프론트엔드 사용처

- `back-office-front` 운영 콘솔 스터디 목록 — 공개 설정 토글 ([captain-publish-study PRD](../../planning/stories/captain-publish-study/PRD.md))
- 아직 미구현 (`TODO(api)`)

### 미확정 → 해소

| 항목 | 이전 상태 | 결정 |
|------|-----------|------|
| 공개 취소 조건 | 신청 0건일 때만 vs 언제나 | **언제나 허용** (신청 기록 유지) |
| 경로 형태 | `/publish` vs `PATCH` | **POST `/publish`·`/unpublish`** |
| 신청 폼 없음 응답 코드 | 미정 | **409 APPLICATION_FORM_REQUIRED** |

---

## 스터디 수정

> 유저스토리: 캡틴 또는 네비게이터가 등록된 스터디의 내용을 수정한다.

### 인수 기준

| ID   | 기준                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| AC-1 | 등록 때 입력한 항목(프로그램·종류·상태 제외)을 모두 수정할 수 있다                       |
| AC-2 | 저장하면 사용자 사이트 목록·상세에 바뀐 내용이 즉시 반영된다                             |
| AC-3 | 등록과 같은 검증이 적용되며, 실패하면 저장되지 않고 어떤 필드가 문제인지 응답에 포함된다 |
| AC-4 | recruitDeadline 을 수정하면 모집 상태 판정에 즉시 반영된다                               |

### 기본 정보

- **Method**: PATCH
- **Path**: 관객마다 하나 — 요청·응답·검증은 같고 권한만 다르다 ([관객별 엔드포인트](#관객별-엔드포인트))

| Path | 누가 | 서비스 진입 메서드 |
|---|---|---|
| `/api/admin/studies/{studyId}` | 캡틴만 (**신설**) — 운영 콘솔 정보 탭 | `updateFromBackOffice` → `assertCaptain` |
| `/api/studies/{studyId}` | 캡틴 또는 맡은 스터디의 네비게이터 — 사용자 사이트 | `updateFromSite` → `assertCaptainOrNavigator` |

- **인증**: 필요 — 위 표 (미확정: 네비게이터의 맡은 스터디 범위 정의 필요)
- **설명**: 스터디 정보를 부분 수정한다. 전송한 필드만 반영하며, 누락한 필드는 기존 값을 유지한다. `recruitDeadline`·`capacity` 수정 시 **id 최대인(최신) `STUDY_RECRUITMENT`** 행을 UPDATE 한다 — 모집 회차가 여러 개(추가 모집)여도 지난 회차는 손대지 않는다.

### Path Parameters

| 이름    | 타입 | 설명      |
| ------- | ---- | --------- |
| studyId | Long | 스터디 ID |

### Request Body

```json
{
  "title": "AI 논문 스터디 시즌 2",
  "oneLineSummary": "AI 최신 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI_ML",
  "recruitDeadline": "2026-12-01T00:00:00Z",
  "capacity": 20,
  "schedule": "매주 목 20:00 · 8주 과정",
  "timezone": "KST",
  "startAt": "2026-10-15T00:00:00Z",
  "discordChannelUrl": "https://discord.com/channels/123/456",
  "driveUrl": "https://drive.google.com/drive/folders/abc"
}
```

| 필드              | 타입    | 필수 | 검증                                                      | 소스                                                         |
| ----------------- | ------- | ---- | --------------------------------------------------------- | ------------------------------------------------------------ |
| title             | String  | N    | 1~60자 (trim 후)                                          | STUDY.TITLE                                                  |
| oneLineSummary    | String  | N    | 비어 있으면 저장 불가                                     | STUDY.ONE_LINE_SUMMARY                                       |
| description       | String  | N    | —                                                         | STUDY.DESCRIPTION                                            |
| category          | String  | N    | StudyCategory enum 값 중 하나                             | STUDY.CATEGORY                                               |
| recruitDeadline   | String  | N    | **null 불가.** 값을 보내면 미래여야 함 — 상시 모집은 없다 | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT — 최신 회차 행 UPDATE  |
| capacity          | Integer | N    | 1 이상의 정수, 또는 `null`(제한 없음)                     | STUDY_RECRUITMENT.RECRUITMENT_CAPACITY — 최신 회차 행 UPDATE |
| schedule          | String  | N    | 자유 텍스트                                               | STUDY.SCHEDULE                                               |
| timezone          | String  | N    | `KST` / `PST` / `BOTH`, 또는 `null`(미정으로 되돌림)      | STUDY.TIMEZONE                                               |
| startAt           | String  | N    | ISO 8601 UTC, 또는 `null`(미정으로 되돌림)                | STUDY.START_AT                                               |
| discordChannelUrl | String  | N    | http(s) URL, 또는 `null`                                  | STUDY.DISCORD_CHANNEL_URL                                    |
| driveUrl          | String  | N    | http(s) URL, 또는 `null`                                  | STUDY.DRIVE_URL                                              |

**수정 불가 필드:**

| 필드           | 이유                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| studyProgramId | 프로그램 연결은 변경 불가 — [POL-0003](../../01-planning/_registry/policies/POL-0003-study-fields.md)          |
| studyKind      | `STUDY_PROGRAM` 소속이라 이 엔드포인트로 못 고친다. 등록 후 변경 불가 — [ERD](../../docs/erd/STUDY_PROGRAM.md) |
| status         | 별도 API(`/publish`·`/unpublish`, 운영 종료 전환은 미구현)에서만 전환                                          |

### 구현 메모 (2026-09-27)

- **`null` 과 키 생략을 구분한다.** `capacity`·`startAt`·`discordChannelUrl`·`driveUrl` 은 `null`(또는 빈 문자열 주소)을 보내면 비우고,
  키를 빼면 그대로 둔다. 나머지 필드는 `null` 이면 바꾸지 않는다
- **정원은 최신 모집 회차의 `STUDY_RECRUITMENT.RECRUITMENT_CAPACITY` 에 저장한다** (V26 에서 `STUDY.CAPACITY` 를 옮기고 삭제).
  목록 응답·목록 단계 필터(JPQL)·상세의 모집 상태 판정이 모두 같은 회차의 정원과 신청 수를 비교한다. 모집 회차가 없으면 정원 수정은 404 다
- `timezone` 은 컬럼이 없어 받지 않는다 — 보내면 무시된다
- 운영 콘솔(정보 탭)은 **바뀐 칸만** 보낸다. 마감이 지난 스터디의 다른 칸을 고칠 때 지난 `recruitDeadline` 을 다시 보내면 400 이다
- 프론트엔드 사용처: `frontend/apps/back-office-front/src/components/StudyInfoTab.tsx` (DELETE 도 같은 파일) — 호출은 `features/studies/queries.ts` `useUpdateStudy`. `/api/admin/studies/{studyId}` 로 옮긴다

### Response — 204 No Content

응답 바디 없음.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 검증 실패 — title 60자 초과, oneLineSummary 빈 값, category 가 유효하지 않은 enum 값, recruitDeadline 이 과거이거나 null, capacity 가 1 미만, timezone 이 유효하지 않은 enum 값, startAt·discordChannelUrl·driveUrl 형식 오류. 실패한 필드를 `필드명: 사유` 형태로 응답 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `/api/admin` — ADMIN 아님(네비게이터 포함). `/api/studies` — 캡틴도 그 스터디 네비게이터도 아님 |
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |

500(저장 실패)은 별도 errorCode 없이 처리.

### 미확정

- **네비게이터 권한 범위** — 전 항목인가, 일부 항목은 캡틴 전용인가.
- **네비게이터의 맡은 스터디 범위** — 담당자–스터디 관계 테이블이 없으면 서버 측 권한 체크 불가. 별도 Story 에서 정의 필요.

---

## 스터디 삭제

> 유저스토리: 캡틴이 더 이상 사용하지 않는 스터디를 삭제한다.

### 인수 기준

| ID   | 기준                                                           |
| ---- | -------------------------------------------------------------- |
| AC-1 | 삭제된 스터디는 사용자 사이트 목록·상세에서 즉시 사라진다      |
| AC-2 | 스터디와 함께 크루 명단(참여 기록)과 출석 기록이 모두 삭제된다 |
| AC-3 | 삭제는 되돌릴 수 없다                                          |

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/admin/studies/{studyId}` — `AdminStudyController`. 캡틴 전용이라 사이트 경로는 두지 않는다. 옛 `DELETE /api/studies/{studyId}` 는 없앴다
- **인증**: 필요 — 캡틴(ADMIN) 만 (`assertCaptain`). 크루 명단·출석 기록까지 함께 사라지므로 네비게이터는 불가
- **설명**: 스터디와 그에 달린 모든 모집·참여·출석 기록을 영구 삭제한다. 소프트 삭제가 아닌 물리 삭제다. 클럽의 다른 기수(형제 `STUDY` 행)는 영향받지 않는다 — `STUDY_PROGRAM` 은 그대로 남는다.

### Path Parameters

| 이름    | 타입 | 설명      |
| ------- | ---- | --------- |
| studyId | Long | 스터디 ID |

### Request Body

없음.

### Response — 204 No Content

응답 바디 없음.

### 삭제 시 함께 제거되는 데이터

| 테이블            | 조건                              | 비고                           |
| ----------------- | --------------------------------- | ------------------------------ |
| STUDY             | ID = studyId                      | 대상 기수 본체                 |
| STUDY_RECRUITMENT | STUDY_ID = studyId                | 모집 회차 전체(추가 모집 포함) |
| STUDY_APPLICATION | RECRUITMENT_ID in 위 회차         | 신청 기록                      |
| STUDY_GROUP       | STUDY_ID = studyId                | 반                             |
| STUDY_PARTICIPANT | STUDY_ID = studyId                | 크루 명단                      |
| ATTENDANCE        | STUDY_ID = studyId (또는 연관 FK) | 출석 기록                      |

> 위 테이블 목록은 현재 ERD 기준이며, 관련 테이블이 추가되면 함께 갱신한다.

### Error Responses

| 상태 | errorCode    | 조건                            |
| ---- | ------------ | ------------------------------- |
| 401  | UNAUTHORIZED | 로그인 필요                     |
| 403  | FORBIDDEN    | 권한 없음 (ADMIN 아님)          |
| 404  | NOT_FOUND    | studyId 에 해당하는 스터디 없음 |

### 미확정

- **삭제 대신 보관(아카이브)** — 종료된 스터디의 출석 기록은 통계의 근거다. 아카이브 전환으로 대체할지 검토 필요.
- **진행 중 스터디 삭제 허용 여부** — 참여자가 있는 `STATUS=OPEN` 이후 단계 스터디도 삭제할 수 있게 할지, `CLOSED` 상태에서만 삭제 가능하게 막을지 미결.

---

## 신청 폼 · 신청 · 결과

유저스토리 「캡틴은 스터디 신청용 폼을 작성할 수 있다」·「크루는 스터디 신청 폼을 제출할 수 있다」·「캡틴은 스터디 신청서 결과를 모아볼 수 있다」는 [study-application/spec.md](../study-application/spec.md) 가 정본이다.

결정 요약 (상세는 그쪽):

- 저장 위치는 `STUDY.APPLICATION_FORM` (기수). 신청 행은 `STUDY_APPLICATION.RECRUITMENT_ID` (모집 회차)
- 이름·이메일은 폼에 두지 않고 계정에서 읽는다. 디스코드 별명·참여 요일은 플랫폼 기본 문항
- 질문 설명은 여러 줄 마크다운 원문
