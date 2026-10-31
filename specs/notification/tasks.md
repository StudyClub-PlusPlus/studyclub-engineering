# 회원가입 웰컴메일 Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)

## 구현

- [x] T001 notification 모듈 등록 및 컴포넌트 스캔
- [x] T002 엔티티·리포지토리·JSON 변환 및 V14(원래 V12, PR 오픈 기간 중 beta 의 domain V12·V13 과 두 차례 충돌해 재번호) 템플릿 시딩
- [x] T003 AFTER_COMMIT 리스너와 REQUIRES_NEW 생성 서비스, 디버그 코드 제거
- [x] T004 재수거·클레임·메일 발송·결과 저장
- [x] T005 MailClient/SES 구현 및 mail 카테고리 설정
- [x] T006 백오피스 조회 API (`RequireAdmin`+`AdminGuardInterceptor` 가드는 이번 스펙 범위를 넘어선다고 판단해 제거 — 로그인만 요구, ADMIN 역할 검사는 [back-office-login/spec.md](../back-office-login/spec.md)의 후속 PR로 미룸. **이후 authz-guards 로 클래스 단위 `@RequireAdmin` 이 적용됨**)
- [x] T007 온보딩 이벤트·발송·실패·재수거·관리자 API 테스트
- [x] T008 ERD 2개·관계도 2곳·모듈 문서·스펙 상태 갱신

## 검증·리뷰

- [x] T009 ./gradlew check
- [x] T010 빈 MySQL에 V1–V14 적용 및 Hibernate validate
- [x] T011 실제 SES 자격증명으로 메일 수신 확인 (온보딩 200 → SENT, 사용자 수신 확인)
- [ ] T012 diff 사용자 검토 후 커밋 승인
- [x] T013 구현 PR에서 AWS SDK 합의 확인 (#80 가드 재사용은 취소 — RequireAdmin/AdminGuardInterceptor 삭제)

검증 기록: 전체 check 성공. MySQL 8.0 빈 스키마에 V1–V12 적용 및 validate 기동 성공, 온보딩 HTTP 200 → PENDING 1건 → 관리자 조회 마스킹 확인. 로컬 secrets 설정과 구성 세트로 실제 SES 발송 성공, 사용자가 수신함 도착 확인.

## 실패 건 재발송 (2026-10-16)

> Spec: [실패 건 재발송](./spec.md#post-apiadminnotificationsresend) · 마이그레이션 없음 — 같은 행을 되돌리므로 스키마가 바뀌지 않는다

### 백엔드

- [x] T020 `Notification.resend()` · `resendSkipReason()` · `canResend()` — FAILED 만, 수신 계정이 남아 있어야 한다. `ResendSkipReason` (`NOT_FAILED`·`RECIPIENT_GONE`)
- [x] T021 `NotificationRepository` — 정렬 보조 키 `ID DESC`, `findAllByIdInOrderByCreatedAtDescIdDesc`(`?ids=`), `findAllByIdInForUpdate`(id 오름차순 잠금)
- [x] T022 `NotificationRecipientAccounts` — 남아 있는 수신 계정 ID. 목록 `canResend` 와 재발송 접수가 같은 재료를 쓴다
- [x] T023 `NotificationResendService` + 요청/응답 DTO + `POST /api/admin/notifications/resend` (202, `accepted`·`skipped`, 없는 ID 는 404)
- [x] T024 `GET /api/admin/notifications` — 행마다 `canResend`, `ids` 파라미터, `limit` 상한 100, `ids` 100개 상한
- [x] T025 테스트 — 엔티티 단위(상태 전이·판정), 통합(부분 성공·중복 ID·404·400·401/403·`canResend`·`ids` 조회), 동시성(같은 건 동시 접수는 한 번만; 잠금을 빼면 실패함을 확인)
- [x] T026 `./gradlew check`

### 프론트

- [x] T030 `back-office-front` 「알림」 한 메뉴·두 탭(템플릿/발송 이력)과 발송 이력 화면 — 필터·페이지는 URL 쿼리, 조회 실패와 0건 구분
- [x] T031 재발송 UI — `canResend` 인 줄에만 한 건 재발송, 전체 재발송(목록 `status=FAILED&limit=100` 으로 id 를 모아 100건씩), 끝 추적(`?ids=`)과 토스트
- [x] T032 MSW 핸들러 · 동작 테스트


## 알림 템플릿 추가·수정·삭제 (2026-10-27)

> Spec: [템플릿 쓰기 API](./spec.md#post-apiadminnotification-templates) · 마이그레이션 없음 — 이때는 조건당 한 건이라 `UNIQUE(EVENT_TYPE, CHANNEL)` 를 그대로 뒀다. 같은 조건 여럿은 아래 「같은 조건에 템플릿 여럿」(2026-10-30)에서 다룬다. 회원 탈퇴 조건은 이 범위 밖

### 백엔드

- [x] T040 `NotificationTemplate.create()` · `edit()` — 채널은 메일 고정, 수정자(`UPDATED_BY_ADMIN_ID`) 기록
- [x] T041 `NotificationTemplateRequest` — 제목 255자, 본문 UTF-8 65,535바이트(`TEXT` 한도) 검증
- [x] T042 `NotificationTemplateCommandService` — 같은 조건이 있으면 409(사전 조회 + 동시 요청의 `UNIQUE` 위반 변환), 없는 ID 404
- [x] T043 `POST`(201)·`PUT`(200)·`DELETE`(204) `/api/admin/notification-templates` — 삭제해도 발송 이력은 남는다
- [x] T044 테스트 — 엔티티 단위, 통합(성공·409·400·404·401/403, 바이트 경계, 삭제 후 이력 유지)
- [x] T045 `./gradlew check`

### 프론트

- [x] T050 팝업 입력 제한 — 제목 255자(`maxLength`), 본문 65,535바이트(한도를 넘는 입력은 받지 않고 사용량 표시)
- [x] T051 `TODO(api)` 제거, MSW 에 409 프리셋 추가, 동작 테스트


## 같은 조건에 템플릿 여럿 (2026-10-30)

> Spec: [갱신 2026-10-30](./spec.md) · 마이그레이션 V46 (V44 는 반 공지 수신자 유니크 키 이름 변경, V45 는 사이트 공지가 사용. 열린 PR #394 도 V46 을 쓰므로 번호는 병합 직전에 beta 최신으로 다시 확인) · 회원 탈퇴 조건은 이 범위 밖

### 스펙·문서

- [x] T060 notification 스펙 — 제약 제거, 추가·수정 409 삭제, 「지운 뒤의 동작」을 마지막 템플릿 기준으로
- [x] T061 study-notice 스펙 — 템플릿 모두로 행 생성, 공지별 메일 건수는 수신자 기준(대표 상태)
- [x] T062 ERD 2개 · PRD ST-030 개발 범위 · share 10-29 운영 규칙

### 백엔드

- [x] T063 V46 — `uk_notification_template_event_channel` 제거, `(EVENT_TYPE, CHANNEL)` 일반 인덱스. 엔티티의 `@UniqueConstraint` 도 같이 바꾼다 (stage 는 SQL 을 손으로 한 번)
- [x] T064 `NotificationTemplateRepository` — 조건의 템플릿 목록(`id` 오름차순)·건수 조회, `findByEventTypeAndChannel` 제거
- [x] T065 `NotificationCreationService` — 웰컴(템플릿 수만큼 행, 0개면 로그만)·공지(수신자 × 템플릿, 0개면 롤백)
- [x] T066 `NotificationTemplateCommandService` — `rejectIfTaken`·유일 제약 → 409 변환 제거
- [x] T067 공지별 메일 건수 — 수신자 기준 집계 (`countByReferenceAndStatus` → 수신자별 대표 상태: 실패 > 대기 > 완료, `CANCELLED` 만이면 제외)
- [x] T068 테스트 — 단위(팬아웃 N × M, 0개), 통합(웰컴 2행, 공지 4행과 건수 ≤ 수신자 수, 409 케이스 정리, 탈퇴 N행, 재발송 한 행), 시딩 보조 코드 정리
- [x] T069 `./gradlew check`

### 프론트

- [x] T070 MSW — 409 프리셋 삭제
- [x] T071 `TemplateDialog` — 409 분기·`DUPLICATE` 삭제, 삭제 확인 영향 안내를 목록에서 센 같은 조건의 템플릿 수(하나뿐이면 마지막)로 가른다
- [x] T072 동작 테스트
- [x] T076 수정 팝업에서 조건을 바꿀 때의 영향 안내 (PR #384 리뷰) — 원래 조건의 마지막 템플릿을 다른 조건으로 옮기면 저장 전에 그 조건의 알림이 멈춘다고 알린다. 저장은 막지 않는다
- [x] T073 빈 MySQL 8 에 V1..V46 적용 + `ddl-auto=validate` 부팅 (`backend-migration-check` 와 같은 방식, 로컬 임시 컨테이너)
- [x] T074 로컬 Chrome 확인 (임시 MySQL + 실 API, 임시 JWT) — 같은 조건에 둘째 템플릿 추가(409 없음), 삭제 확인 안내(마지막이 아닐 때/마지막), 조건 변경 안내(마지막이면 빨간 안내, 다른 템플릿이 남거나 되돌리면 없음), 가입 한 번에 알림 행 2개와 발송 이력 화면, 스터디 공지 4행(수신자 2 × 템플릿 2)과 기록의 건수가 받는 사람 수 기준(대기·완료·실패·취소 혼합 4가지)임을 실제 MySQL 에서 확인
- [ ] T075 stage 수동 SQL (코드 배포 후 `SHOW INDEX FROM NOTIFICATION_TEMPLATE` 로 제약 이름 확인 → V46 SQL 실행)
