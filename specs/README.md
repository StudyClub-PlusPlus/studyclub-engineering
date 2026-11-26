# API Specs — StudyClub

> 가이드: [spec-driven-development.md](../docs/backend-development-guide/spec-driven-development.md)
>
> **Story PRD** 는 [`01-planning/stories/{story-name}/PRD.md`](../01-planning/_registry/stories.md) 에 둔다. `specs/` 안에 만들지 않는다.

## 도메인 목록

| 도메인 | 폴더 | 상태 | 설명 |
|--------|------|------|------|
| 스터디 | [study/](./study/) | 구현중 | 스터디 목록·상세·등록 |
| 스터디 신청 | [study-application/](./study-application/) | 스펙작성중 | 신청 폼 설계·제출·결과·디스코드 연동. 기획: [폼 제작](../01-planning/stories/captain-application-form/PRD.md) · [제출](../01-planning/stories/crew-submit-application/PRD.md) · [결과](../01-planning/stories/captain-application-results/PRD.md) |
| 회원 | [account/](./account/) | — | 인증·프로필·온보딩 |
| 테스트 로그인 | [stage-email-login/](./stage-email-login/) | 구현완료 | `/auth/email/{signup,verify,login}` — 메뉴에 없는 이메일 가입(메일 코드) · 비밀번호 로그인. 스위치(`EMAIL_LOGIN_ENABLED`)로 열고, 운영도 스위치로 연다(2026-11-20 결정, 테스트 뒤 끈다) |
| 제안 | [proposal/](./proposal/) | — | 스터디 제안·관심 표시 |
| 알림 | [notification/](./notification/) | 구현중 | 이벤트 기반 알림 발송 (첫 구현: 회원가입 웰컴메일) · 백오피스 템플릿·발송 이력 조회 · 실패 건 재발송(`POST /api/admin/notifications/resend`). 기획: [알림 템플릿](../01-planning/stories/notification-template/PRD.md) · [발송 이력](../01-planning/stories/notification-history/PRD.md) |
| 대시보드 | [dashboard/](./dashboard/) | 스펙작성중 | 운영 대시보드 화면·집계·API 및 미정 사항. 기획: [운영 현황](../01-planning/stories/console-dashboard/PRD.md) |
| 내 스터디 | [my-studies/](./my-studies/) | 구현완료 | `GET /api/me/studies` — 명부 스터디 + 회차별 내 출석. 기획: [내 스터디](../01-planning/stories/crew-joined-studies/PRD.md) |
| 스터디 회차 | [study-meeting/](./study-meeting/) | 스펙작성중 | `/api/studies/{studyId}/meetings` — 네비게이터의 분반 회차 조회·추가(반복)·수정·삭제. 기획: [회차 등록](../01-planning/stories/navigator-register-sessions/PRD.md) |
| 회원 탈퇴 | [user-leave/](./user-leave/) | 스펙작성중 | `DELETE /api/me` — 계정 즉시 삭제, 데이터 파기·보존 정책 |
| 회원 관리 (백오피스) | [admin-users/](./admin-users/) | 스펙작성중 | `/api/admin/users` — 회원 목록 · 계정 권한(캡틴↔크루) 변경. 기획: [회원 목록](../01-planning/stories/captain-list-users/PRD.md) · [권한](../01-planning/stories/captain-grant-roles/PRD.md) |
| 참여 중단 (사용자 사이트) | [study-participant/](./study-participant/) | 스펙작성중 | 출석 저장 `POST /api/studies/{studyId}/attendances` 에 `withdrawals[]` 추가 — 네비게이터가 출석부 저장 한 번에 출석과 참여 중단. 기획: [참여 중단](../01-planning/stories/navigator-withdraw-participant/PRD.md) |
| 분반 · 참여 명단 (백오피스) | [study-group/](./study-group/) | 스펙작성중 | 참여 명단 · 네비게이터 지정 · 담당 캡틴 바꾸기 · 가능 시간 집계 · 반 만들기·수정·삭제 · 반 지정. 기획: [참석자](../01-planning/stories/captain-view-attendees/PRD.md) · [반 편성](../01-planning/stories/captain-assign-classes/PRD.md) |
| 반 공지 | [study-notice/](./study-notice/) | 구현완료 | `/api/studies/{studyId}/groups/{groupId}/notices` — 네비게이터·담당 캡틴이 반 팀원에게 메일·디스코드로 보낸다 · 보내기 화면 값 · 보낸 기록. 기획: [반 공지](../01-planning/stories/navigator-study-notice/PRD.md) |
| 사이트 공지 | [site-notice/](./site-notice/) | 구현완료 | `/api/notices` 읽기(비로그인 허용) · `/api/admin/notices` 등록·수정·소프트 삭제. 기획: [캡틴 공지 작성](../01-planning/stories/captain-post-notice/PRD.md) · [크루 공지 열람](../01-planning/stories/crew-view-notices/PRD.md) |
| 행사 | [event/](./event/) | 스펙작성중 | `/api/admin/events`: 캡틴의 행사 등록·수정·운영 목록·상세. 사용자 사이트 조회·신청·참가자 처리·메일·상태 전환은 별도. 기획: [행사 운영](../01-planning/stories/captain-manage-events/PRD.md) |
| 행사 상태 전환 | [event-status/](./event-status/) | 스펙확정 | `PATCH /api/admin/events/{eventId}/status`: 모집 마감 · 재모집 · 행사 취소. 취소 때 유효 신청 일괄 취소 · 취소 안내 대상 보존 · 감사 기록(`EVENT_CANCEL`), 운영 상세의 전환 판정 필드. 기획: [행사 운영](../01-planning/stories/captain-manage-events/PRD.md) §1 |
| 행사 참가자 | [event-participant/](./event-participant/) | 스펙확정 | `/api/admin/events/{eventId}/registrations`: 참가자 목록 · 신청서 · 이메일 보기(감사 로그) · 참가 확정 · 참가 불가 · 개별 취소, 행사 종료 시 확인 대기 자동 전환, 탈퇴 처리. 신청 테이블 `CLUB_EVENT_REGISTRATION` 은 공통 신청 PR #516(V62)에서 만들었다. 기획: [행사 운영](../01-planning/stories/captain-manage-events/PRD.md) §6 |
| 행사 안내 메일 | [event-mail/](./event-mail/) | 스펙확정 | `/api/admin/events/{eventId}/mails`: 안내 · 취소 안내 메일 미리보기 · 보내기 · 메일 이력, 행사 알림 조건 6종(`EVENT_ANNOUNCEMENT` 등)의 템플릿 변수 · `NOTIFICATION` 아웃박스 연동 · 발송 내용 고정 · 재발송 상태 검증. 기획: [행사 운영](../01-planning/stories/captain-manage-events/PRD.md) §7 · §7-1 |
| 행사 신청 (사용자 사이트) | [event-registration/](./event-registration/) | 스펙작성중 | `/api/events` 목록·상세(공개) · `POST/GET/DELETE /api/events/{eventId}/registrations(/me)` 신청·내 신청서·본인 취소 · `/api/me/events` 내 행사. 신청 테이블은 PR #479 와 공동 정의. 기획: [크루 행사 신청](../01-planning/stories/crew-apply-event/PRD.md) |
| 문의·오류 신고 | [feedback/](./feedback/) | 스펙작성중 | `POST /api/feedbacks` · `/api/me/feedbacks` — 크루 제출·내 문의, `/api/admin/feedbacks` — 운영 목록·상세·상태·회신·메모. 첫 회신 HTML 알림 포함. 기획: [크루 제출](../01-planning/stories/crew-submit-feedback/PRD.md) · [캡틴 조회](../01-planning/stories/captain-view-feedbacks/PRD.md) |
| 미팅 회고 | [meeting-retro/](./meeting-retro/) | 스펙작성중 | `/api/studies/{studyId}/…/retros` — 회고 작성·수정·목록·문항별 👍 · 회차별 작성 현황, `/api/admin/retros` — 캡틴 모아보기·CSV. 기획: [크루 회고](../01-planning/stories/crew-write-meeting-retro/PRD.md) · [작성 현황](../01-planning/stories/navigator-view-meeting-retros/PRD.md) · [모아보기](../01-planning/stories/captain-collect-meeting-retros/PRD.md) |

## 도메인 외 스펙

API 도메인이 아닌 것(인프라·운영). 구조는 같되 엔드포인트 스펙 대신 설계를 담는다.

| 스펙 | 폴더 | 상태 | 설명 |
|------|------|------|------|
| 시간대 확장 (공통) | [timezone/](./timezone/) | 스펙작성중 | IANA·모집 시간대·운영자 표시·`FormattedInstant`·`GET /api/admin/member-time-zones`. 기획: [확장 PRD](../01-planning/stories/timezone-expansion/PRD.md) · PR #527 |
| 데이터 보관·정리 | [data-retention/](./data-retention/) | 구현완료 | 문의·파일·감사 기록의 일일 정리, IP·권한 말소 기록 |
| 관측 스택 | [observability-stack/](./observability-stack/) | 1단계 구현 | 로그(Grafana+Loki+Alloy) → 메트릭·알림은 후속 |
| 도메인 이벤트 | [domain-events/](./domain-events/) | 1단계 구현 | 사실 → 이벤트 발행, 부수효과는 `AFTER_COMMIT` 구독자 (`@Async` 실행기 상한) |
| 운영자 알림 | [ops-alerts/](./ops-alerts/) | 1단계 구현 | 가입·신청 등 운영자가 알아야 할 이벤트 → 운영 디스코드 채널 (`OPS_DISCORD_WEBHOOK_URL`) |
| 분석 이벤트 | [analytics/](./analytics/) | 1단계 구현 | 트래킹 플랜 — Amplitude(프론트+서버) · GA4·Clarity(production 만). 가입·활성화는 서버 정본 |
| 요청 인가 가드 | [authz-guards/](./authz-guards/) | 스펙작성중 | `@RequireAdmin` · `@RequireCaptainOrNavigator` · `@RequireOnboarding` 어노테이션 통일. [back-office-login](./back-office-login/spec.md) 후속 |

> `—` = 아직 스펙 없음. 필요할 때 `_templates/` 에서 복사해서 시작한다.

## 빠른 시작

```bash
# 새 Story PRD
mkdir -p 01-planning/stories/{story-name}
# 그 폴더에 PRD.md 작성 후 01-planning/_registry/stories.md 표에 한 줄 추가

# 새 도메인 스펙 시작
mkdir -p specs/{도메인}
cp specs/_templates/spec-template.md specs/{도메인}/spec.md

# Claude Code 에서
/spec {도메인}           # 초안 자동 생성
/spec plan {도메인}      # 구현 계획 생성
/spec tasks {도메인}     # 태스크 도출
/spec review {도메인}    # 검증
```
