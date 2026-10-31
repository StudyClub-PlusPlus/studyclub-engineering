# PRD: 01-planning/stories/captain-grant-roles/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-029
Feature: ST-029 캡틴은 유저에게 서로 다른 역할과 권한을 줄 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-029-S01 @AC-1 @AC-2 @AC-7
  Scenario: BO-ST-029-S01 계정 권한 변경
    When 다른 회원의 권한 메뉴를 열고 캡틴과 크루를 선택한다
    Then 유저 목록에서 계정 권한을 캡틴·크루로 변경
    And 선택 즉시 반영
    And 네비게이터는 이 화면에서 주지 않음 — 스터디 크루 명단에서 지정

  @BO-ST-029-S02 @AC-3 @AC-4 @AC-5
  Scenario: BO-ST-029-S02 변경 불가 권한
    When 본인과 마지막 캡틴의 권한 변경을 시도한다
    Then 자기 권한 변경 차단
    And 마지막 캡틴 강등 차단
    And 변경 불가 행 구분 및 사유 안내

  @BO-ST-029-S03 @AC-6
  Scenario: BO-ST-029-S03 기본 권한 안내
    When 역할별 기본 권한 표를 연다
    Then 역할별 기본 권한 표 열람

  @BO-ST-029-V01
  Scenario: BO-ST-029-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 지금 권한 하나

  @BO-ST-029-V02
  Scenario: BO-ST-029-V02 바꿀 수 없음
    Given 대상 화면이 PRD의 "바꿀 수 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 구분된 칸, 짚으면 이유(본인 · 마지막 캡틴)

# 실행 카탈로그(표시 상태 일부): user-list--role-menu
  @BO-ST-029-V03 @catalog-partial
  Scenario: BO-ST-029-V03 고르는 중
    Given 대상 화면이 PRD의 "고르는 중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 캡틴 · 크루

  @BO-ST-029-V04
  Scenario: BO-ST-029-V04 변경 중
    Given 대상 화면이 PRD의 "변경 중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 원래 배지 그대로, 옆에서 하나가 돈다. 그 줄은 다시 고를 수 없다

  @BO-ST-029-V05
  Scenario: BO-ST-029-V05 완료
    Given 대상 화면이 PRD의 "완료" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 바뀐 배지와 알림 한 번(디스코드 안내 포함)

  @BO-ST-029-V06
  Scenario: BO-ST-029-V06 실패
    Given 대상 화면이 PRD의 "실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 원래 배지 그대로. 사유와 다시 시도를 알린다

