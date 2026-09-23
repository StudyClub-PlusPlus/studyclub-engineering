# 회원 탈퇴 API Spec

> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md), [ACCOUNT_IDENTITY](../../docs/erd/ACCOUNT_IDENTITY.md), [ACCOUNT_CONSENT](../../docs/erd/ACCOUNT_CONSENT.md), [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md), [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md), [STUDY_REVIEW](../../docs/erd/STUDY_REVIEW.md), [STUDY_PROPOSAL](../../docs/erd/STUDY_PROPOSAL.md), [STUDY_PROPOSAL_INTEREST](../../docs/erd/STUDY_PROPOSAL_INTEREST.md), [STUDY_BOOKMARK](../../docs/erd/STUDY_BOOKMARK.md), [NOTIFICATION](../../docs/erd/NOTIFICATION.md)
> 프로토타입: `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/leave` (`/proto/core/ko/my/leave`)
> 관련: [user-onboarding/spec.md](../user-onboarding/spec.md) — 완료 뒤 같은 계정 재가입은 온보딩 흐름 그대로 탄다. [notification/spec.md](../notification/spec.md) — NOTIFICATION 스냅샷 비식별화가 이 스펙과 맞물린다. [study-application/spec.md](../study-application/spec.md) — FORM_ANSWER.discordNickname 비식별화가 이 스펙과 맞물린다. `frontend/apps/playground/src/proto/core/lib/legal.ts` — 이용약관 제11조·개인정보처리방침 제4·9조 (법령상 보존 근거). [POL-0007](../../planning/_registry/policies/POL-0007-account-data.md) — 회원 데이터와 탈퇴 정책 (이 스펙과 같은 내용의 기획 정본).
> 생성일: 2026-09-19
> 상태: 스펙작성중

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| DELETE | `/api/me` | 로그인한 본인 계정을 즉시·영구 삭제 (탈퇴) | O | 스펙작성중 |
| GET | `/api/me/studies` | *(기존 API 확장)* 응답에 `participantRole`·`isActiveNavigator` 추가 — 탈퇴 화면의 "맡은 진행 중인 스터디" 경고에 사용 | O | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 개요

마이페이지(내 정보 수정 맨 아래)에서 진입하는 지면형(모달 아님) 화면. 안내 두 줄 → 탈퇴 사유(선택) →
(네비게이터로 맡은 진행 중인 스터디가 있으면 경고 + 재확인) → 탈퇴 → 즉시 처리 → 홈.

- **유예 없음.** 탈퇴 요청이 성공하면 그 요청 안에서 계정과 관련 데이터가 바로 사라진다. "탈퇴 예약 후 N일 뒤 삭제" 같은 중간 상태는 두지 않는다.
- **막지 않는다.** 네비게이터(맡은 스터디의 `LEADER`/`CO_LEADER`)여도 서버는 탈퇴를 거부하지 않는다. 프론트가 한 번 더 확인만 받는다 — [정책 근거](#네비게이터-경고--왜-막지-않는가).
- **요청자를 가리지 않는다.** `SYSTEM_ROLE=ADMIN` 도 동일하게 처리한다. 최초 ADMIN 계정은 SQL 로 세우기로 되어 있어 캡틴이 0명이 되어도 복구 가능하다 — 별도 "마지막 관리자" 가드를 두지 않는다.
- **재가입 가능.** `ACCOUNT`·`ACCOUNT_IDENTITY` 를 물리 삭제하므로 같은 구글 계정으로 다시 로그인하면 `(ISSUER, sub)` 미존재 + 동일 이메일 없음(이메일도 같이 지워졌으므로) 경로를 타 신규 가입으로 이어진다([user-onboarding](../user-onboarding/spec.md) 그대로).

## 공통 사항

- **accountId**: 요청 파라미터가 아닌 JWT 의 Security Context(`authentication.getPrincipal()`)에서 추출한다. 다른 계정을 지정해서 지울 수 없다.
- **`@RequireOnboarding` 를 걸지 않는다.** 온보딩을 마치지 못한 계정도 스스로를 지울 수 있어야 한다 — "모든 탈퇴 요청을 그대로 처리한다"는 정책과, 온보딩 중단자가 계정을 영영 못 지우는 상태를 막기 위해서다.
- **500**: 모든 엔드포인트는 예기치 않은 서버 오류 시 `500 INTERNAL_ERROR` 를 반환할 수 있다.

---

## DELETE /api/me

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/me`
- **인증**: 필요 (온보딩 완료 여부 무관)
- **설명**: 로그인한 본인 계정을 사유(선택)와 함께 즉시 삭제한다. 되돌릴 수 없다.

### Request Body

```jsonc
{
  "reason": "NO_DESIRED_STUDY" // 선택. 생략하거나 null 이면 사유 없이 탈퇴
}
```

| 필드 | 타입 | 필수 | 제약 |
|------|------|------|------|
| reason | string \| null | 아니오 | `NO_DESIRED_STUDY` \| `PARTICIPATION_BURDEN` \| `OTHER` 중 하나. 그 외 값(자유 문장 포함)은 `400 INVALID_INPUT` |

- 자유 입력 사유 칸은 없다 — 집계용이라 정해진 값 셋 중 하나만 받는다.
- 사유는 **계정과 잇지 않고** 별도로 쌓는다 — [데이터 모델](#데이터-모델-변경) 참고.

### 처리 순서 (한 트랜잭션)

1. JWT principal 로 accountId 확인. 없으면 `401 UNAUTHORIZED`.
2. `reason` 값이 정해진 셋에 없으면 `400 INVALID_INPUT`.
3. `ACCOUNT` 조회. 없으면(이미 탈퇴 처리됨 — 중복 요청 등) `404 NOT_FOUND`.
4. 아래를 **한 트랜잭션**으로 처리한다 — 하나만 지워지고 하나는 남는 중간 상태를 두지 않는다:
   - `ACCOUNT_LEAVE_REASON` 1행 insert (`reason`, `createdAt=now`). accountId 는 담지 않는다.
   - `ACCOUNT_IDENTITY` WHERE `ACCOUNT_ID=accountId` 전부 물리 삭제 (로그인 수단 파기 — 이 삭제가 빠지면 재가입 시 `UNIQUE(ISSUER, PROVIDER_ACCOUNT_ID)` 에 걸려 [완료 기준 6](#완료-기준)이 깨진다).
   - `STUDY_PARTICIPANT` WHERE `ACCOUNT_ID=accountId` 전부 물리 삭제 (참여 기록 파기 — 이 사람이 맡고 있던 네비게이터 자리가 사라진다. 공동 네비게이터가 없었다면 그 스터디는 네비게이터가 없는 상태가 되고, 있었다면 그 사람만 남는다 — 어느 쪽이든 시스템은 구분하지 않고 똑같이 처리한다).
   - `STUDY_BOOKMARK` WHERE `ACCOUNT_ID=accountId` 전부 물리 삭제 (관심 표시 파기).
   - `STUDY_PROPOSAL_INTEREST` WHERE `ACCOUNT_ID=accountId` 전부 물리 삭제 (관심 표시 파기).
   - `NOTIFICATION` WHERE `RECIPIENT_USER_ID=accountId` 인 행의 `RECIPIENT_VALUE`·`PAYLOAD.nickname` 을 비식별 처리한다 (행은 유지, 발송 이력 자체는 지우지 않는다) — [알림 비식별화](#알림-비식별화) 참고.
   - `STUDY_PROPOSAL` WHERE `PROPOSER_ACCOUNT_ID=accountId` AND `STATUS=OPEN` → `STATUS=CLOSED` 로 전환한다. `CONTENT`·`PROPOSED_AT` 은 그대로 둔다. `ACCEPTED`/`REJECTED`/이미 `CLOSED` 인 행은 이미 종결 상태라 건드리지 않는다 — [STUDY_PROPOSAL 처리](#study_proposal-처리--기존-상태-전이-재사용) 참고.
   - `STUDY_APPLICATION` WHERE `ACCOUNT_ID=accountId` 인 행의 `FORM_ANSWER.discordNickname` 을 고정 마스킹 값으로 치환한다(`availableDays`·`scheduleAgreed`·`answers` 는 그대로 둔다). 행 자체는 지우지 않는다 — [STUDY_APPLICATION 의 FORM_ANSWER.discordNickname](#study_application-의-form_answerdiscordnickname) 참고.
   - `ACCOUNT` 행 삭제. `ACCOUNT_CONSENT` 는 `fk_account_consent_account ... ON DELETE CASCADE` 로 함께 삭제된다 (프로필·동의 파기).
   - `STUDY_ATTENDANCE`·`STUDY_REVIEW`·(방금 `discordNickname` 만 마스킹한) `STUDY_APPLICATION`·(방금 `CLOSED` 로 바뀐) `STUDY_PROPOSAL` 은 이 이상 **행 자체를 더 건드리지 않는다.** 이들의 `ACCOUNT_ID`/`PROPOSER_ACCOUNT_ID` 는 FK 가 아니라 인덱스뿐이라(`database-guide.md` 외래키 정책) DB 무결성 오류 없이 그대로 남고, 참조할 `ACCOUNT` 행 자체가 없어져 더는 사람으로 되짚을 수 없다 — 이것으로 "개인을 식별할 수 없도록 처리한 뒤 남긴다"가 성립한다. 별도 컬럼 변경(NULL 처리 등)이 필요 없다. 조회 계층은 이 ID 로 `ACCOUNT` 조회가 실패하면 "탈퇴한 회원"으로 표시한다(신규 요구사항 — 기존에 이런 실패 케이스를 다루지 않았다면 이번에 추가).
5. `204 No Content`.

### 발급된 토큰은 서버가 무효화하지 못한다 — 알려진 한계

`docs/erd/SESSION.md` 는 "Redis 에 세션을 두고 `REMOVED_AT` 으로 즉시 무효화한다"는 **설계**지만,
아직 구현되지 않았다 — 백엔드 어디에도 Redis 관련 코드가 없다. 실제로는 `JwtService` 가 발급하는
access(7일)·refresh(30일) 토큰 모두 서명 검증만 하는 순수 stateless JWT 라, 서버가 특정 토큰을
콕 집어 무효화할 방법이 없다. 즉 **탈퇴 처리 후에도 이미 발급된 토큰은 자연 만료(최장 30일)까지
서명 검증만으로 계속 통과한다** — `GET /auth/me` 등 계정 조회 API 는 `ACCOUNT` 행이 없으면
`404`/`401` 로 응답하니 실질적인 오남용 범위는 제한적이지만, 이론적으로는 남는다.

이는 이 기능만의 문제가 아니라 현재 인증 구조 전체의 특성이라 `DELETE /api/me` 혼자서 새로
풀지 않는다 — `SESSION`(Redis) 이 실제로 구현되는 시점에 이 엔드포인트도 그 무효화 로직을 같이
호출하도록 후속 작업한다.

- **프론트가 할 수 있는 것**: 탈퇴 성공 직후 로그인 중인 **이 브라우저**에서는 즉시 로그아웃 상태로
  만든다. `frontend/apps/core-front/src/lib/auth.ts` 의 `logout()`(localStorage 사용자 정보 제거 +
  `POST /api/auth/logout` 으로 httpOnly 쿠키 제거)을 탈퇴 성공 콜백에서 그대로 호출한다 — 새 로직을
  만들지 않고 로그아웃과 동일한 정리를 재사용한다. 단, 이건 "이 브라우저의 흔적 정리"일 뿐 다른
  기기에 남아 있는 토큰이나 탈취된 토큰까지 막지는 못한다.

### Response — 204

바디 없음.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | `INVALID_INPUT` | `reason` 이 정해진 값 셋에 없음 |
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 만료 |
| 404 | `NOT_FOUND` | accountId 에 해당하는 `ACCOUNT` 없음 (이미 탈퇴 처리됨 — 중복 클릭·동시 요청 등) |
| 500 | `INTERNAL_ERROR` | 예기치 않은 서버 오류 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/components/ProfileDialog.tsx` — "내 정보 수정" 모달(현재 이름·거주지역 편집) 콘텐츠 맨 아래, footer 위에 탈퇴 진입 링크 추가. `/my/page.tsx` 의 "내 정보 수정" 버튼이 이미 로그아웃 버튼 바로 옆에 있으므로, 그 버튼 자체나 그 옆이 아니라 **버튼을 눌러 연 모달 안**에 둬야 PRD 의 "헤더 메뉴에 두면 로그아웃 옆에서 잘못 눌린다"는 경고를 지킨다
- `frontend/apps/core-front/src/app/[locale]/my/leave/page.tsx` — 신규 탈퇴 화면 (프로토타입과 같은 경로 패턴). 모달이 아닌 별도 지면이다 — 이 모달에서 링크를 누르면 모달이 닫히고 이 경로로 이동한다
- `frontend/apps/core-front/src/lib/me.ts` — `TODO(api): DELETE /api/me`
- 참고 UX: `frontend/apps/playground/src/app/(proto)/proto/core/[locale]/my/leave/page.tsx` (구 프로토타입 — 맡은 스터디가 있으면 막는 옛 정책이라 본 스펙과 화면 구성이 다르다. 안내 문구·레이아웃만 참고하고 "막는다" 로직은 가져오지 않는다)

---

## GET /api/me/studies (기존 API 확장)

새 엔드포인트가 아니다. 이미 있는 `ParticipantHubController#getParticipantHubOverview` 의 응답에
필드를 추가한다 — [common-guide.md](../../docs/common-guide.md) "기존 API 먼저 활용" 원칙.

탈퇴 화면이 "맡은 진행 중인 스터디"를 **서버 판정**으로 이름까지 보여줘야 하는데
([완료 기준 3](#완료-기준)), 현재 응답(`ParticipatingStudySummary`)에는 그 판정 결과가 없다.
새 엔드포인트를 만드는 대신 이 응답에 필드를 얹는다.

### 변경 전

```java
record ParticipatingStudySummary(
    Long cohortId, Long studyId, String title,
    ParticipantStatus participantStatus, Integer attendanceRate,
    Instant nextMeetingAt, String thumbnailUrl) {}
```

### 변경 후

```java
record ParticipatingStudySummary(
    Long cohortId, Long studyId, String title,
    ParticipantStatus participantStatus, Integer attendanceRate,
    Instant nextMeetingAt, String thumbnailUrl,
    ParticipantRole participantRole,   // 추가 — 다른 화면에서도 "네비게이터" 뱃지 등에 재사용 가능한 일반 정보
    boolean isActiveNavigator) {}      // 추가 — 이 스터디에서 이 사람이 빠지면 자리가 비는가 (판정은 서버가 끝낸다)
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| participantRole | string | N | `MEMBER` \| `LEADER` \| `CO_LEADER` | `STUDY_PARTICIPANT.PARTICIPANT_ROLE` |
| isActiveNavigator | boolean | N | `participantRole IN (LEADER, CO_LEADER)` 이고 `STUDY.STATUS=OPEN` 이면 `true` | 계산 — 아래 판정 로직 |

처음엔 `studyStatus`(`STUDY.STATUS` 원본)를 그대로 내려주고 프론트가 `participantRole in
(LEADER, CO_LEADER) && studyStatus === 'OPEN'` 으로 조합해 판단하게 할 생각이었으나, 그러면 "이
조합이면 자리가 빈다"는 도메인 규칙을 프론트가 알아야 한다 — PR 리뷰 지적으로 `isActiveNavigator`
하나로 바꿨다. 원본 role·status 를 내려주는 것만으로는 "서버가 판정한다"를 절반만 지키는 셈이고,
프론트는 그 값이 `true`인 항목만 골라 보여주면 된다(도메인 규칙을 몰라도 됨).

### "맡은 진행 중인 스터디" 판정

```
STUDY_PARTICIPANT
  WHERE ACCOUNT_ID = :me
    AND PARTICIPANT_ROLE IN (LEADER, CO_LEADER)
    AND STATUS IN (ACTIVE, PAUSED)
  → STUDY_ID
JOIN STUDY WHERE STATUS = OPEN
  → 이 STUDY_ID 들에 대해 isActiveNavigator = true
```

`STUDY.STATUS=OPEN` 을 "진행 중"으로 쓴다 (`DRAFT`·`CLOSED` 제외). ERD 의 모집 상태 5단계 중
`ONGOING`(진행중)·`UPCOMING`·`ENDED` 는 이번 스프린트 기준 코드에 없는 파생 상태라(`RecruitStatus.java`
주석 참고) 쓸 수 없다 — 대신 사람이 결정하는 `STUDY.STATUS` 로 "공개되어 실제로 도는 기수인가"만
가른다. `DRAFT`는 아직 공개 전이라 네비게이터가 빠져도 멈출 게 없고, `CLOSED`는 이미 끝나
"끝난 스터디는 맡은 사람이 빠져도 멈출 것이 없다"([정책](#네비게이터-경고--왜-막지-않는가))에 해당한다.

### `@RequireOnboarding` 과의 관계

`ParticipantHubController` 는 클래스 전체에 `@RequireOnboarding` 이 걸려 있어, 온보딩 미완료
계정이 이 API 를 부르면 `403 ONBOARDING_REQUIRED` 다. 반면 `DELETE /api/me` 는 온보딩 여부와
무관하게 호출 가능하다([공통 사항](#공통-사항)) — 그대로 두면 온보딩 미완료 계정의 탈퇴 화면이 이
API 를 불렀을 때 403 을 받는 모순처럼 보인다.

실제로는 문제가 안 된다 — [user-onboarding spec](../user-onboarding/spec.md#회원-전용-api-공통-규칙)의
"회원 전용 API 공통 규칙"에 따라 신청·참여 자체가 온보딩 완료 계정만 가능하므로, 온보딩 미완료
계정은 애초에 `STUDY_PARTICIPANT` 행을 가질 수 없다 — "맡은 스터디"가 구조적으로 존재하지 않는다.
그래서 프론트는 온보딩 미완료 계정에는 이 API 를 아예 호출하지 않고 경고 상자 없이 바로 탈퇴
버튼을 보여줘도 안전하다. 이 엔드포인트의 `@RequireOnboarding` 은 그대로 둔다.

### Error Responses

기존과 동일. 필드 추가는 하위 호환(additive)이라 에러 조건은 바뀌지 않는다.

---

## 데이터 모델 변경

### 신규 — `ACCOUNT_LEAVE_REASON`

계정과 잇지 않고 사유만 쌓는 집계 전용 테이블. `ACCOUNT_ID` 컬럼 자체를 두지 않는다 — 계정이
지워지면 이을 대상도 없기 때문이다(PRD 원문).

| 컬럼 | 타입 | NULL | 설명 |
|---|---|---|---|
| ID | BIGINT PK | N | |
| REASON | VARCHAR(30) | Y | `NO_DESIRED_STUDY` \| `PARTICIPATION_BURDEN` \| `OTHER`. 선택 안 하면 NULL |
| CREATED_AT / UPDATED_AT | DATETIME | N | `BaseEntity` (UPDATED_AT 은 이 테이블에선 갱신되지 않는다 — insert-only) |

- 매 탈퇴 요청마다 사유 값과 무관하게 1행을 남긴다 — 그래야 "탈퇴 사유 없음"의 비중도 집계할 수 있고, 총 탈퇴 건수도 이 테이블 count 로 얻는다. reason=NULL 인 행을 안 남기는 대안도 있었지만, 그러면 "총 탈퇴 수"를 알 방법이 이 테이블 밖에 없어진다.
- FK 없음, `ACCOUNT_ID` 없음 — 이 테이블은 애초에 어떤 애그리거트에도 속하지 않는 순수 집계 로그다.
- 마이그레이션(`V{n}__*.sql`)과 ERD 문서(`docs/erd/ACCOUNT_LEAVE_REASON.md` 신설 + `docs/erd/README.md` mermaid 2곳)는 구현 PR 에서 추가한다.
- **범위 밖 — 백오피스 집계 화면.** 이 스펙은 저장까지만 정의한다. "탈퇴 사유 비중" · "총 탈퇴 수" 를
  백오피스 어디에 어떻게 보여줄지는 이 테이블에 데이터가 쌓이기 시작한 뒤 필요할 때 별도 스펙으로
  다룬다 — 지금 화면을 먼저 만들 근거(수요)가 없다.

### 변경 없음 — 나머지 테이블

`ACCOUNT`·`ACCOUNT_IDENTITY`·`ACCOUNT_CONSENT`·`STUDY_PARTICIPANT`·`STUDY_BOOKMARK`·
`STUDY_PROPOSAL_INTEREST`·`STUDY_ATTENDANCE`·`STUDY_REVIEW`·`STUDY_PROPOSAL`·`STUDY_APPLICATION`·
`NOTIFICATION` 모두 스키마 변경이 필요 없다. 탈퇴 처리는 기존 컬럼에 대한 DELETE/UPDATE 로 전부 표현된다
(`STUDY_PROPOSAL` 도 기존 `STATUS` enum 의 `CLOSED` 값을 그대로 쓴다 — 새 상태값 추가 없음) —
자세한 근거는 [처리 순서](#처리-순서-한-트랜잭션) 참고.

### STUDY_PROPOSAL 처리 — 기존 상태 전이 재사용

제안자가 탈퇴하면 `STUDY_PROPOSAL`(제안 본문 — "이런 스터디 열어주세요", `STUDY_PROPOSAL.md`)은
**물리 삭제하지 않고 `STATUS=CLOSED` 로 전환**한다. `CLOSED` 는 이미 이 테이블의 상태값에
"제안자 철회 / 기한 만료"로 정의되어 있다 — 탈퇴는 "더 이상 이 제안을 끌고 갈 사람이 없다"는
점에서 철회와 실질이 같으므로, 새 상태를 만들지 않고 기존 전이를 그대로 쓴다.

물리 삭제 대신 `CLOSED` 전환을 고른 이유:

- **제3자 데이터 보호.** `STUDY_PROPOSAL_INTEREST`(다른 회원의 "나도" 관심 표시)는 `PROPOSAL_ID`
  로 이 행을 참조한다. 제안 행을 통째로 지우면 FK 가 없어 에러는 안 나지만, **떠난 사람과 무관한
  다른 회원들의 관심 표시 기록이 조용히 고아가 된다.** 상태만 바꾸면 그 기록들은 그대로 유효하다.
- **기존 컨벤션과의 일관성.** ERD 전체 설계 원칙이 "삭제 대신 종료"([erd/README.md](../../docs/erd/README.md#설계-원칙-요구사항-정의에서))이고, 이 테이블은 이미 그 원칙대로 `CLOSED` 상태를 갖고 있다.
- **"현재성"은 상태 필터링으로 해결된다.** 목록 화면이 `STATUS=OPEN`(관심 모으는 중)만 "진행 중인
  제안"으로 보여준다면, `CLOSED` 전환만으로도 물리 삭제와 동일하게 "지금 모으는 중" 목록에서
  빠진다.
- PRD 의 "삭제 — 계정·프로필·참여·관심·디스코드" 목록에 제안 본문은 없다 — 어느 쪽을 택해도 PRD 를
  어기지 않는다.

`PROPOSER_ACCOUNT_ID` 컬럼값 자체는 바꾸지 않는다(FK 없는 인덱스 컬럼이라 `ACCOUNT` 삭제 뒤엔
자연히 조회 불가 상태가 된다) — [STUDY_ATTENDANCE 와 같은 매커니즘](#처리-순서-한-트랜잭션).
조회 계층에서 제안자 표시가 필요하면 `ACCOUNT` 조회 실패 시 "탈퇴한 회원"으로 대체한다.

### STUDY_APPLICATION 의 FORM_ANSWER.discordNickname

`STUDY_APPLICATION`(신청서 답변)은 `STUDY_ATTENDANCE`와 같은 "행은 두고 `ACCOUNT` 삭제로 자연
비식별"을 기본 원칙으로 삼았지만, 이 테이블은 그 전제가 하나 깨진다 — [`specs/study-application/spec.md`](../study-application/spec.md#form_answer-study_applicationform_answer)의
`FORM_ANSWER` JSON 안에 `discordNickname`(예: `"홍길동/SWE/산호세/시스템디자인"`)이 **행 안에 직접
박혀 있다.** `ACCOUNT` 를 지워도 이 문자열은 `STUDY_APPLICATION` 자신의 컬럼 값이라 그대로 남는다 —
`NOTIFICATION.PAYLOAD.nickname` 이 별개 컬럼이라 지우지 않으면 안 지워지는 것과 같은 이유다.

그래서 이 필드 하나만 콕 집어 마스킹한다. `FORM_ANSWER` 의 나머지 값(`availableDays`·
`scheduleAgreed`·`answers`)은 개인 식별값이 아니고 모집 회차별 운영 통계에 쓰일 수 있어 그대로
둔다 — 행 전체를 지우거나 통째로 마스킹하지 않는다.

이 결정은 [`specs/study-application/spec.md`](../study-application/spec.md#미확정)의
"[NEEDS CLARIFICATION] 신청 행 삭제·계정 탈퇴 이후 법정 최소 보관 기간"에 대한 답이기도 하다 —
행은 보존하고(법정 최소 보관 기간을 신경 쓸 필요가 애초에 없어진다), 그 안의 개인 식별 필드만
비식별한다.

## 삭제 · 보존 정책 요약

| 데이터 | 처리 | 근거 |
|---|---|---|
| `ACCOUNT` (프로필 포함) | 물리 삭제 | "계정·프로필 즉시 파기" |
| `ACCOUNT_IDENTITY` (로그인 수단) | 물리 삭제 | "즉시 파기" + 재가입 가능 조건(UNIQUE 해제) |
| `ACCOUNT_CONSENT` (약관 동의) | 물리 삭제 (FK CASCADE) | 프로필에 준하는 계정 데이터 |
| `STUDY_PARTICIPANT` (참여) | 물리 삭제 | "참여 즉시 파기" |
| `STUDY_BOOKMARK` / `STUDY_PROPOSAL_INTEREST` (관심) | 물리 삭제 | "관심 즉시 파기" |
| 디스코드 연동 (`ACCOUNT.DISCORD_*`) | `ACCOUNT` 삭제에 포함 | "디스코드 연동 정보 즉시 파기" |
| `STUDY_ATTENDANCE` (출석) | 보존, 손대지 않음 | "출석 기록 보존, 비식별 처리" — FK 없어 자동으로 식별 불가 |
| `STUDY_REVIEW` (후기) | 보존, 손대지 않음 | 공개 콘텐츠, 다른 회원이 참고. `STUDY_ATTENDANCE` 와 동일 매커니즘으로 자동 비식별 |
| `STUDY_APPLICATION` (신청서 답변) | 보존, 단 `FORM_ANSWER.discordNickname` 만 비식별 | 나머지는 `STUDY_ATTENDANCE` 와 동일 매커니즘. `discordNickname` 은 행에 직접 박힌 PII 라 별도 마스킹 필요 — [상세](#study_application-의-form_answerdiscordnickname) |
| `STUDY_PROPOSAL` (제안 본문) | `STATUS=OPEN` 인 것만 `CLOSED` 로 전환, 행·본문 보존 | [STUDY_PROPOSAL 처리](#study_proposal-처리--기존-상태-전이-재사용) — 제3자 관심 표시 보호 |
| `NOTIFICATION` (알림 이력) | 보존 + PII 필드만 비식별 | [알림 비식별화](#알림-비식별화) |
| 탈퇴 사유 | `ACCOUNT_LEAVE_REASON` 신규 1행, 계정과 미연결 | "사유만 쌓는다" |

`STUDY_REVIEW`·`STUDY_ATTENDANCE` 는 같은 근거로 같은 처리를 받는다 — FK 없는 인덱스 컬럼이라
`ACCOUNT` 를 지우면 자동으로 식별 불가능해지고, PRD 의 파기 목록("계정·프로필·참여·관심·디스코드")
에도 들지 않는다. `STUDY_APPLICATION` 도 원칙은 같지만, `FORM_ANSWER` 안에 `ACCOUNT` 와 무관하게
그 자체로 식별 가능한 값(`discordNickname`)이 박혀 있어 그 필드 하나만 예외로 마스킹한다.

## 법령상 보존 — 지금은 대상이 없다

PRD 의 "법령상 보존이 필요한 정보는 그 기간 동안 보관한다"는 일반 조항이고, 실제 근거는
`frontend/apps/playground/src/proto/core/lib/legal.ts` 의 이용약관 제11조(회원 탈퇴)·개인정보
처리방침 제4조(처리 및 보유 기간)·제9조(파기 절차 및 방법)다. 이 세 조항을 근거로 이번 구현 범위를
정리하면:

- **처리방침 제4조 2항의 보유기간표**에는 이 스펙이 다루는 항목(회원가입·프로필, 스터디 참여·관심
  이력, 디스코드 연동)이 전부 **"회원 탈퇴 시까지"**로만 적혀 있다 — 근거는 "정보주체 동의"이지
  법령이 아니다. 즉 **탈퇴 즉시 파기 자체가 이미 보유기간 준수**이고, 이 데이터들에 대해 별도로
  지켜야 할 법정 보존기간은 없다.
- **처리방침 제9조 3항**: "이 방침의 시행일 현재, [법령상 보존] 대상 개인정보는 없습니다." —
  현재 서비스에 결제·전자상거래 기록처럼 법정 보존 의무가 걸리는 데이터 자체가 없다. 그래서
  `DELETE /api/me` 는 "법령상 보존 대상인지 판별해서 남긴다" 같은 분기를 두지 않는다 — 둘 근거가
  없다.
- **처리방침 제4조 3항 / 제9조 2항의 예외** — "관계 법령에 따른 조사·수사가 진행 중인 경우"에는
  절차 종료까지 보관해야 한다. **이번 구현은 이 예외를 자동화하지 않는다** — `DELETE /api/me` 에
  수사 진행 여부를 판별하는 홀드 로직을 두지 않고 항상 즉시 삭제한다. 발생 빈도가 극히 낮고,
  수사기관 요청은 애초에 사람이 개입하는 매뉴얼 절차(요청 접수 → 법무 확인 → 삭제 보류)라
  API 로 표현할 성격이 아니라고 보고 명시적으로 범위 밖으로 둔다. 실제로 이런 요청이 들어오면
  그 계정에 한해 운영자가 이 API 호출 전에 별도로 데이터를 백업해 둬야 한다 — 코드가 아니라
  프로세스로 막는 경우다.
- "서비스 이용 기록·접속 IP" 는 별도 행(수집일로부터 3개월, 클럽 자체 운영 정책)이지만 인프라
  로그 영역이라 `ACCOUNT` 삭제와 무관하고 이 스펙이 다루는 DB 테이블에 해당 데이터가 없다.

## 알림 비식별화

`NOTIFICATION` 은 발송 시점 이메일 원문(`RECIPIENT_VALUE`)과 닉네임(`PAYLOAD.nickname`)을
스냅샷으로 들고 있고, `RECIPIENT_USER_ID` 로 `ACCOUNT` 를 참조한다(FK 없음). `ACCOUNT` 를 지워도
이 스냅샷은 별개 컬럼이라 그대로 남는다 — 지우지 않으면 "계정은 지웠는데 이메일은 로그에 남아있다"가
되어 "즉시 파기"가 성립하지 않는다.

그래서 탈퇴 처리 시 같은 트랜잭션에서 `RECIPIENT_USER_ID=accountId` 인 `NOTIFICATION` 행의
`RECIPIENT_VALUE` 를 고정 마스킹 값으로, `PAYLOAD` 의 `nickname` 을 `null` 로 치환한다. 행 자체
(발송 이력·상태·시각)는 지우지 않는다 — "탈퇴한 계정에게 언제 무슨 알림이 나갔는지"는 발송 이력이지
회원 개인정보가 아니다.

- 구체적인 마스킹 값·컬럼 갱신 코드는 notification 모듈 소관이다. 이 스펙은 "무엇을 비식별해야
  하는가"까지만 정의하고, "어떻게(이벤트 vs 직접 리포지토리 호출)"는 plan.md 에서 정한다.
- **동기 처리**를 전제로 한다 — 온보딩의 `UserRegisteredEvent`처럼 커밋 후 비동기로 미루면, 그 사이
  프로세스가 죽었을 때 "탈퇴했는데 이메일이 아직 남아있는" 창이 생겨 "즉시 파기"와 어긋난다.

## 네비게이터 경고 — 왜 막지 않는가

- 탈퇴는 회원의 권리이고, 서버가 "맡은 스터디가 있으니 탈퇴 불가"로 막으면 그 자체로 권리를 제한하는
  셈이 된다. 대신 자리가 빈다는 사실을 알리고 프론트가 한 번 더 확인만 받는다.
- 인계는 화면·API 어디에서도 처리하지 않는다 — 캡틴이 크루 명단에서 새 네비게이터를 세운다(백오피스,
  범위 밖).
- `STUDY.STATUS=OPEN` 인 스터디만 센다. `DRAFT`는 아직 공개 전이라 멈출 게 없고, `CLOSED`는 이미
  끝나서 네비게이터가 빠져도 아무 것도 멈추지 않는다.
- **공동 네비게이터(`CO_LEADER`)가 남아 있어도 경고 조건은 똑같다.** "이 스터디에 다른 네비게이터가
  남는지"는 판정하지 않는다 — 인계가 실제로 필요한지 계산하는 건 "인계를 화면에서 처리하지 않는다"는
  위 정책과 어긋난다. 시스템은 "네비게이터 역할을 갖고 있었다"는 사실만 알리고, 그게 그 스터디를
  당장 멈추는 것이든 아니든 판단은 캡틴 몫으로 남긴다.
- **범위 밖 — 실제 디스코드 서버 role 제거.** `DELETE /api/me` 는 DB 의 `STUDY_PARTICIPANT` 행만
  지운다. 그 사람이 갖고 있던 디스코드 서버의 네비게이터 role 을 실제로 빼는 건 디스코드 봇 쪽
  작업이라 이 스펙(백엔드 API 계약)이 다루지 않는다 — 디스코드 스쿼드와 별도로 맞춘다.

## 완료 기준

PRD 원문 그대로 — 구현 완료 판정 기준이다.

1. 마이페이지에서 한 번에 탈퇴 지면으로 갈 수 있다
2. 되돌릴 수 없다는 것과 다시 가입할 수 있다는 것을 누르기 전에 안다
3. 네비게이터는 맡은 스터디를 이름으로 확인하고 한 번 더 답한 뒤에 탈퇴한다
4. 사유를 고르지 않아도 탈퇴된다
5. 탈퇴는 즉시 처리된다. 유예 기간이 없다
6. 같은 구글 계정으로 다시 가입할 수 있다

## 미확정

이번 리뷰 라운드에서 아래 세 가지는 결정했다 — 더 이상 열린 질문이 아니고, 참고로만 남긴다:

- ~~`STUDY_APPLICATION` 처리~~ → 보존, 단 `FORM_ANSWER.discordNickname` 만 비식별 ([근거](#삭제--보존-정책-요약)).
- ~~탈퇴 화면 프론트 경로~~ → `/[locale]/my/leave` 신설, 진입 링크는 "내 정보 수정" 모달(`ProfileDialog.tsx`) 콘텐츠 맨 아래 ([근거](#프론트엔드-사용처)).
- ~~`ACCOUNT_LEAVE_REASON` 백오피스 노출~~ → 이번 스펙 범위 밖, 저장까지만 ([근거](#신규--account_leave_reason)).

실제로 열려 있는 건 하나뿐이다:

- [NEEDS CLARIFICATION] 처리방침 제4조 3항/제9조 2항 "관계 법령에 따른 조사·수사가 진행 중인
  경우" 보존 홀드를 정말 전혀 자동화하지 않아도 되는지. [법령상 보존](#법령상-보존--지금은-대상이-없다)
  절에서 "자동화하지 않는다"를 이번 구현의 기본값으로 정했지만, 이건 **엔지니어링 판단이 아니라
  법무 판단이 필요한 사안**이라 이 스펙만으로 완전히 닫을 수 없다 — 법무·운영 확인 전까지는
  구현 기본값(홀드 없음)으로 진행하되, 확인 결과에 따라 뒤집힐 수 있음을 명시해 둔다.

## 변경이력

| 날짜 | 변경 | 근거 |
|------|------|------|
| 2026-09-19 | 최초 작성 — `DELETE /api/me` 스펙 초안 + `GET /api/me/studies` 확장 | 회원 탈퇴 기획 (PRD, 프로토타입 `/proto/core/ko/my/leave`) |
| 2026-09-23 | PR #110 리뷰(j00hyun) 반영 — SESSION(Redis) 미구현 사실 정정, `GET /api/me/studies` 를 `isActiveNavigator` 계산 필드로 교체, `STUDY_APPLICATION.FORM_ANSWER.discordNickname` 비식별 추가, `STUDY_PROPOSAL` ERD 상태도에 탈퇴 트리거 반영, 디스코드 role 제거 범위 밖 명시. `NOTIFICATION` PENDING 건 취소 처리는 PR 코멘트 스레드에서 별도 논의 후 반영 예정이라 이 라운드에서는 보류 | PR 리뷰 코멘트 7건 + `beta` 병합으로 새로 생긴 `specs/study-application/spec.md`·`POL-0007` |
