# 회원가입 웰컴메일 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-09-15

## 대상 엔드포인트

- `GET /back-office/notification-templates`
- `GET /back-office/notifications`
- 기존 `POST /accounts/onboarding` 의 UserRegisteredEvent 구독

## 기술 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 모듈 | api → notification → domain → common | 알림 저장·발송을 웹 계층과 분리 |
| 이벤트 | AFTER_COMMIT + 생성 서비스 REQUIRES_NEW | 커밋 후 남은 트랜잭션에 참여하면 INSERT가 커밋되지 않음 |
| 저장 | Notification, NotificationTemplate. PAYLOAD 는 `@JdbcTypeCode(SqlTypes.JSON)` (Hibernate 7 네이티브 Jackson3 매퍼, 커스텀 컨버터 불필요 — 직접 검증 완료) | 수신처·닉네임 스냅샷 보존 |
| 폴링 | 기본 30초, 배치 100, 재수거 5분 | 설정값으로 조정, FOR UPDATE SKIP LOCKED 클레임 |
| 트랜잭션 | 클레임·결과 저장은 짧게, 외부 발송은 밖에서 | 네트워크 대기 중 DB 락 점유 방지 |
| 메일 | MailClient + SesMailClient, 용도별 설정 | 실제 SES와 테스트 목 분리, 다음 메일 기능에서 재사용 |
| 관리자 | (제거) 로그인만 요구, ADMIN 역할 검사 없음 | 애초 RequireAdmin+AdminGuardInterceptor 로 넣었으나 이 스펙 범위를 넘어선다고 판단 — [back-office-login/spec.md](../back-office-login/spec.md)의 후속 PR에서 요청마다 DB 조회로 붙인다 |
| 조회 | 전체 조회 후 필터·페이지 DTO, 이메일 마스킹 | 초기 소규모 이력, 기존 조회 서비스 패턴 |
| 마이그레이션 | notification 모듈의 V12 | beta의 V11 다음 전역 Flyway 버전 |

## 애그리거트 매핑

- Notification → NotificationRepository
- NotificationTemplate → NotificationTemplateRepository
- ACCOUNT·템플릿은 객체 연관 없이 ID로 참조한다. DB FK는 승인된 스펙에 따른다.

## 구현 순서

1. 모듈 등록·엔티티·리포지토리·V12 및 템플릿 시딩
2. 이벤트 리스너·별도 생성 트랜잭션
3. 재수거·클레임·렌더링·SES·결과 저장
4. 조회 API와 마스킹 (관리자 가드는 구현 중 제거 — 위 표 참고)
5. 단위 및 통합 테스트, 전체 check, 빈 MySQL 마이그레이션 검증
6. ERD·모듈 문서 및 스펙 상태 갱신

## 의존성·후속

- AWS SES SDK 추가는 구현 PR에서 합의한다.
- RequireAdmin/AdminGuardInterceptor는 구현 중 만들었다가 이 스펙 범위 밖이라 판단해 제거했다 — 재사용할 컴포넌트가 없으니 #80 후속 PR이 요청 단위 ADMIN 가드를 새로 만든다.
- PR #78(principal 이메일→ACCOUNT.ID 전환) 은 beta 병합으로 이미 반영됐다.
- 실제 SES 발송 검증은 인증된 발신 도메인 및 운영자가 준비한 자격증명이 필요하다.
- AFTER_COMMIT 이후 알림 저장 실패 시 알림 유실을 허용하는 MVP 제약은 유지한다.
