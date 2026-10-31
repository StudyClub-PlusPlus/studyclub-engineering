# PRD: 01-planning/stories/notification-template/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-030
Feature: ST-030 캡틴은 알림 템플릿을 추가, 수정, 삭제할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): notification-templates--default
  @BO-ST-030-S01 @AC-1 @AC-5 @catalog-partial
  Scenario: BO-ST-030-S01 알림 템플릿 목록과 조건
    When 회원가입·회원 탈퇴 및 같은 조건의 여러 템플릿을 조회한다
    Then 등록된 템플릿 목록 — 알림 조건 · 채널 · 제목 · 마지막 수정
    And 알림 조건 둘 — 회원가입 · 회원 탈퇴. 같은 조건에 템플릿 여럿 가능

# 실행 카탈로그(표시 상태 일부): notification-templates--create, notification-templates--edit, notification-templates--preview
  @BO-ST-030-S02 @AC-2 @AC-3 @AC-6 @catalog-partial
  Scenario: BO-ST-030-S02 템플릿 편집과 미리보기
    When 템플릿을 추가·수정하며 HTML과 일반 텍스트 및 치환 변수를 미리 본다
    Then 템플릿 추가 — 알림 조건 · 제목 · 본문
    And 템플릿 수정 — 목록에서 조건을 누르면 값이 채워진 팝업. 조건 · 제목 · 본문 모두 변경 가능. 치환 변수 원문 그대로
    And 본문 편집 · 미리보기 — 같은 팝업에서 전환하며 저장 전 내용도 확인한다. HTML은 메일 모양으로, 일반 텍스트는 줄바꿈을 유지해 표시한다. 제목·본문의 모든 치환 변수는 미리보기에서도 원문 그대로 표시하고 저장 원문을 보존한다

# 실행 카탈로그(표시 상태 일부): notification-templates--delete
  @BO-ST-030-S03 @AC-4 @catalog-partial
  Scenario: BO-ST-030-S03 템플릿 삭제
    When 수정 팝업에서 삭제를 확인하고 지난 발송 이력을 조회한다
    Then 템플릿 삭제 — 수정 팝업 안, 확인 단계 후 삭제. 되돌리기 없음. 지난 발송 이력 유지

