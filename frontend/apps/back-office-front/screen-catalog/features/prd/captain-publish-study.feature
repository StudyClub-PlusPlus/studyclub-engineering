# PRD: 01-planning/stories/captain-publish-study/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-020
Feature: ST-020 캡틴은 등록한 스터디를 공개할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-020-S01 @AC-1 @AC-2 @AC-3 @AC-5
  Scenario: BO-ST-020-S01 공개와 비공개 전환
    When 공개와 비공개 확인 창에서 각각 전환을 확정한다
    Then 목록 각 행에서 공개·미공개 전환
    And 공개 시 그날이 모집 시작일, 상태 「개설」, 사용자 사이트 노출
    And 전환은 확인 창에서 한 번 더
    And 미공개로 되돌리기 — 상태는 「작성 중」

  @BO-ST-020-S02 @AC-4 @AC-6 @AC-7
  Scenario: BO-ST-020-S02 공개 조건
    When 등록 직후 스터디와 신청 폼 없는 스터디의 공개 설정을 확인한다
    Then 신청 폼 없으면 공개 차단 및 사유 안내
    And 등록 직후는 항상 미공개
    And 행마다 신청 폼 유무 표기

  @BO-ST-020-S03 @AC-8
  Scenario: BO-ST-020-S03 공개 상태 필터
    When 목록의 공개 상태 필터를 바꾼다
    Then 공개 상태 필터

  @BO-ST-020-V01
  Scenario: BO-ST-020-V01 미공개
    Given 대상 화면이 PRD의 "미공개" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 공개 설정 / `미공개`

  @BO-ST-020-V02
  Scenario: BO-ST-020-V02 공개
    Given 대상 화면이 PRD의 "공개" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 공개 설정 / `공개`

# 실행 카탈로그(표시 상태 일부): study-detail--publish-blocked
  @BO-ST-020-V03 @catalog-partial
  Scenario: BO-ST-020-V03 공개 불가
    Given 대상 화면이 PRD의 "공개 불가" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 누를 수 없는 공개 설정 / `신청 폼을 먼저 연결하세요.`

# 실행 카탈로그(표시 상태 일부): study-detail--publish-confirm
  @BO-ST-020-V04 @catalog-partial
  Scenario: BO-ST-020-V04 공개 확인
    Given 대상 화면이 PRD의 "공개 확인" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 팝업 / `‘스터디명’ 스터디를 공개하시겠습니까?`

# 실행 카탈로그(표시 상태 일부): study-detail--unpublish-confirm
  @BO-ST-020-V05 @catalog-partial
  Scenario: BO-ST-020-V05 비공개 확인
    Given 대상 화면이 PRD의 "비공개 확인" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 팝업 / `비공개로 전환하시겠습니까?`

