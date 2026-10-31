# PRD: 01-planning/stories/console-dashboard/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-002
Feature: ST-002 캡틴은 운영 현황을 한 화면에서 볼 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-002-S01 @AC-1 @AC-2 @AC-3 @AC-4 @AC-5
  Scenario: BO-ST-002-S01 운영 현황과 추세 조회
    When 고정된 날짜와 집계 응답으로 대시보드를 연다
    Then 활성 크루·평균 출석률·1인당 참여 스터디·커뮤니티 멤버 한 줄 조회
    And 진행중·모집중 스터디와 예정 행사를 건수와 함께 조회
    And 모집 마감·행사까지 남은 일수 표기
    And 평균 출석률 전주 대비와 최근 12주 추세
    And 크루 지역 분포

  @BO-ST-002-S02 @AC-6
  Scenario: BO-ST-002-S02 카테고리 집계 전환
    When 카테고리별 스터디 수를 진행중에서 누적으로 전환한다
    Then 카테고리별 스터디 수 — 진행중·누적 전환

  @BO-ST-002-S03 @AC-7
  Scenario: BO-ST-002-S03 운영 대상 이동
    When 보드의 스터디와 전체 보기 링크를 각각 누른다
    Then 항목에서 해당 스터디·목록으로 이동

# 실행 카탈로그(표시 상태 일부): dashboard--empty
  @BO-ST-002-V01 @catalog-partial
  Scenario: BO-ST-002-V01 보드 칸이 비었을 때
    Given 대상 화면이 PRD의 "보드 칸이 비었을 때" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 칸 높이를 지킨 채 가운데 안내만. 「모집중 스터디가 없습니다」

# 실행 카탈로그(표시 상태 일부): dashboard--empty
  @BO-ST-002-V02 @catalog-partial
  Scenario: BO-ST-002-V02 전주 값 없음
    Given 대상 화면이 PRD의 "전주 값 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 값만 적고 변화 자리를 비워 두지 않는다

# 실행 카탈로그(표시 상태 일부): dashboard--empty
  @BO-ST-002-V03 @catalog-partial
  Scenario: BO-ST-002-V03 출석 기록 없음
    Given 대상 화면이 PRD의 "출석 기록 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 「아직 출석 기록이 없습니다.」

# 실행 카탈로그(표시 상태 일부): dashboard--empty
  @BO-ST-002-V04 @catalog-partial
  Scenario: BO-ST-002-V04 카테고리 0건
    Given 대상 화면이 PRD의 "카테고리 0건" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 막대 대신 「해당하는 스터디가 없습니다.」

