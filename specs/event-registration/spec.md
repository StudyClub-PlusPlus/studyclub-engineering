# 행사 신청 API Spec: 크루가 사이트에서 행사를 보고 신청·취소한다

> ERD: [CLUB_EVENT](../../docs/erd/CLUB_EVENT.md) · [CLUB_EVENT_CHANNEL](../../docs/erd/CLUB_EVENT_CHANNEL.md) · [CLUB_EVENT_QUESTION](../../docs/erd/CLUB_EVENT_QUESTION.md) (`V59__create_club_event.sql`). [CLUB_EVENT_REGISTRATION](../../docs/erd/CLUB_EVENT_REGISTRATION.md) (`V62__create_club_event_registration.sql`, 공통 신청 PR #516) · [ACCOUNT](../../docs/erd/ACCOUNT.md) 활성화 칸 (`V63__account_activation.sql`)
> 생성일: 2026-11-18 · 리뷰 반영: 2026-11-20 (PR #508 리뷰 — 본인 취소 대상 고정 · 신청 재시도 키 · 탈퇴 계정 토큰, R1~R6 결정. R4 는 PR #509 PRD 「활성화와 행동 분석」)
> 상태: 구현중 — 미확정 없음. 구현: `ClubEventController` · `MyClubEventController` · `ClubEventSiteService` (크루 신청 API PR)
>
> Story PRD:
> - [크루는 행사에 신청하고 참가 확정 상태를 확인할 수 있다](../../01-planning/stories/crew-apply-event/PRD.md) (ST-038)
> - 경계: [캡틴은 행사를 등록하고 신청자의 참가를 확정할 수 있다](../../01-planning/stories/captain-manage-events/PRD.md) (ST-037)
>
> 이어 쓰는 스펙: [event](../event/spec.md) (행사 등록·수정·조회, 구현중) — 상태 · 판정 메서드 · 잠금 순서를 그대로 쓴다
> 함께 맞추는 스펙 (PR #479, 리뷰 중): event-status · event-participant · event-mail — 신청 테이블 · 도메인 이벤트 · 오류 코드 · 탈퇴 처리를 공동으로 쓴다
> 기준 프로토타입: playground `/proto/core/{locale}/events` · `/proto/core/{locale}/events/{id}` · `/proto/core/{locale}/my` (내 행사)
> 판정 로직의 근거: `frontend/apps/playground/src/proto/events/model.ts` (`eventStatus` · `seatInfo` · `transition` APPLY · CANCEL · `eventQuestionVersion` · `normalizeEventAnswers` · `latestRegistrationsByEvent`), 결정은 PR #479 리뷰(S3 · P2 · P3 · P5 · M2 · M3)와 PR #484
> 실제 경로(연결 전): core-front `/[locale]/events` · `/[locale]/events/[id]` (지금은 mock 데이터, `FEATURES` 의 `TODO(api): GET /api/events`)

## 엔드포인트 목록

**사이트 행사: `/api/events` (`ClubEventController`, 공개 GET + 본인 신청)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/events | 행사 목록: 예정된 행사 · 지난 행사 묶음, 표시 상태, 내 신청 상태 | X (로그인하면 내 신청 상태를 싣는다) | 구현중 |
| GET | /api/events/{eventId} | 행사 상세: 모집 상세 · 일정 · 장소 · 방식별 잔여석 · 현재 질문 · 신청 가능 여부 · 내 신청 요약 | X (로그인하면 내 신청을 싣는다) | 구현중 |
| POST | /api/events/{eventId}/registrations | 신청 제출: `Idempotency-Key` 로 재시도를 막고, 행사 잠금 뒤 정원 · 중복 · 질문 버전을 다시 확인하고 접수 | O (`@RequireOnboarding`) | 구현중 |
| GET | /api/events/{eventId}/registrations/me | 내 신청서: 이 행사의 최신 신청 한 건과 신청 당시 질문 · 답 | O (`@RequireOnboarding`) | 구현중 |
| DELETE | /api/events/{eventId}/registrations/me?registrationId={id} | 본인 취소: 화면이 보고 있던 그 신청만, 신청 마감 시각 전까지. 행은 지우지 않고 `CANCELLED` 로 남긴다 | O (`@RequireOnboarding`) | 구현중 |

**마이페이지: `/api/me/events` (`MyClubEventController`)**

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/me/events | 내 행사: 행사별 최신 신청 한 건, 최근 신청 순 | O (`@RequireOnboarding`) | 구현중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## 먼저 읽을 것

### 이 스펙이 다루는 것과 안 다루는 것

| 다룬다 | 다루지 않는다 (다른 스펙) | 닿는 곳 |
|---|---|---|
| 사이트 행사 목록 · 상세 · 신청 제출 · 내 신청서 · 본인 취소 · 내 행사 | 행사 등록 · 수정 · 운영 상세 ([event](../event/spec.md)) | `displayStatus` · 잔여석 · 질문 보존 · 행사 행 잠금을 그대로 쓴다 |
| 신청 테이블의 크루 쪽 쓰기 (`INSERT` · 본인 취소) | 운영진 참가 확정 · 참가 불가 · 개별 취소 · 참가자 목록 · 종료 자동 전환 (event-participant, PR #479) | 신청 상태 · 테이블 정의를 함께 쓴다 |
| 신청 접수 · 본인 취소가 내는 도메인 이벤트 | 자동 메일 템플릿 · 발송 · 이력 (event-mail, PR #479) | 이 스펙의 이벤트를 메일 구독자가 받는다 |
| 탈퇴할 때 신청을 정리하는 규칙 (P3) | 모집 마감 · 재모집 · 행사 취소 (event-status, PR #479) | 상태 전환 뒤의 신청 가능 여부 · 본인 취소 가능 여부 |

- 사이트에는 **공개된 행사만** 있다. 등록하면 바로 `PUBLISHED` 라([event](../event/spec.md) Q1·Q2) 모든 행사 행이 공개 대상이다. 취소된 행사도 지난 행사 탭에 보인다 (crew-apply-event §1-1)
- **기존 행사 기록**(날짜만 있는 예전 행사 · 상세 정보가 없는 기록)은 이 API 가 아니다. core-front 의 콘텐츠 데이터(`@studyclub/mock` `events`, 지금 `features/events/server.ts`)를 그대로 쓰고, 화면이 지난 행사 탭에서 이 API 의 지난 행사와 날짜 최신순으로 합친다 (§1 「지난 행사 탭에서 종료·취소 행사와 기존 행사 기록을 날짜 최신순으로 함께 정렬」)

### 인가

- `GET /api/events` · `GET /api/events/{eventId}` 는 **비로그인도 읽는다.** 보안 설정의 공개 GET 목록에 `/api/events` · `/api/events/*` 두 패턴만 올린다. `/api/events/**` 를 열지 않는다 — `…/registrations/me` 까지 열리면 안 된다 ([site-notice](../site-notice/spec.md#인가) 와 같은 방식)
- 공개 GET 이라도 **토큰이 있으면 읽어서** 내 신청 상태를 싣는다. 토큰이 없거나 무효면 오류 없이 비로그인 응답을 준다 ([study](../study/spec.md) `getDetail(studyId, accountId)` — 「비로그인이면 null」과 같은 방식)
- **토큰만 믿지 않는다** (PR #508 리뷰). 발급된 토큰은 탈퇴 뒤에도 만료 전까지 서명 검증을 통과한다([user-leave](../user-leave/spec.md) 「발급된 토큰은 서버가 무효화하지 못한다」). 그래서 공개 GET 은 토큰의 계정 ID 로 **`ACCOUNT` 행을 읽어** 아래처럼 나눈다. 신청 기록은 그 뒤에만 읽는다

| 토큰의 계정 | 응답 | `applyBlockedReason` |
|---|---|---|
| 토큰 없음 · 무효 · **계정 행 없음(탈퇴)** | 비로그인과 같다. `myRegistration = null`, 참여 링크 없음 | `LOGIN_REQUIRED` |
| 계정 있음 · 온보딩 전 | 공개 정보만. `myRegistration = null` | `ONBOARDING_REQUIRED` |
| 계정 있음 · 온보딩 완료 | 내 신청 정보 · (확정된 온라인 신청자면) 참여 링크 | 판정대로 |

- 신청 · 내 신청서 · 본인 취소 · 내 행사는 `@RequireOnboarding`. 토큰이 없으면 401, 온보딩 전이면 403 `ONBOARDING_REQUIRED` ([user-onboarding 「회원 전용 API 공통 규칙」](../user-onboarding/spec.md)). 온보딩은 약관 · 개인정보 동의 단계라 그 전 계정의 신청을 받지 않는다
- 본인 것만 다룬다: 내 신청서 · 본인 취소 · 내 행사는 경로에 신청 ID 를 받지 않고 **토큰의 계정**으로 찾는다. 다른 사람 신청을 가리킬 방법이 없다 (crew-apply-event §3 「본인 신청 조회·취소 권한을 서버에서 검증」)
- 온라인 참여 링크는 **그 행사에 참가 확정된 온라인 신청자에게만** 응답에 싣는다 (§4 「참가가 확정된 온라인 신청자만 온라인 참여 링크를 볼 수 있음」). 공개 상세에는 링크가 있는지조차 싣지 않는다 (아래 「행사 상세」)

### 표시 상태와 목록 묶음

`displayStatus` 는 [event 「상태」](../event/spec.md#상태-저장-상태와-표시-상태를-나눈다) 의 값 · 순서 · 메서드 `ClubEvent.displayStatus(now, seatCounts)` 를 그대로 쓴다. 신청 수는 [event](../event/spec.md) 의 운영 화면과 **같은 포트 메서드**(`ClubEventRegistrationPort.countActiveSeats*`)로 센다 — 같은 판정을 쓰는 화면이 같은 재료를 쓴다 ([판정은 서버가 내려준다](../../docs/backend-development-guide/api/endpoint-convention.md#판정은-서버가-내려준다)).

| `displayStatus` | 사이트 칩 | `listGroup` |
|---|---|---|
| `RECRUITING` | 모집 중 | `UPCOMING` |
| `FULL` | 정원 마감 | `UPCOMING` |
| `RECRUITMENT_CLOSED` | 모집 마감 | `UPCOMING` |
| `ENDED` | 종료 | `PAST` |
| `CANCELLED` | 행사 취소 | `PAST` |

- `listGroup` 은 목록의 탭(예정된 행사 · 지난 행사)이다. 계산: `ClubEvent.listGroup(now, counts)` (제안) = `displayStatus ∈ {ENDED, CANCELLED}` 면 `PAST`. 화면이 `displayStatus` 로 다시 나누지 않아도 되게 응답에 싣는다 (§1-1 「모집 중·모집 마감·정원 마감은 예정된 행사, 종료·행사 취소는 지난 행사로 분류」)
- 종료 시각이 없는 행사가 행사 기준 시간대에서 시작일이 지나면 `ENDED` 가 되는 규칙은 `effectiveEndsAt` 이 이미 담고 있다 (§1-1)

### 신청 상태

[event-participant](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/479) (PR #479) 와 같은 네 값을 쓴다.

| `STATUS` | 사이트 문구 | 자리 | 이 스펙에서 생기는 경우 |
|---|---|---|---|
| `PENDING` | 확인 대기 | 차지 | 운영진 확인 방식(`REVIEW`) 행사에 신청 |
| `CONFIRMED` | 참가 확정 | 차지 | 자동 확정(`AUTO`) 행사에 신청 |
| `DECLINED` | 참가 불가 | 반환 | (운영진 처리 · 종료 자동 전환 — 이 스펙이 아니다) |
| `CANCELLED` | 신청 취소 | 반환 | 본인 취소(`CANCEL_REASON = SELF_CANCELLED`) · 탈퇴(`ACCOUNT_DELETED`) |

- 유효 인원(자리 차지) = `PENDING` + `CONFIRMED` ([event 「정원과 잔여석」](../event/spec.md#정원과-잔여석), §5 「확인 대기도 정원에 포함」)
- `DECLINED` · `CANCELLED` 는 끝 상태다. 취소한 크루가 다시 신청하면 **새 행**이 생긴다 (§3 「취소 후에는 모집 중이면 재신청 가능」)
- 행사 종료 뒤 남은 `PENDING` 은 1분 주기 서버 작업이 `DECLINED` 로 바꾼다 (P2 결정, event-participant). 그 사이 잠시 확인 대기로 보일 수 있다 (§4). 이 스펙의 조회는 상태를 바꾸지 않는다

### 신청할 수 있나: `canApply` · `applyBlockedReason`

상세와 신청 제출이 **같은 판정 한 곳**을 쓴다. 계산: `ClubEventApplication.blockedReason(event, now, counts, applicant, myHistory)` (제안, 도메인 서비스 — 행사 · 계정 · 신청 이력 세 애그리거트를 함께 보므로 엔티티 하나에 두지 않는다). 상세는 그 결과를 `applyBlockedReason` 으로 싣고, 신청 제출은 같은 값으로 거절한다.

위에서부터 먼저 맞는 것 하나를 준다 (프로토 `transition` APPLY 의 검사 순서와 같다).

| # | `applyBlockedReason` | 조건 | 상세 화면 | 신청 제출이 받는 오류 |
|---|---|---|---|---|
| 1 | `LOGIN_REQUIRED` | 토큰 없음 | 신청 버튼 → 로그인 | 401 `UNAUTHORIZED` (`@RequireOnboarding`) |
| 2 | `ONBOARDING_REQUIRED` | 온보딩 전 계정 | 신청 버튼 → 온보딩 | 403 `ONBOARDING_REQUIRED` |
| 3 | `EVENT_CANCELLED` | `STATUS = CANCELLED` | 신청 영역 숨김 | 409 `EVENT_CANCELLED` |
| 4 | `EVENT_ENDED` | `now ≥ effectiveEndsAt` | 신청 영역 숨김 | 409 `EVENT_ENDED` |
| 5 | `RECRUITMENT_CLOSED` | `STATUS = CLOSED` · `now ≥ DEADLINE_AT` · `now ≥ STARTS_AT` 중 하나 | 「모집이 마감되었습니다」 | 409 `EVENT_REGISTRATION_CLOSED` (새 코드) |
| 6 | `ACCOUNT_EMAIL_INVALID` | 계정 이메일이 비었거나 형식이 틀림 | 「계정 이메일을 확인해 주세요」 | 409 `EVENT_APPLICANT_EMAIL_INVALID` (새 코드) |
| 7 | `ALREADY_REGISTERED` | 이 행사에 내 `PENDING` · `CONFIRMED` 신청이 있음 | 내 신청 내역 표시 | 409 `EVENT_ALREADY_REGISTERED` (새 코드) |
| 8 | `DECLINED_BEFORE` | 이 행사에 내 `DECLINED` 신청이 있음 | 「참가 불가 처리된 행사는 다시 신청할 수 없습니다」 | 409 `EVENT_REGISTRATION_DECLINED` (새 코드) |
| 9 | `FULL` | 모든 참여 방식의 잔여석 0 | 「정원이 마감되었습니다」 | 409 `EVENT_CHANNEL_FULL` (고른 방식이 찼을 때) |
| — | `null` | 그 밖 | 신청 버튼 | — |

- `canApply` = `applyBlockedReason == null` (편의 필드. 화면은 둘 중 하나만 봐도 된다)
- 3~5 는 `displayStatus` 와 같은 재료로 판정한다. `FULL` 은 표시 상태에서 모집 마감보다 뒤라 9 로 둔다
- 9 는 **행사 전체**가 찼을 때다. 한 방식만 찼으면 `null` 이고 화면은 `seats[].remaining = 0` 인 방식을 고르지 못하게 그린다. 신청 제출은 고른 방식이 찼으면 409 `EVENT_CHANNEL_FULL`
- 6 의 형식 검사는 프로토 APPLY 와 같은 식(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)이다. 백엔드에는 아직 공용 이메일 형식 검사가 없어 새로 둔다 (제안: `common` 의 `EmailFormat`). 로그인 제공자가 확인한 이메일만 계정이 되므로(user-onboarding) 실제로 걸릴 일은 드물다. 예시 이메일로 대체하지 않는다 (§5)
- 7 · 8 은 [event-participant 「데이터 모델 제안」](https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/479) 의 「같은 계정의 `PENDING` · `CONFIRMED` · `DECLINED` 행이 있으면 막는다」와 같다. 운영진 개별 취소(`ADMIN_CANCELLED`) · 본인 취소된 신청만 있으면 다시 신청할 수 있다 (§3 「취소 후에는 모집 중이면 재신청 가능」 · 「참가 불가 처리 후 재신청 제한」)

### 본인 취소할 수 있나: `canCancel` · `cancelBlockedReason`

계산: `ClubEventRegistration.selfCancelBlockedReason(event, now)` (제안). 상세의 `myRegistration` 과 내 신청서 응답이 이 값을 싣고, 본인 취소가 같은 값으로 거절한다. 본인 취소는 **화면이 보고 있던 신청 번호**(`registrationId`)의 신청만 바꾼다 (아래 「본인 취소」).

| `cancelBlockedReason` | 조건 | 화면 |
|---|---|---|
| `NOT_ACTIVE` | 신청이 `PENDING` · `CONFIRMED` 가 아님 (참가 불가 · 이미 취소 · 행사 취소로 취소됨) | 취소 버튼 없음 |
| `DEADLINE_PASSED` | `now ≥ DEADLINE_AT` | 「신청 마감 후에는 운영진에게 문의해 주세요」 (§4) |
| `null` | 그 밖 | 신청 취소 버튼 + 확인 창 |

- **모집 마감(`STATUS = CLOSED`)은 본인 취소를 막지 않는다.** 설정된 신청 마감 시각 전이면 취소할 수 있다 (S3 결정, §4 「운영진이 모집을 먼저 닫아도 설정된 신청 마감 시각 전까지 본인이 취소할 수 있음」)
- 행사 시작 · 종료는 따로 보지 않는다. 마감은 시작보다 앞이거나 같아서(`DEADLINE_AT ≤ STARTS_AT`, [event](../event/spec.md) 등록 검증) 시작한 행사는 이미 `DEADLINE_PASSED` 다
- 행사 취소는 그 행사의 유효 신청을 모두 `CANCELLED` 로 바꾸므로(event-status) 취소된 행사의 신청은 `NOT_ACTIVE` 다

### 같은 행사 · 같은 계정에 쓰는 요청의 처리 순서

[event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) 를 따른다: 행사 행을 쓰기 잠금(`SELECT … FOR UPDATE`)으로 잡은 **뒤에** 행사 값과 신청 수를 읽는다.

여기에 **회원 탈퇴와의 순서**를 더한다 (PR #479 리뷰 「탈퇴와 메일 예약의 동시 처리」, P3 결정). 탈퇴는 `ACCOUNT` 행 잠금이 첫 조회라서([user-leave](../user-leave/spec.md)) 두 잠금이 엇갈리면 교착이 생긴다. 잠금은 언제나 **`ACCOUNT` → `CLUB_EVENT`** 순서로 잡는다.

| 요청 | 1 | 2 | 그 뒤 |
|---|---|---|---|
| 신청 제출 (이 스펙) | 요청자 `ACCOUNT` 쓰기 잠금 | 그 행사 `CLUB_EVENT` 쓰기 잠금 | 행사 값 · 신청 수 · 내 신청 이력을 읽고 판정 |
| 본인 취소 (이 스펙) | — | 그 행사 `CLUB_EVENT` 쓰기 잠금 | 내 유효 신청을 조건부 갱신 |
| 회원 탈퇴 (이 스펙이 user-leave 에 더하는 단계) | 탈퇴 계정 `ACCOUNT` 쓰기 잠금 (기존) | 그 계정 신청이 걸린 모든 `CLUB_EVENT` 를 ID 오름차순으로 쓰기 잠금 | 아래 「탈퇴할 때」 |
| 행사 수정 · 상태 전환 · 운영진 참가 처리 · 종료 자동 전환 · 메일 예약 (event · PR #479) | — | 그 행사 `CLUB_EVENT` 쓰기 잠금 | `ACCOUNT` 는 **잠그지 않고** 읽는다. 없으면(탈퇴) 그 사람 메일은 만들지 않는다 |

- 신청 제출이 행사보다 계정을 먼저 잠그는 이유: 탈퇴는 「그 계정의 신청이 걸린 행사」를 계정 잠금 뒤에 고른다. 신청 제출이 같은 계정 잠금을 먼저 잡아야, 탈퇴가 행사 목록을 고른 뒤에 새 신청이 생기지 않는다. 잠금 순서가 탈퇴와 같아 교착도 생기지 않는다
- 이것은 [event](../event/spec.md) 의 「트랜잭션의 첫 조회로 `CLUB_EVENT` 행」 규칙의 예외다. 그 규칙의 목적(잠금 전에 행사 · 신청을 일반 `SELECT` 로 읽지 않는다)은 그대로 지킨다 — 계정 잠금은 행사 · 신청을 읽지 않는다. event 스펙의 잠금 표에 「신청 제출: `ACCOUNT` → `CLUB_EVENT`」 · 「회원 탈퇴」 행을 더한다 (R1 결정 — event 스펙 담당(효승님)에게 공유해 그 스펙에도 반영)
- 본인 취소는 계정을 잠그지 않는다. 탈퇴와 겹쳐도 둘 다 같은 신청을 `WHERE STATUS IN ('PENDING','CONFIRMED')` 조건부 갱신으로 바꾸므로 한쪽만 바꾼다
- 신청 제출 · 본인 취소 트랜잭션은 `READ_COMMITTED` 다. 신청 제출은 계정 잠금 뒤 같은 키의 신청을 일반 조회로 찾는데, REPEATABLE READ 면 그 조회가 읽기 시점을 고정해 행사 잠금 뒤에 센 신청 수가 앞 요청의 커밋을 못 본다 (스터디 신청 제출과 같은 이유)
- 잠금은 짧게 끝낸다. 같은 트랜잭션에서는 `NOTIFICATION` 아웃박스 행 저장(`BEFORE_COMMIT`)까지만 하고 실제 발송은 커밋 뒤 폴러가 맡는다 ([event](../event/spec.md))

겹친 요청의 결과:

| 겹친 요청 | 신청 제출이 먼저 | 다른 쪽이 먼저 |
|---|---|---|
| 마지막 자리 두 사람 | 먼저 잠근 사람이 자리를 차지한다 | 나중 사람은 잠금 뒤 다시 세어 409 `EVENT_CHANNEL_FULL` |
| 같은 사람의 두 탭 · 더블 클릭 | 첫 요청이 접수된다 | 두 번째는 계정 잠금 뒤 7 에서 409 `EVENT_ALREADY_REGISTERED` (화면은 내 신청을 다시 읽는다) |
| 신청 ↔ 정원 축소 · 방식 제거 · `REVIEW → AUTO` | [event 「같은 행사에 쓰는 요청의 처리 순서」](../event/spec.md#같은-행사에-쓰는-요청의-처리-순서) 표와 같다 | 같다 |
| 신청 ↔ 모집 마감 · 행사 취소 | 신청이 접수된다. 행사 취소면 그 신청도 함께 취소된다 (event-status) | 신청은 잠금 뒤 바뀐 상태를 읽고 409 `EVENT_REGISTRATION_CLOSED` · `EVENT_CANCELLED` |
| 신청 ↔ 탈퇴 (같은 계정) | 신청이 접수된 뒤 탈퇴가 그 신청까지 `ACCOUNT_DELETED` 로 취소한다 | 신청은 계정 잠금 뒤 계정이 없어 401 `UNAUTHORIZED` |
| 같은 사람의 신청 재시도 (응답을 못 받음) ↔ 다른 탭의 취소 | 첫 요청이 접수된다. 재시도는 같은 `Idempotency-Key` 라 계정 잠금 뒤 그 신청을 그대로 돌려준다 — 다른 탭에서 취소했어도 새 신청을 만들지 않는다 (PR #508 리뷰) | — |
| 예전 탭의 취소 ↔ 다른 탭에서 취소 뒤 재신청 | 예전 탭은 자기가 보던 `registrationId` 를 보낸다. 그 신청은 이미 `CANCELLED` 라 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED`. 새 신청은 건드리지 않는다 (PR #508 리뷰) | — |
| 본인 취소 ↔ 운영진 개별 취소 · 참가 불가 | 본인 취소가 반영된다. 운영진 쪽은 409 (event-participant `EVENT_REGISTRATION_STATUS_NOT_ALLOWED`) | 본인 취소는 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED`. 화면은 내 신청을 다시 읽는다 |

### 신청 질문과 질문 버전

- 신청은 **그 순간의 현재 질문**에 답한다. 질문 · 답의 사본을 신청 행에 함께 저장한다. 이후 캡틴이 질문을 고쳐도 기존 신청은 사본을 읽는다 ([event 「신청 질문의 보존」](../event/spec.md#신청-질문의-보존), §5)
- **질문 버전 `questionVersion`**: 현재 질문 목록의 지문. 계산: `ClubEvent.questionVersion()` (제안) = 질문을 `SORT_ORDER` 순서로 `[questionId, label, type, required, options]` 배열로 만든 정규 JSON 의 SHA-256 16진수 (프로토 `eventQuestionVersion` 과 같은 재료). 질문이 없으면 `[]` 의 지문
- 상세가 `questions` 와 함께 `questionVersion` 을 주고, 신청 제출이 그 값을 그대로 돌려보낸다. 잠금 뒤 다시 계산한 값과 다르면 409 `EVENT_QUESTIONS_CHANGED` (새 코드)
- 화면은 409 를 받으면 상세를 다시 읽어 **최신 질문**을 보여 주고, **바뀌지 않은 질문의 답만** 남긴다 (§5 「작성 중 질문이 변경되면 최신 질문을 확인하도록 안내. 바뀌지 않은 질문의 답변만 유지하고 이전 질문으로 제출되는 요청은 막음」, 프로토 `answersForUnchangedQuestions` — 질문 하나하나를 `[questionId, label, type, required, options]` 로 비교). 이 비교는 화면의 일이다. 서버는 이전 질문을 기억하지 않는다
- 저장 칸을 새로 두지 않는다. 행사 수정이 질문을 바꾸면 지문이 저절로 바뀌고, 제목 · 일정만 고치면 그대로다. 그래서 질문과 상관없는 수정 때문에 크루의 신청이 막히지 않는다 ([event](../event/spec.md) 의 행사 `version` 과는 다른 값)

### 시각과 시간대

- 요청 · 응답 시각은 모두 UTC ISO 8601 ([event 「시각과 시간대」](../event/spec.md#시각과-시간대))
- 상세의 시간대 선택(로그인하면 프로필 시간대를 기본으로, 고른 시간대로 시작 · 종료 · 마감 변환, 서머타임 반영 약어)은 **화면이 한다.** 시간대를 바꿔도 프로필은 바꾸지 않는다 (§2-2). 서버는 `timeZone`(행사 기준) 과 UTC 만 준다
- 신청 행에는 **신청 당시 신청자 프로필 시간대**를 사본으로 둔다(`APPLICANT_TIME_ZONE` = 그 순간의 `ACCOUNT.TIME_ZONE`). 개인별 메일 일정은 메일을 예약할 때 「현재 프로필 → 신청 당시 시간대 → 행사 시간대」 순서로 고른다 (M3 결정, §5). 메일 쪽 규칙은 event-mail 이 정한다
- 화면이 보낸 표시 시간대를 저장하지 않는다. 프로토 APPLY 는 `applicant.timeZone` 에 화면의 표시 시간대를 넣지만, 이 값은 「신청 당시 회원 **프로필** 시간대」(`@studyclub/types` `EventRegistration.timeZone` 주석)라 서버가 계정에서 읽는다 (아래 「근거와 PRD·프로토의 차이」)

### 개인정보

- 닉네임 · 이메일을 신청 행에 복사하지 않는다. 필요할 때 `ACCOUNT` 에서 읽는다 (P3 결정, event-participant 「연락처를 신청 행에 두지 않는 이유」). 신청서 화면은 「로그인 계정의 닉네임과 이메일이 함께 전달된다」고 안내만 하고 입력란을 두지 않는다 (§5)
- 사이트 응답에는 **다른 사람의 신청 정보가 없다.** 상세의 잔여석 · 정원만 신청 수에서 계산해 싣는다
- 온라인 링크(`CLUB_EVENT_CHANNEL.ONLINE_URL`)는 위 「인가」대로 확정된 온라인 신청자에게만 싣고, 서버 로그에 남기지 않는다 ([event 「개인정보·민감 정보」](../event/spec.md#개인정보민감-정보))
- 답변은 서식 없는 글로 저장하고 HTML 로 해석하지 않는다

### 도메인 이벤트와 자동 메일

서비스는 메일을 직접 보내지 않는다. 트랜잭션 안에서 도메인 이벤트를 내고, event-mail 의 `BEFORE_COMMIT` 구독자가 신청자에게 갈 `NOTIFICATION` 행을 **같은 트랜잭션에** 만든다 ([domain-events](../domain-events/spec.md), [event 「확정 방식 전환」](../event/spec.md#확정-방식-전환-수정의-연관-효과) 과 같은 방식).

| 언제 | 이벤트 (`com.studyclub.domain.event`) | 자동 메일 조건 (event-mail) |
|---|---|---|
| 신청 접수 | **`ClubEventRegistrationSubmittedEvent(EventMeta meta, Long clubEventId, Long registrationId, ClubEventRegistrationStatus status)`** — 이 스펙이 새로 둔다. 이름 `club_event.registration_submitted`. `status` 는 `PENDING` 또는 `CONFIRMED` | `PENDING` → `EVENT_REGISTRATION_PENDING`, `CONFIRMED` → `EVENT_REGISTRATION_CONFIRMED` |
| 본인 취소 | `ClubEventRegistrationsCancelledEvent(meta, clubEventId, registrationIds, cause = SELF)` — PR #479(event-participant)가 제안한 이벤트를 그대로 쓴다 | `EVENT_REGISTRATION_CANCELLED` |
| 탈퇴로 취소 | **내지 않는다** | 없음 (P3 「자동 메일은 보내지 않는다」) |

- 페이로드는 ID 와 상태뿐이다. 연락처 · 답변은 싣지 않는다 (구독자가 잠금 아래에서 읽는다)
- **템플릿이 없으면 신청 · 취소는 그대로 접수한다** (M2 결정, §5 「자동 템플릿 누락은 신청·취소를 막지 않으며 운영자가 누락을 확인. 복구 후 자동 소급 발송 없음」). 구독자는 그 메일만 건너뛰고 누락을 운영자가 볼 수 있게 남긴다(방식은 event-mail). 메일 예약 행 저장이 DB 오류로 실패하면 신청 · 취소 전체를 롤백한다
- 신청 접수 메일을 만들 이벤트를 신청 쪽이 정하는 이유: event-mail 이 「신청 접수 이벤트는 ST-038 이 정한다」고 남겼다 (PR #479 설명)

---

## 행사 목록

### 기본 정보

- **Method**: GET
- **Path**: `/api/events`
- **인증**: 불필요. 토큰이 있으면 내 신청 상태를 싣는다
- **설명**: 공개된 모든 행사(종료 · 취소 포함). 예정된 행사가 먼저, 그다음 지난 행사. 화면은 `listGroup` 으로 두 탭을 나누고 탭마다 개수를 센다 (§1)

### Path Parameters

없음

### Query Parameters

없음

- 페이지를 나누지 않는다. 행사는 운영진이 하나씩 등록하는 수(한 해 수십 건)라 한 번에 준다. 화면은 탭마다 개수를 보여 줘야 해서(§1 「예정된 행사·지난 행사 탭과 각 행사 수」) 전체가 필요하다 (R2 결정. 기록이 많이 쌓이면 페이지 나누기 · 더 보기를 다시 검토)
- 정렬: `listGroup = UPCOMING` 은 `STARTS_AT ASC, ID ASC`(시작이 가까운 순), `PAST` 는 `STARTS_AT DESC, ID DESC`(§1 「날짜 최신순」). 응답은 UPCOMING 묶음 다음 PAST 묶음이다 (R2 결정)

### Request Body

없음

### Response — 200

```json
[
  {
    "eventId": 7,
    "title": "연말 네트워킹 밋업",
    "summary": "한 해를 마무리하며 크루끼리 만나요",
    "startsAt": "2026-12-05T10:00:00Z",
    "endsAt": "2026-12-05T13:00:00Z",
    "effectiveEndsAt": "2026-12-05T13:00:00Z",
    "timeZone": "Asia/Seoul",
    "format": "HYBRID",
    "displayStatus": "RECRUITING",
    "listGroup": "UPCOMING",
    "myRegistration": { "status": "PENDING", "channel": "OFFLINE" }
  },
  {
    "eventId": 5,
    "title": "가을 오프라인 모각코",
    "summary": "토요일 오후, 같이 코딩해요",
    "startsAt": "2026-10-11T05:00:00Z",
    "endsAt": null,
    "effectiveEndsAt": "2026-10-11T15:00:00Z",
    "timeZone": "Asia/Seoul",
    "format": "OFFLINE",
    "displayStatus": "ENDED",
    "listGroup": "PAST",
    "myRegistration": null
  }
]
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| [].eventId | Long | N | | CLUB_EVENT.ID |
| [].title | String | N | | CLUB_EVENT.TITLE |
| [].summary | String | N | 한 줄 소개 | CLUB_EVENT.SUMMARY |
| [].startsAt | String | N | UTC | CLUB_EVENT.STARTS_AT |
| [].endsAt | String | Y | 미입력이면 null — 화면은 시작 시각만 표시 (§2-2) | CLUB_EVENT.ENDS_AT |
| [].effectiveEndsAt | String | N | 종료 판정 시각 | 계산: `ClubEvent.effectiveEndsAt()` |
| [].timeZone | String | N | 행사 기준 IANA 시간대 | CLUB_EVENT.TIME_ZONE |
| [].format | String | N | `ONLINE` · `OFFLINE` · `HYBRID` — 카드의 참여 형태 (§1-1) | 계산: `ClubEvent.format()` |
| [].displayStatus | String | N | 표시 상태 | 계산: `ClubEvent.displayStatus(now, counts)`. 재료: `countActiveSeatsByEventIds` (전체 행사 ID 묶음에 GROUP BY 한 번) |
| [].listGroup | String | N | `UPCOMING` · `PAST` | 계산: `ClubEvent.listGroup(now, counts)` |
| [].myRegistration | Object | Y | 이 행사에서 **내 최신 신청** 한 건. 비로그인 · 온보딩 전 · 신청 없음이면 null (§1-1 「현재 크루 신청 상태」) | CLUB_EVENT_REGISTRATION (`ACCOUNT_ID = 나`, 행사별 `CREATED_AT` 최신) |
| [].myRegistration.status | String | N | `PENDING` · `CONFIRMED` · `DECLINED` · `CANCELLED` | CLUB_EVENT_REGISTRATION.STATUS |
| [].myRegistration.channel | String | N | `ONLINE` · `OFFLINE` | CLUB_EVENT_REGISTRATION.CHANNEL |

- 행사가 없으면 `[]`
- 「저장한 행사」(§1-1 「저장한 행사는 목록과 상세에서 바로 확인」)는 캡틴이 등록 즉시 공개하므로 따로 처리할 것이 없다

### Error Responses

없음 (공개 조회. 토큰이 무효해도 비로그인 응답을 준다)

### 프론트엔드 사용처

- `frontend/apps/core-front/src/features/events/server.ts` `getEvents()`: 지금은 `@studyclub/mock` `events`. 이 API 와 기존 행사 기록을 합친다
- `frontend/apps/core-front/src/lib/features.ts`: `TODO(api): GET /api/events` 가 가리키는 기능 스위치
- 근거 시안: `frontend/apps/playground/src/proto/events/EventGuestList.tsx` (`latestRegistrationsByEvent` · `eventStatus` · 탭 묶음)

---

## 행사 상세

### 기본 정보

- **Method**: GET
- **Path**: `/api/events/{eventId}`
- **인증**: 불필요. 토큰이 있으면 내 신청 요약과 본인 기준 신청 가능 여부를 싣는다
- **설명**: 상세 화면 한 장에 필요한 값 전부 — 행사 정보 · 모집 상세 · 일정과 장소 · 방식별 잔여석 · 확정 방식 · 현재 질문과 질문 버전 · 신청 가능 여부 · 내 신청 요약 · (확정된 온라인 신청자에게만) 참여 링크

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

로그인한 크루가 온라인으로 참가 확정된 경우:

```json
{
  "eventId": 7,
  "title": "연말 네트워킹 밋업",
  "summary": "한 해를 마무리하며 크루끼리 만나요",
  "description": "행사 소개, 참가 조건, 추가 절차…",
  "timeZone": "Asia/Seoul",
  "startsAt": "2026-12-05T10:00:00Z",
  "endsAt": "2026-12-05T13:00:00Z",
  "effectiveEndsAt": "2026-12-05T13:00:00Z",
  "deadlineAt": "2026-12-03T14:59:00Z",
  "format": "HYBRID",
  "offline": { "location": "서울 강남구 ○○빌딩 5층" },
  "online": {},
  "confirmation": "REVIEW",
  "displayStatus": "RECRUITING",
  "seats": [
    { "channel": "ONLINE", "capacity": 100, "remaining": 56 },
    { "channel": "OFFLINE", "capacity": 40, "remaining": 0 }
  ],
  "questions": [
    { "questionId": "q_7f3a", "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [] }
  ],
  "questionVersion": "9c1d4e…",
  "canApply": false,
  "applyBlockedReason": "ALREADY_REGISTERED",
  "myRegistration": {
    "registrationId": 312,
    "status": "CONFIRMED",
    "channel": "ONLINE",
    "createdAt": "2026-11-20T03:12:00Z",
    "canCancel": true,
    "cancelBlockedReason": null,
    "onlineLinkVisible": true,
    "onlineUrl": "https://meet.example.com/abc"
  }
}
```

비로그인이면 `canApply = false`, `applyBlockedReason = "LOGIN_REQUIRED"`, `myRegistration = null` 이다. 나머지는 같다.

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| eventId | Long | N | | CLUB_EVENT.ID |
| title | String | N | | CLUB_EVENT.TITLE |
| summary | String | N | | CLUB_EVENT.SUMMARY |
| description | String | N | 모집 상세. 서식 없는 글 (§2-1) | CLUB_EVENT.DESCRIPTION |
| timeZone | String | N | 행사 기준 시간대 | CLUB_EVENT.TIME_ZONE |
| startsAt | String | N | UTC | CLUB_EVENT.STARTS_AT |
| endsAt | String | Y | 미입력이면 null | CLUB_EVENT.ENDS_AT |
| effectiveEndsAt | String | N | | 계산: `ClubEvent.effectiveEndsAt()` |
| deadlineAt | String | N | 신청 마감 · 본인 취소 마감 | CLUB_EVENT.DEADLINE_AT |
| format | String | N | | 계산: `ClubEvent.format()` |
| offline | Object | Y | 오프라인 방식이 없으면 null | CLUB_EVENT_CHANNEL (OFFLINE) |
| offline.location | String | N | 오프라인 장소 — 공개 (§2-2) | CLUB_EVENT_CHANNEL.LOCATION |
| online | Object | Y | 온라인 방식이 없으면 null. **링크는 싣지 않는다** — 빈 객체로 「온라인으로도 진행한다」만 알린다 | CLUB_EVENT_CHANNEL (ONLINE) |
| confirmation | String | N | `AUTO` · `REVIEW`. 화면의 확정 방식 설명 (§3 · §4 「운영진 확인 방식의 안내는 참가 확정을 보장하지 않고…」) | CLUB_EVENT.CONFIRMATION |
| displayStatus | String | N | | 계산: `ClubEvent.displayStatus(now, counts)` |
| seats | Array | N | 참여 방식마다 한 줄, ONLINE · OFFLINE 순 (§3 「참여 방식별 잔여석·정원」) | — |
| seats[].channel | String | N | | CLUB_EVENT_CHANNEL.CHANNEL |
| seats[].capacity | Integer | N | 정원 | CLUB_EVENT_CHANNEL.CAPACITY |
| seats[].remaining | Integer | N | 잔여석. 확인 대기 · 참가 확정 수는 사이트에 내지 않는다 | 계산: `ClubEvent.seatsOf(channel, counts)` — 운영 상세와 같은 메서드 · 같은 포트 |
| questions | Array | N | **현재** 질문 (신청서에 그릴 것). 없으면 `[]` | CLUB_EVENT_QUESTION, SORT_ORDER 순 |
| questions[].questionId | String | N | | CLUB_EVENT_QUESTION.QUESTION_KEY |
| questions[].label | String | N | | CLUB_EVENT_QUESTION.LABEL |
| questions[].type | String | N | `TEXT` · `TEXTAREA` · `RADIO` · `CHECKBOX` | CLUB_EVENT_QUESTION.TYPE |
| questions[].required | Boolean | N | | CLUB_EVENT_QUESTION.REQUIRED |
| questions[].options | String[] | N | TEXT · TEXTAREA 는 `[]` | CLUB_EVENT_QUESTION.OPTIONS |
| questionVersion | String | N | 현재 질문의 지문. 신청 제출에 그대로 보낸다 | 계산: `ClubEvent.questionVersion()` |
| canApply | Boolean | N | 지금 신청할 수 있나 | 계산: `applyBlockedReason == null` |
| applyBlockedReason | String | Y | 위 「신청할 수 있나」 표의 값. 신청할 수 있으면 null | 계산: `ClubEventApplication.blockedReason(…)` |
| myRegistration | Object | Y | 이 행사에서 내 **최신** 신청. 비로그인 · 온보딩 전 · 신청 없음이면 null | CLUB_EVENT_REGISTRATION |
| myRegistration.registrationId | Long | N | | CLUB_EVENT_REGISTRATION.ID |
| myRegistration.status | String | N | | CLUB_EVENT_REGISTRATION.STATUS |
| myRegistration.channel | String | N | | CLUB_EVENT_REGISTRATION.CHANNEL |
| myRegistration.createdAt | String | N | 신청 시각 | CLUB_EVENT_REGISTRATION.CREATED_AT |
| myRegistration.canCancel | Boolean | N | 본인 취소 버튼을 그릴까 | 계산: `cancelBlockedReason == null` |
| myRegistration.cancelBlockedReason | String | Y | `NOT_ACTIVE` · `DEADLINE_PASSED` · null | 계산: `ClubEventRegistration.selfCancelBlockedReason(event, now)` |
| myRegistration.onlineLinkVisible | Boolean | N | 참여 링크 자리를 그릴까. `STATUS = CONFIRMED` ∧ `CHANNEL = ONLINE` ∧ 행사 취소 아님. 행사 종료 뒤에도 보인다 (R5 결정). 비로그인 · 탈퇴 계정은 `myRegistration` 자체가 null 이라 링크가 나가지 않는다 | 계산: `ClubEventRegistration.canSeeOnlineLink(event)` (제안) |
| myRegistration.onlineUrl | String | Y | `onlineLinkVisible = true` 일 때만 값이 있다. 캡틴이 아직 링크를 넣지 않았으면 null — 화면은 「추후 안내」 (§3 데이터 규칙 「링크 미입력 시 추후 안내 문구」) | CLUB_EVENT_CHANNEL.ONLINE_URL |

- 「신청서 보기」(§4)의 질문 · 답은 이 응답에 싣지 않는다. 상세를 열 때마다 답변을 실어 보내지 않도록 [내 신청서](#내-신청서) 로 따로 읽는다
- 「참가 불가 처리 후 재신청 제한」 안내는 최신 신청이 `DECLINED` 면 `applyBlockedReason = DECLINED_BEFORE` 로 함께 온다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `eventId` 가 숫자가 아님 |
| 404 | NOT_FOUND | 없는 행사 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/events/[id]/page.tsx` · `features/events/server.ts` `getEvent()`
- 근거 시안: `frontend/apps/playground/src/proto/events/EventGuestDetail.tsx` (`canApply` 식 · `seatInfo` · 확정 링크 표시 · 취소 버튼 조건 · 신청서 보기)

---

## 신청 제출

### 기본 정보

- **Method**: POST
- **Path**: `/api/events/{eventId}/registrations`
- **인증**: 필요 (`@RequireOnboarding`)
- **설명**: 고른 참여 방식과 질문 답으로 신청한다. 자동 확정 행사면 바로 `CONFIRMED`, 운영진 확인 행사면 `PENDING` (§4). 신청 당시 질문 · 답 사본과 프로필 시간대 사본을 함께 저장한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

없음

### Request Headers

| 헤더 | 필수 | 설명 |
|---|---|---|
| Idempotency-Key | Y | 화면이 **신청 시도마다 새로 만드는 UUID v4**. 같은 시도의 재시도(네트워크 오류 · 타임아웃)는 같은 키를 보낸다. 사용자가 취소 뒤 **의도적으로 다시 신청**할 때만 새 키를 만든다. 없거나 UUID 형식이 아니면 400 `INVALID_INPUT` (`Idempotency-Key`) |

- PR #508 리뷰: 중복 검사(처리 순서 7)는 유효 신청이 있을 때만 막는다. 「신청 저장 성공 → 응답을 못 받음 → 다른 탭에서 취소 → 원래 요청 재시도」 순서면 취소한 신청이 다시 접수되고 메일도 생긴다. 그래서 키로 재시도를 알아본다
- 서버는 계정 잠금(처리 순서 1) 뒤 **같은 계정 · 같은 키**의 신청이 있으면 새로 만들지 않고 그 신청의 지금 상태를 돌려준다(201, 같은 `Location`). 그 사이 취소됐으면 취소된 상태 그대로다. 행사 상태 · 정원 · 질문 버전은 다시 보지 않는다 — 이미 처리된 요청이다
- 같은 키가 **다른 행사** 경로로 오면 400 `INVALID_INPUT` (`Idempotency-Key`). 다른 행사의 신청을 돌려주지 않는다
- 키는 신청 행에 함께 저장하고(`SUBMIT_IDEMPOTENCY_KEY`) `UNIQUE(ACCOUNT_ID, SUBMIT_IDEMPOTENCY_KEY)` 로 지킨다 ([event](../event/spec.md) 등록의 `CREATE_IDEMPOTENCY_KEY` 와 같은 방식). 같은 계정의 요청은 계정 잠금으로 한 줄로 서므로 확인 후 삽입이 안전하고, 제약은 마지막 방어선이다
- 400 · 409 로 실패한 요청은 행을 만들지 않으므로 키도 남지 않는다. 같은 키로 고쳐 보내면 새로 처리한다

### Request Body

```json
{
  "channel": "OFFLINE",
  "questionVersion": "9c1d4e…",
  "answers": {
    "q_7f3a": ["연말에 크루들과 한 해 회고를 나누고 싶어요"],
    "q_b210": ["AI", "커리어"]
  }
}
```

| 필드 | 타입 | 필수 | 검증 | 근거 |
|------|------|------|------|------|
| channel | String | Y | `ONLINE` · `OFFLINE`. 이 행사에 있는 방식이어야 한다 (없으면 400) | §5 「참여 방식」 |
| questionVersion | String | Y | 상세에서 받은 값. 잠금 뒤 다시 계산한 값과 다르면 409 `EVENT_QUESTIONS_CHANGED` | §5 「이전 질문으로 제출되는 요청은 막음」 |
| answers | Object | Y | 키 = 현재 질문의 `questionId`, 값 = 문자열 배열. 질문이 없거나 답할 것이 없으면 `{}` | §5 |
| answers.{questionId} | String[] | 질문이 `required` 면 Y | 아래 표 | 같은 곳 |

답의 모양은 질문 타입마다 이렇다 (값은 언제나 배열 — 저장 · 내 신청서 · 운영진 신청서(PR #479)가 같은 모양을 쓴다).

| type | 원소 수 | 원소 | 글자 수 (R3 결정, 스터디 신청과 같다) |
|---|---|---|---|
| TEXT | 0 또는 1 | 앞뒤 공백을 제거한 글 | 1~200자 |
| TEXTAREA | 0 또는 1 | 같은 곳. 줄바꿈 유지 | 1~2,000자 |
| RADIO | 0 또는 1 | 그 질문 `options` 중 하나 | — |
| CHECKBOX | 0 이상 | 그 질문 `options` 중에서, 서로 다르게 | — |

- 필수 질문은 원소가 하나 이상이어야 한다. 공백만 있는 글은 답이 없는 것으로 본다 (프로토 `transition` APPLY 「‘질문’에 답변해 주세요」). 화면과 서버가 같은 기준(앞뒤 공백 제거 뒤 길이 · 장문 줄바꿈 유지)으로 검증한다 (R3)
- 선택 질문은 키를 빼거나 `[]` 를 보낸다. 저장할 때 빈 답은 키째 뺀다
- 현재 질문에 없는 키 · `options` 에 없는 선택지는 400 이다. 질문 버전이 맞는데 이런 값이 오면 화면 오류이므로 409 가 아니라 400 으로 둔다
- 글자 수는 [event](../event/spec.md) 와 같은 UTF-16 단위, 앞뒤 공백을 지운 뒤 센다
- 닉네임 · 이메일 · 시간대는 받지 않는다. 서버가 계정에서 읽는다 (§5 「닉네임·이메일 입력란은 표시하지 않음」)

### 처리 순서

인가(401 · 403)와 본문 모양 검증(400: `channel` 값 · `questionVersion` 누락 · `answers` 형식)을 통과한 뒤 한 트랜잭션에서 아래 순서로 처리한다. 먼저 걸리는 것 하나만 응답한다.

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | 요청자 `ACCOUNT` 행을 쓰기 잠금으로 읽는다 (트랜잭션의 첫 조회). 없으면(탈퇴) | 401 `UNAUTHORIZED` | 「같은 행사 · 같은 계정에 쓰는 요청의 처리 순서」 |
| 1-1 | 같은 계정 · 같은 `Idempotency-Key` 의 신청이 있으면 — 이 행사의 신청이면 그 신청을 201 로 돌려주고 끝. 다른 행사의 신청이면 400 | 400 `INVALID_INPUT` (`Idempotency-Key`) | PR #508 리뷰 |
| 2 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다. 없으면 | 404 `NOT_FOUND` | [event](../event/spec.md) Q8 |
| 3 | `STATUS = CANCELLED` | 409 `EVENT_CANCELLED` | §1-1 |
| 4 | `now ≥ effectiveEndsAt` | 409 `EVENT_ENDED` | §1-1 |
| 5 | `STATUS = CLOSED` · `now ≥ DEADLINE_AT` · `now ≥ STARTS_AT` | 409 `EVENT_REGISTRATION_CLOSED` | §1-1 「모집 중에만 새 신청 가능」, §3 「신청 마감 시각부터 신청 제한」 |
| 6 | 계정 이메일이 비었거나 형식이 틀림 | 409 `EVENT_APPLICANT_EMAIL_INVALID` | §5 |
| 7 | 이 행사에 내 `PENDING` · `CONFIRMED` 신청이 있음 | 409 `EVENT_ALREADY_REGISTERED` | §3 「중복 신청 제한」 |
| 8 | 이 행사에 내 `DECLINED` 신청이 있음 | 409 `EVENT_REGISTRATION_DECLINED` | §3 「참가 불가 처리 후 재신청 제한」 |
| 9 | `channel` 이 이 행사에 없는 방식 | 400 `INVALID_INPUT` (`channel`) | — |
| 10 | 그 방식의 잔여석 0 (잠금 뒤 센 확인 대기 + 참가 확정 ≥ 정원) | 409 `EVENT_CHANNEL_FULL` | §5 「신청 시 선택 방식의 정원 재확인」, [event](../event/spec.md) Q8 |
| 11 | `questionVersion` ≠ 잠금 뒤 계산한 `ClubEvent.questionVersion()` | 409 `EVENT_QUESTIONS_CHANGED` | §5 |
| 12 | 답 검증 (위 표) | 400 `INVALID_INPUT` (`answers.{questionId}`) | §5 「필수 응답 검증」 |
| 13 | 신청 행을 넣는다: `STATUS` = 행사 `CONFIRMATION` 이 `AUTO` 면 `CONFIRMED`, `REVIEW` 면 `PENDING`. 질문 사본 · 답 사본 · `APPLICANT_TIME_ZONE = ACCOUNT.TIME_ZONE` · `SUBMIT_IDEMPOTENCY_KEY` | — | §4 · §5 |
| 13-1 | 계정의 첫 활성화면 기록한다 (`ACCOUNT.ACTIVATED_AT IS NULL` 일 때만 조건부 갱신) | — | 「퍼널·계측」, R4 |
| 14 | `ClubEventRegistrationSubmittedEvent` 를 트랜잭션 안에서 낸다. 13-1 에서 활성화했으면 `AccountActivatedEvent` 도 | — | 「도메인 이벤트와 자동 메일」 |
| 15 | 커밋 직전 `BEFORE_COMMIT` 구독자(event-mail)가 자동 메일 `NOTIFICATION` 행을 같은 트랜잭션에 만든다. 템플릿이 없으면 메일만 건너뛴다(M2). 행 저장 실패는 전체 롤백. 그 다음 커밋 | — | [domain-events](../domain-events/spec.md) |

- 3~8 은 상세의 `applyBlockedReason` 과 **같은 메서드**로 판정한다. 10 은 고른 방식만 본다
- 행사 `VERSION` 은 올리지 않는다. 신청은 신청 행만 바꾼다 ([event 「동시 수정 방지: 버전」](../event/spec.md#동시-수정-방지-버전-q14-결정))
- 잔여석이 0 이 되어 `displayStatus` 가 `FULL` 로 보이는 것은 저장하지 않는다. 요청마다 계산한다 ([event](../event/spec.md) Q11)

### Response — 201

본문은 [내 신청서](#내-신청서) 와 같다 (방금 만든 신청). 헤더 `Location: /api/events/{eventId}/registrations/me`.

### Error Responses

| 상태 | errorCode | 조건 | 화면 (§5 「실패 시 입력값 유지」) |
|------|-----------|------|------|
| 400 | INVALID_INPUT | `Idempotency-Key` 누락 · 형식 오류 · 다른 행사의 키 · 본문 모양 · 처리 순서 9 · 12. 실패한 필드 이름을 `errorMessage` 에 담는다 | 해당 입력란 아래 사유 |
| 401 | UNAUTHORIZED | 토큰 없음 · 계정 없음 | 로그인 |
| 403 | ONBOARDING_REQUIRED | 온보딩 전 | 온보딩 |
| 404 | NOT_FOUND | 없는 행사 | 목록으로 |
| 409 | EVENT_CANCELLED | 취소된 행사 | 상세 다시 읽기 |
| 409 | EVENT_ENDED | 종료된 행사 | 상세 다시 읽기 |
| 409 | EVENT_REGISTRATION_CLOSED | 모집 마감 (수동 마감 · 신청 마감 · 시작) | 「모집이 마감되었습니다」 + 상세 다시 읽기 |
| 409 | EVENT_APPLICANT_EMAIL_INVALID | 계정 이메일 문제 | 「계정 이메일을 확인한 뒤 다시 신청해 주세요」 |
| 409 | EVENT_ALREADY_REGISTERED | 이미 유효 신청이 있음 | 내 신청 내역 다시 읽기 |
| 409 | EVENT_REGISTRATION_DECLINED | 참가 불가 이력 | 「참가 불가 처리된 행사는 다시 신청할 수 없습니다」 |
| 409 | EVENT_CHANNEL_FULL | 고른 방식이 찼음 | 입력 유지, 다른 방식 안내 + 상세 다시 읽기 |
| 409 | EVENT_QUESTIONS_CHANGED | 작성 중 질문이 바뀜 | 최신 질문으로 다시 그리고 바뀌지 않은 질문의 답만 유지 |

### 프론트엔드 사용처

- core-front 행사 상세의 신청 창 (아직 없음)
- 근거 시안: `EventGuestDetail.tsx` 신청 폼 · `model.ts` `transition` APPLY · `normalizeEventAnswers` · `answersForUnchangedQuestions`

---

## 내 신청서

### 기본 정보

- **Method**: GET
- **Path**: `/api/events/{eventId}/registrations/me`
- **인증**: 필요 (`@RequireOnboarding`)
- **설명**: 이 행사에서 **내 최신 신청** 한 건과 신청 당시 질문 · 답 (§4 「신청서 보기」). 지난 신청(취소 뒤 재신청 전의 행)은 사이트에 보이지 않는다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters · Request Body

없음

### Response — 200

```json
{
  "registrationId": 312,
  "eventId": 7,
  "status": "PENDING",
  "channel": "OFFLINE",
  "createdAt": "2026-11-20T03:12:00Z",
  "canCancel": true,
  "cancelBlockedReason": null,
  "questions": [
    { "questionId": "q_7f3a", "label": "참여 동기", "type": "TEXTAREA", "required": true, "options": [], "answer": ["연말에 크루들과 한 해 회고를 나누고 싶어요"] }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| registrationId | Long | N | | CLUB_EVENT_REGISTRATION.ID |
| eventId | Long | N | | CLUB_EVENT_REGISTRATION.CLUB_EVENT_ID |
| status | String | N | | CLUB_EVENT_REGISTRATION.STATUS |
| channel | String | N | | CLUB_EVENT_REGISTRATION.CHANNEL |
| createdAt | String | N | 신청 시각 | CLUB_EVENT_REGISTRATION.CREATED_AT |
| canCancel | Boolean | N | | 계산: `cancelBlockedReason == null` |
| cancelBlockedReason | String | Y | `NOT_ACTIVE` · `DEADLINE_PASSED` · null | 계산: `ClubEventRegistration.selfCancelBlockedReason(event, now)` |
| questions | Array | N | **신청 당시** 질문 사본, 사본 순서대로. 질문이 없던 행사면 `[]` | CLUB_EVENT_REGISTRATION.QUESTIONS_SNAPSHOT |
| questions[].questionId · label · type · required · options | | N | 신청 당시 값 | 같은 곳 |
| questions[].answer | String[] | N | 그 질문의 답. 답하지 않은 선택 질문은 `[]` — 화면은 「답변 없음」 | CLUB_EVENT_REGISTRATION.ANSWERS_SNAPSHOT |

- 답을 질문 안에 넣는 모양은 PR #479 운영진 신청서 조회와 같다. 현재 질문을 조인해 다시 그리지 않는다 ([event](../event/spec.md) 「신청 질문의 보존」)
- 온라인 링크는 싣지 않는다. 링크는 상세의 `myRegistration` 에만 있다

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | ONBOARDING_REQUIRED | 온보딩 전 |
| 404 | NOT_FOUND | 없는 행사 · 이 행사에 내 신청이 없음 (둘을 가르지 않는다) |

### 프론트엔드 사용처

- core-front 행사 상세의 「신청서 보기」 (아직 없음)
- 근거 시안: `EventGuestDetail.tsx` 신청서 목록 (`registration.questions` · `registration.answers`)

---

## 본인 취소

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/events/{eventId}/registrations/me`
- **인증**: 필요 (`@RequireOnboarding`)
- **설명**: 화면이 보고 있던 내 신청(`registrationId`)을 취소한다. **행은 지우지 않고** `STATUS = CANCELLED`, `CANCEL_REASON = SELF_CANCELLED` 로 남긴다 — 「내 참여를 거둔다」는 뜻이라 `DELETE …/me` 로 둔다 (R6 결정, 선례: 발표자 칸 본인 해제 `DELETE …/presenters/{slot}/me`). 자리를 반환하고, 모집 중이면 다시 신청할 수 있다 (§4 「취소 시 자리 반환」)

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| eventId | Long | 행사 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| registrationId | Long | Y | 화면이 보고 있던 신청 번호 (상세의 `myRegistration.registrationId` · 내 신청서의 `registrationId`). 없으면 400 |

- PR #508 리뷰: 「지금 유효한 내 신청」을 찾아 취소하면, 탭 두 개를 연 상태에서 한쪽이 취소 뒤 재신청했을 때 예전 탭의 취소가 **새 신청**까지 취소한다. 그래서 화면이 보던 신청 번호를 받아 **그 신청만** 바꾼다. 이미 취소 · 처리된 신청이면 새 신청은 건드리지 않고 최신 내역을 다시 읽게 한다
- 경로는 R6 결정대로 `/me` 를 유지하고 신청 번호는 쿼리로 받는다. 본인 확인은 경로가 아니라 「그 신청의 `ACCOUNT_ID` = 토큰의 계정 ∧ `CLUB_EVENT_ID` = 경로의 행사」로 한다

### Request Body

없음

### 처리 순서

| # | 단계 | 실패 | 근거 |
|---|---|---|---|
| 1 | `CLUB_EVENT` 행을 쓰기 잠금으로 읽는다. 없으면 | 404 `NOT_FOUND` | [event](../event/spec.md) Q8 |
| 2 | `STATUS = CANCELLED` (행사 취소 — 신청은 이미 함께 취소됐다) | 409 `EVENT_CANCELLED` | event-status |
| 3 | 잠금 뒤 `registrationId` 의 신청을 읽는다. 없거나 · 내 것이 아니거나 · 이 행사의 것이 아니면 | 404 `NOT_FOUND` | 남의 신청이 있는지 알리지 않는다 |
| 4 | 그 신청이 `PENDING` · `CONFIRMED` 가 아님 (다른 탭에서 이미 취소 · 운영진이 먼저 처리) | 409 `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` | PR #479 와 같은 코드. 화면은 최신 내역을 다시 읽는다 |
| 5 | `now ≥ DEADLINE_AT` | 409 `EVENT_SELF_CANCEL_CLOSED` (새 코드) | §4 「신청 마감 시각 이후에는 운영진 문의 안내」, S3 |
| 6 | `ClubEventRegistration.cancelBySelf(now)` — `STATUS = CANCELLED`, `CANCEL_REASON = SELF_CANCELLED`, `STATUS_CHANGED_AT = now`, `STATUS_CHANGED_BY = 나`. 이 신청을 바꾸는 요청(운영진 처리 · 탈퇴 · 행사 취소)은 모두 같은 행사 행 잠금을 잡으므로 4 에서 읽은 상태가 그대로다. 엔티티가 상태를 한 번 더 확인해 아니면 4 와 같은 409 | — | event 「같은 행사에 쓰는 요청의 처리 순서」 |
| 7 | `ClubEventRegistrationsCancelledEvent(cause = SELF)` 를 낸다. `BEFORE_COMMIT` 구독자가 취소 메일 행을 만든다 (템플릿 없으면 건너뜀, M2). 분석 구독자는 커밋 뒤 「신청 취소 완료」를 보낸다 | — | 「도메인 이벤트와 자동 메일」 · 「퍼널·계측」 |

- 모집 마감(`STATUS = CLOSED`)은 보지 않는다 (S3)
- 계정은 잠그지 않는다 (위 「처리 순서」). 행사 `VERSION` 도 올리지 않는다

### Response — 200

본문은 [내 신청서](#내-신청서) 와 같다 (취소된 뒤의 값, `status = CANCELLED`, `canCancel = false`). 화면은 상세를 다시 읽어 잔여석과 신청 버튼을 갱신한다.

### Error Responses

| 상태 | errorCode | 조건 | 화면 |
|------|-----------|------|------|
| 401 | UNAUTHORIZED | 토큰 없음 | |
| 403 | ONBOARDING_REQUIRED | 온보딩 전 | |
| 400 | INVALID_INPUT | `registrationId` 누락 · 숫자 아님 | |
| 404 | NOT_FOUND | 없는 행사 · 그 신청이 없거나 내 것이 아니거나 이 행사의 것이 아님 | 상세 다시 읽기 |
| 409 | EVENT_CANCELLED | 취소된 행사 | 상세 다시 읽기 |
| 409 | EVENT_REGISTRATION_STATUS_NOT_ALLOWED | 그 신청이 이미 취소 · 처리됨 | 「이미 처리된 신청입니다」 + 최신 내역 다시 읽기 |
| 409 | EVENT_SELF_CANCEL_CLOSED | 신청 마감 시각이 지남 | 「신청 마감 후에는 운영진에게 문의해 주세요」 |

### 프론트엔드 사용처

- core-front 행사 상세의 「신청 취소」 + 확인 창 (§4)
- 근거 시안: `EventGuestDetail.tsx` 취소 버튼 · `model.ts` `transition` CANCEL

---

## 내 행사

### 기본 정보

- **Method**: GET
- **Path**: `/api/me/events`
- **인증**: 필요 (`@RequireOnboarding`)
- **설명**: 마이페이지 「내 행사」 카드 (§6). 내가 신청한 행사마다 **최신 신청 한 건**, 최근 신청 순. 화면이 처음 3건을 그리고 「전체 N건 펼쳐보기」로 나머지를 같은 카드 안에 펼친다

### Path Parameters · Query Parameters · Request Body

없음

- 페이지를 나누지 않는다. 화면이 전체 건수와 전체 목록을 같은 카드에서 쓴다 (§6)

### Response — 200

```json
[
  {
    "eventId": 7,
    "title": "연말 네트워킹 밋업",
    "startsAt": "2026-12-05T10:00:00Z",
    "timeZone": "Asia/Seoul",
    "registration": { "registrationId": 312, "status": "CONFIRMED", "channel": "ONLINE", "createdAt": "2026-11-20T03:12:00Z" }
  }
]
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| [].eventId | Long | N | 상세로 가는 ID | CLUB_EVENT.ID |
| [].title | String | N | | CLUB_EVENT.TITLE |
| [].startsAt | String | N | UTC. 화면은 회원이 고른 표시 시간대로 바꾸고 그날의 약어를 붙인다 (§6) | CLUB_EVENT.STARTS_AT |
| [].timeZone | String | N | 행사 기준 시간대 (표시 시간대가 없을 때) | CLUB_EVENT.TIME_ZONE |
| [].registration | Object | N | 이 행사의 내 최신 신청 (재신청했으면 최신 행) | CLUB_EVENT_REGISTRATION |
| [].registration.registrationId | Long | N | | ID |
| [].registration.status | String | N | | STATUS |
| [].registration.channel | String | N | | CHANNEL |
| [].registration.createdAt | String | N | 정렬 기준 | CREATED_AT |

- 정렬: `registration.createdAt DESC, registration.registrationId DESC` (§6 「최근 신청 순」)
- 신청이 없으면 `[]` — 화면은 빈 상태 안내와 「행사 둘러보기」 (§6)
- 쿼리: 내 신청을 행사별 최신 한 건으로 줄인 뒤(`ROW_NUMBER() … PARTITION BY CLUB_EVENT_ID ORDER BY CREATED_AT DESC, ID DESC` 또는 `MAX(ID)`) 행사를 한 번에 읽는다. 행마다 행사를 다시 읽지 않는다 ([jpa-guide](../../docs/backend-development-guide/jpa-guide.md) N+1)

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | ONBOARDING_REQUIRED | 온보딩 전 |

### 프론트엔드 사용처

- core-front 마이페이지 「내 행사」 카드 (아직 없음)
- 근거 시안: `frontend/apps/playground/src/proto/events/MyEventsSummary.tsx` · `model.ts` `latestRegistrationsByEvent`

---

## 탈퇴할 때

P3 결정을 user-leave 처리 순서에 더한다 (crew-apply-event §5 「탈퇴 시 종료 전 대기·확정 신청은 취소·자리 반환, 자동 취소 메일 없음. 종료·취소 및 처리 완료 이력은 유지하고 운영진 목록에 탈퇴한 회원으로 표시」). PR #479 의 공통 신청 PR 범위(P5 「탈퇴 처리」)와 같은 내용이다.

`AccountDeletionService.deleteAccount` 의 계정 잠금(기존 첫 조회) 바로 뒤, `redactNotifications` 보다 **먼저**:

1. 그 계정 신청이 걸린 `CLUB_EVENT_ID` 를 상태와 관계없이 모은다 (계정 잠금 뒤라 새 신청이 끼어들 수 없다 — 신청 제출이 같은 계정 잠금을 먼저 잡는다)
2. 그 행사 행들을 ID 오름차순으로 쓰기 잠금한다. 이미 취소된 행사도 잠근다 — 그 행사의 취소 안내 메일 예약과 순서를 맞추기 위해서다 (PR #479 리뷰 「이미 `CANCELLED` 인 행사 취소 안내 대상까지」)
3. 그중 `STATUS ≠ CANCELLED` ∧ `now < effectiveEndsAt` 인 행사의 내 `PENDING` · `CONFIRMED` 신청을 `CANCELLED`, `CANCEL_REASON = ACCOUNT_DELETED`, `STATUS_CHANGED_BY = NULL` 로 바꾼다 (조건부 갱신). 도메인 이벤트 · 자동 메일 없음
4. 그 뒤 기존 `redactNotifications` 가 이 계정의 대기 메일을 취소 · 비식별한다. 행사 잠금을 먼저 잡았으므로, 행사 잠금 아래에서 메일을 예약하던 요청은 이미 커밋해 이 단계에서 정리되거나, 탈퇴가 끝난 뒤 계정이 없음을 보고 예약하지 않는다

- 종료 · 취소된 행사의 신청과 처리 완료(`DECLINED` · `CANCELLED`) 이력은 그대로 둔다. 질문 · 답 사본은 스터디 신청과 같은 기준으로 보관한다 (P3 · [user-leave](../user-leave/spec.md) 「STUDY_APPLICATION」 — 자유 서술 답은 자동 파기하지 않는다)
- 신청 행에 연락처 사본이 없어 지울 PII 칸이 없다. `ACCOUNT_ID` 는 계정이 지워져 되짚을 수 없게 된다
- user-leave 스펙의 처리 순서 · 「삭제 · 보존 정책 요약」 표에 `CLUB_EVENT_REGISTRATION` 줄을 더한다 (구현 PR)

---

## 데이터 모델: CLUB_EVENT_REGISTRATION (공동 정의)

PR #479 event-participant 의 「데이터 모델 제안」과 **같은 테이블 · 같은 컬럼**을 쓴다. 이 스펙은 크루 쪽에 필요한 것만 확정하고, 다른 칸은 그 제안을 따른다. 마이그레이션 · ERD · 신청 엔티티 · 실제 `ClubEventRegistrationPort` 어댑터 · 탈퇴 단계는 **공통 신청 PR 하나**로 먼저 머지한다 (P5 결정. 동일님이 먼저 구현을 시작해 동일님이 쓰고 효승님이 리뷰한다).

| 컬럼 | 이 스펙에서의 뜻 |
|---|---|
| ID · CLUB_EVENT_ID · ACCOUNT_ID · CHANNEL · STATUS | PR #479 와 같다. `CLUB_EVENT_ID` · `ACCOUNT_ID` 는 FK 없이 ID 참조 |
| CANCEL_REASON | 이 스펙이 쓰는 값: `SELF_CANCELLED` (본인 취소) · `ACCOUNT_DELETED` (탈퇴, P3 — PR #479 제안 목록에 **추가**) |
| STATUS_CHANGED_AT · STATUS_CHANGED_BY | 본인 취소 때 `now` · 본인 계정 ID. 탈퇴는 `STATUS_CHANGED_BY = NULL` |
| APPLICANT_TIME_ZONE | 신청 때 `ACCOUNT.TIME_ZONE` 사본 (화면 값이 아니다) |
| QUESTIONS_SNAPSHOT | 신청 때 현재 질문 `[{questionId, label, type, required, options}]` (SORT_ORDER 순) |
| ANSWERS_SNAPSHOT | `{"<questionId>": ["…"]}`. 빈 답은 키째 뺀다 |
| SUBMIT_IDEMPOTENCY_KEY | **이 스펙이 더하는 칸** (PR #508 리뷰). VARCHAR(36), NOT NULL. 신청 제출의 `Idempotency-Key`. `UNIQUE(ACCOUNT_ID, SUBMIT_IDEMPOTENCY_KEY)` — 이름 `uk_club_event_registration_account_submit_key` |
| CREATED_AT | 신청 시각 · 내 행사 정렬 · 최신 신청 고르기 |

인덱스는 PR #479 제안 그대로다. 이 스펙이 쓰는 것:

| 인덱스 (PR #479 이름) | 이 스펙에서 |
|---|---|
| `idx_club_event_registration_event_channel_status` | 목록 · 상세의 잔여석 · `displayStatus` (포트 `countActiveSeats*`) |
| `idx_club_event_registration_account_event` | 중복 신청 확인 (처리 순서 7 · 8) · 내 행사 · 내 신청서 · 상세의 `myRegistration` · 탈퇴 |

- `UNIQUE(CLUB_EVENT_ID, ACCOUNT_ID)` 는 두지 않는다. 재신청이 새 행이다. 중복은 계정 · 행사 잠금 뒤 확인으로 막는다
- 신청 엔티티 `ClubEventRegistration` 과 저장소 · 어댑터는 `com.studyclub.domain.event.registration` (PR #479 제안). 신청 상태 enum 이름은 `ClubEventRegistrationStatus` (제안)
- 이 스펙의 판정 메서드: `ClubEventApplication.blockedReason(…)` (도메인 서비스) · `ClubEventRegistration.selfCancelBlockedReason(event, now)` · `ClubEventRegistration.canSeeOnlineLink(event)` · `ClubEvent.questionVersion()` · `ClubEvent.listGroup(now, counts)`

## 새 오류 코드

| 코드 | HTTP | 기본 문구 (제안) | 화면이 다르게 하는 일 |
|---|---|---|---|
| `EVENT_REGISTRATION_CLOSED` | 409 | 모집이 마감된 행사입니다. | 신청 창을 닫고 상세를 다시 읽는다 |
| `EVENT_APPLICANT_EMAIL_INVALID` | 409 | 계정 이메일을 확인한 뒤 다시 신청해 주세요. | 계정 이메일 확인 안내 |
| `EVENT_ALREADY_REGISTERED` | 409 | 이미 신청한 행사입니다. 내 신청 내역을 확인해 주세요. | 내 신청 내역을 다시 읽는다 |
| `EVENT_REGISTRATION_DECLINED` | 409 | 참가 불가 처리된 행사는 다시 신청할 수 없습니다. | 재신청 안내 |
| `EVENT_CHANNEL_FULL` | 409 | 선택한 참여 방식의 정원이 찼습니다. | 입력 유지, 다른 방식 안내 |
| `EVENT_QUESTIONS_CHANGED` | 409 | 신청 질문이 변경되었습니다. 변경된 질문을 확인해 주세요. | 최신 질문으로 다시 그리고 바뀌지 않은 답만 유지 |
| `EVENT_SELF_CANCEL_CLOSED` | 409 | 신청 마감 후에는 운영진에게 취소를 요청해 주세요. | 운영진 문의 안내 |

- 문구는 프로토 `transition` APPLY · CANCEL 의 실패 문구를 옮겼다
- 기존 코드를 그대로 쓰는 것: `EVENT_CANCELLED` · `EVENT_ENDED` ([event](../event/spec.md) — 기본 문구가 「…수정할 수 없습니다」라 사이트 응답에서는 서비스가 문구를 넘긴다) · `EVENT_REGISTRATION_STATUS_NOT_ALLOWED` (PR #479 의 새 코드)
- [exception-handling-guide](../../docs/backend-development-guide/exception-handling-guide.md) 「프론트가 다르게 행동하는가」 기준으로 원인마다 하나씩 둔다 ([event](../event/spec.md) Q12 와 같은 방침)

## 퍼널·계측

R4 결정 · [crew-apply-event 「활성화와 행동 분석」](../../01-planning/stories/crew-apply-event/PRD.md) (PR #509). [analytics](../analytics/spec.md) 스펙 표는 구현 PR 에서 함께 고친다.

### 활성화: 첫 스터디 신청 **또는** 첫 행사 신청

- 계정의 **처음으로 성공한 신청 한 번**이 활성화다. 행사 신청은 `PENDING` · `CONFIRMED` 모두 접수 순간에 센다. 이후 참가 확정 · 취소 · 재신청 · 다른 신청은 활성화를 다시 만들거나 되돌리지 않는다
- **판정을 DB 한 곳에 둔다**: `ACCOUNT.ACTIVATED_AT` (DATETIME(6), NULL) · `ACCOUNT.ACTIVATION_ACTION` (`STUDY_APPLIED` · `EVENT_APPLIED`). 신청 트랜잭션이 이미 잡은 `ACCOUNT` 행 잠금 아래에서 `ACTIVATED_AT` 이 비었을 때만 채운다 (`Account.activate(action, now)` — 채웠으면 true). 스터디 신청 · 행사 신청 모두 계정 행을 먼저 잠그므로 동시에 와도 한쪽만 true 를 받는다. 재시도는 이미 값이 있어 false 다
- 바뀐 행이 1 이면 `AccountActivatedEvent(accountId, action, studyId | eventId)` 를 낸다. 분석 구독자가 커밋 뒤 Amplitude · GA4 `Activated` 를 보낸다
- **기존 스터디 활성화도 같은 판정으로 바꾼다.** 지금은 「그 계정의 스터디 신청이 1건이면」(`AnalyticsEventListener`)이라 동시 신청 · 재전송에 약하고 행사를 모른다. 마이그레이션이 이미 스터디 신청이 있는 계정의 `ACTIVATED_AT` 을 첫 신청 시각으로 채워(`STUDY_APPLIED`), 기존 회원이 행사 신청으로 다시 활성화되지 않게 한다
- 탈퇴하면 `ACCOUNT` 행과 함께 사라진다. 분석 기록은 [analytics](../analytics/spec.md) 의 탈퇴 · 수집 중단 규칙을 따른다

| 행동 | Amplitude | GA4 | 속성 | 보내는 곳 · 시점 | 중복 방지 |
|---|---|---|---|---|---|
| 활성화 | `Activated` | `activated` | `activation_action` = `study_applied` · `event_applied`, `study_id` 또는 `event_id` (GA4 는 `activation_action` 만) | server, 첫 활성화 커밋 뒤 | `insert_id = activated_{analyticsId}` (기존과 같다) |
| 행사 신청 완료 | `Event Registration Completed` | — | `event_id` · `registration_id` · `channel`(`online` · `offline`) · `status`(`pending` · `confirmed`) | server, 신청 커밋 뒤 | `insert_id = event_registration_completed_{registrationId}`. 같은 키의 재시도는 새 신청을 만들지 않아 이벤트도 다시 나지 않는다 |
| 행사 신청 취소 완료 | `Event Registration Cancelled` | — | `event_id` · `registration_id` · `channel` · `cancel_type` = `self` (이 스펙) · `admin` (event-participant) · `event_cancelled` (event-status) | server, 취소 커밋 뒤 | `insert_id = event_registration_cancelled_{registrationId}` |
| 신청 폼 열기 | `Event Apply Form Opened` | — | `event_id` | front, 신청 창이 실제로 열렸을 때 | — |

- 서버 이벤트는 커밋 뒤 · 비동기로 보내고 실패는 삼킨다. 전송 실패가 신청 · 취소 · 메일 예약을 되돌리지 않는다. 롤백된 처리는 커밋이 없어 보내지 않는다 ([domain-events](../domain-events/spec.md))
- 승인(참가 확정)은 새 신청으로 세지 않는다. 탈퇴 취소(`ACCOUNT_DELETED`)는 보내지 않는다
- 이메일 · 이름 · 닉네임 · 신청 답변은 보내지 않는다. 분석 ID · 수집 중단 규칙은 기존과 같다
- 기존 `events_list` · `event_detail` 페이지 조회와 `Event Card Clicked` 는 그대로다. 「신청 폼 열기」는 core-front 연결(FE) PR 에서 넣는다
- 이름 · 속성은 PR #479 event-participant 「퍼널·계측」의 `Event Registration Cancelled` · `cancel_type` 과 맞췄다

## 근거와 PRD·프로토의 차이

| 항목 | PRD · 프로토 | 이 스펙 |
|---|---|---|
| 신청 당시 시간대 | 프로토 APPLY 는 화면의 표시 시간대를 `applicant.timeZone` 에 넣는다 | 서버가 `ACCOUNT.TIME_ZONE` 을 사본으로 둔다. 타입 주석(「신청 당시 회원 프로필 시간대」)과 M3 결정이 프로필 기준이다 |
| 질문 버전 | 프로토 `eventQuestionVersion` 은 질문 JSON 문자열 그대로 | 같은 재료의 SHA-256 지문. 응답 크기와 비교가 질문 수와 상관없게 한다 |
| 답의 모양 | 프로토는 단답 · 단일 선택을 문자열, 체크박스를 배열로 둔다 | 언제나 문자열 배열 (PR #479 신청서 · 저장 모양과 같다) |
| 이메일 확인 | 프로토는 신청 때 정규식으로 막는다 | 같은 검사를 서버가 한다. 상세는 `ACCOUNT_EMAIL_INVALID` 로 미리 알린다 |
| 중복 신청 | 프로토는 `CANCELLED` 가 아닌 행이 있으면 막는다 | 같다 (`PENDING` · `CONFIRMED` · `DECLINED`) |
| 본인 취소 마감 | 프로토 CANCEL 은 `deadlineAt ≤ now` 면 막는다 | 같다. 모집 마감(수동)은 막지 않는다 (S3) |
| 온라인 링크 | 프로토는 확정 온라인 신청자에게만 그린다 | 서버가 그 사람에게만 응답에 싣는다 |
| 잠금 순서 | event 스펙: 「첫 조회로 `CLUB_EVENT` 행」 | 신청 제출만 `ACCOUNT` → `CLUB_EVENT` (탈퇴와 순서를 맞춤, R1 결정) |
| 신청 재시도 | 프로토는 재시도 개념이 없다 | `Idempotency-Key` 로 같은 시도의 재시도를 알아본다 (PR #508 리뷰) |
| 본인 취소 대상 | 프로토 CANCEL 은 `registrationId` 를 받는다 | 같다. 경로는 `…/registrations/me`, 신청 번호는 쿼리 (PR #508 리뷰 · R6) |

## 결정 기록 (PR #508 리뷰, 2026-11-18)

| 항목 | 결정 | 반영한 곳 |
|---|---|---|
| R1 | 잠금은 `ACCOUNT` → `CLUB_EVENT`. 신청이 먼저면 탈퇴가 그 신청까지 정리, 탈퇴가 먼저면 새 신청을 받지 않는다. event 스펙(효승님)에도 공유해 반영 | 「같은 행사 · 같은 계정에 쓰는 요청의 처리 순서」, 「탈퇴할 때」, 신청 제출 처리 순서 1 |
| R2 | 예정은 시작이 가까운 순, 지난 행사는 최근 순. 탭 유지, 페이지 없이 전체 | 「행사 목록」 |
| R3 | 단답 200자 · 장문 2,000자. 앞뒤 공백 제거 뒤 길이, 필수 질문의 공백만 입력은 미응답, 선택 질문은 비워도 됨, 장문 줄바꿈 유지. 화면 · 서버 같은 기준 | 신청 제출 답 표 |
| R4 | 활성화 = 첫 스터디 신청 또는 첫 행사 신청 중 먼저 성공한 한 번(재시도 · 동시 요청에도 한 번). 기존 스터디 활성화도 같은 판정. 행사 신청 완료 · 취소 완료(서버) · 신청 폼 열기(프론트) 기록. 상세는 PR #509 PRD | 「퍼널·계측」, 신청 제출 처리 순서 13-1 · 14 |
| R5 | 종료된 행사도 온라인 참가 확정자에게 링크를 계속 보인다. 비로그인 · 탈퇴 계정에는 나가지 않는다 | 행사 상세 `onlineLinkVisible`, 「인가」 |
| R6 | 본인 취소는 `DELETE /api/events/{eventId}/registrations/me`. 행은 남기고 `CANCELLED` · `SELF_CANCELLED` | 「본인 취소」 |

개별 리뷰 세 건:

| 리뷰 | 반영한 곳 |
|---|---|
| 본인 취소에 화면이 보던 신청 번호를 함께 보내 그 신청만 취소 | 「본인 취소」 Query Parameters · 처리 순서 3 · 4, 겹친 요청 표 |
| 신청 제출에 `Idempotency-Key` — 같은 시도의 재시도가 새 신청을 만들지 않게 | 「신청 제출」 Request Headers · 처리 순서 1-1, 데이터 모델 `SUBMIT_IDEMPOTENCY_KEY`, 겹친 요청 표 |
| 공개 목록 · 상세에서 토큰의 계정이 지금 있고 온보딩을 마쳤는지 확인 | 「인가」 표, `applyBlockedReason`, 상세 `onlineLinkVisible` |

## 미확정

없음.
