# PRD: 01-planning/stories/notification-history/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-032
Feature: ST-032 캡틴은 알림 발송 이력을 조회할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): notifications--failed
  @BO-ST-032-S01 @AC-1 @AC-2 @AC-3 @AC-4 @AC-5 @catalog-partial
  Scenario: BO-ST-032-S01 발송 이력 조회
    When 목록을 조회하고 조건·상태를 거른 뒤 가린 수신 주소를 펼친다
    Then 최근 순 조회 — 요청 시각 · 알림 조건 · 채널 · 수신 주소 · 상태 · 발송 시각
    And 조건·상태 드롭다운과 조건에 걸린 건수 확인
    And 상태 문구 표기 — 색만으로 가르지 않음
    And 수신 주소 가림과 줄별 펼침
    And 조회 실패와 0건 구분

# 실행 카탈로그(표시 상태 일부): notifications--resend-confirm
  @BO-ST-032-S02 @AC-6 @AC-7 @catalog-partial
  Scenario: BO-ST-032-S02 실패 알림 재발송
    When 실패 한 건을 재발송하고 전체 재발송은 확인 후 실행한다
    Then 실패 건 재발송 — 한 건은 바로, 묶음은 확인 후
    And 재발송 진행 표시와 결과 알림 1회

  @BO-ST-032-V01
  Scenario: BO-ST-032-V01 읽는 중
    Given 대상 화면이 PRD의 "읽는 중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 표 자리에 20줄의 빈 칸. 거르는 칸과 전체 재발송은 눌리지 않는다

# 실행 카탈로그(표시 상태 일부): notifications--empty
  @BO-ST-032-V02 @catalog-partial
  Scenario: BO-ST-032-V02 이력 없음
    Given 대상 화면이 PRD의 "이력 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 「아직 알림 발송 이력이 없습니다.」

# 실행 카탈로그(표시 상태 일부): notifications--filter-empty
  @BO-ST-032-V03 @catalog-partial
  Scenario: BO-ST-032-V03 거른 결과 없음
    Given 대상 화면이 PRD의 "거른 결과 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 「선택한 조건의 발송 이력이 없습니다.」와 전체 보기

# 실행 카탈로그(표시 상태 일부): notifications--error
  @BO-ST-032-V04 @catalog-partial
  Scenario: BO-ST-032-V04 실패
    Given 대상 화면이 PRD의 "실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 「발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.」와 다시 시도

