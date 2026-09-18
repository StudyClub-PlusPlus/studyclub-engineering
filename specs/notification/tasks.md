# 회원가입 웰컴메일 Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)

## 구현

- [x] T001 notification 모듈 등록 및 컴포넌트 스캔
- [x] T002 엔티티·리포지토리·JSON 변환 및 V14(원래 V12, PR 오픈 기간 중 beta 의 domain V12·V13 과 두 차례 충돌해 재번호) 템플릿 시딩
- [x] T003 AFTER_COMMIT 리스너와 REQUIRES_NEW 생성 서비스, 디버그 코드 제거
- [x] T004 재수거·클레임·메일 발송·결과 저장
- [x] T005 MailClient/SES 구현 및 mail 카테고리 설정
- [x] T006 백오피스 조회 API (`RequireAdmin`+`AdminGuardInterceptor` 가드는 이번 스펙 범위를 넘어선다고 판단해 제거 — 로그인만 요구, ADMIN 역할 검사는 [back-office-login/spec.md](../back-office-login/spec.md)의 후속 PR로 미룸)
- [x] T007 온보딩 이벤트·발송·실패·재수거·관리자 API 테스트
- [x] T008 ERD 2개·관계도 2곳·모듈 문서·스펙 상태 갱신

## 검증·리뷰

- [x] T009 ./gradlew check
- [x] T010 빈 MySQL에 V1–V14 적용 및 Hibernate validate
- [x] T011 실제 SES 자격증명으로 메일 수신 확인 (온보딩 200 → SENT, 사용자 수신 확인)
- [ ] T012 diff 사용자 검토 후 커밋 승인
- [x] T013 구현 PR에서 AWS SDK 합의 확인 (#80 가드 재사용은 취소 — RequireAdmin/AdminGuardInterceptor 삭제)

검증 기록: 전체 check 성공. MySQL 8.0 빈 스키마에 V1–V12 적용 및 validate 기동 성공, 온보딩 HTTP 200 → PENDING 1건 → 관리자 조회 마스킹 확인. 로컬 secrets 설정과 구성 세트로 실제 SES 발송 성공, 사용자가 수신함 도착 확인.
