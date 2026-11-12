# PRD: 01-planning/stories/crew-joined-studies/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-009
Feature: ST-009 크루는 참여 중인 스터디를 모아 볼 수 있다.

  @CORE-ST-009-S01 @catalog-partial
  Scenario: CORE-ST-009-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여중·완주·중단 스터디가 있는 내 스터디를 연다
    Then 목록에 참여 상태별 스터디가 보임
    # 부분 실행 근거: my-joined--default

  @CORE-ST-009-S02 @catalog-partial
  Scenario: CORE-ST-009-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 탭을 지정하지 않고 내 스터디에 처음 진입한다
    Then 처음 열면 참여중 탭임
    # 부분 실행 근거: my-joined--default

  @CORE-ST-009-S03 @catalog-partial
  Scenario: CORE-ST-009-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 캡틴·네비게이터·크루로 참여한 카드를 확인한다
    Then 카드마다 내 역할이 「캡틴」 · 「네비게이터」 · 「크루」 중 하나로 보임
    # 부분 실행 근거: my-joined--default

  @CORE-ST-009-S04
  Scenario: CORE-ST-009-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 카드·주간 칸·참여 중단 카드를 각각 누른다
    Then 카드나 주간 칸을 누르면 모집공고 상세가 아니라 그 스터디의 스터디 일정으로 감. 참여 중단 카드는 누를 수 없음

  @CORE-ST-009-S05 @catalog-partial
  Scenario: CORE-ST-009-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여 종료 탭을 연다
    Then 완주와 참여 중단이 같은 탭에 모이되, 카드에서 완주만 따로 구분됨
    # 부분 실행 근거: my-joined--ended

  @CORE-ST-009-S06
  Scenario: CORE-ST-009-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 정렬을 각각 바꾸고 운영·참여 역할 필터를 적용한다
    Then 정렬(다음 회차 · 시작일 · 종료일 · 이름)을 고를 수 있고, 운영하는 스터디가 있으면 역할(운영 · 참여)로 거를 수 있음

  @CORE-ST-009-V01 @catalog-partial
  Scenario: CORE-ST-009-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 참여중 탭, 주간 일정, 카드 목록 / `내 스터디`
    # 부분 실행 근거: my-joined--default

  @CORE-ST-009-V02
  Scenario: CORE-ST-009-V02 로딩
    Given 대상 화면이 PRD의 「로딩」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 본문 자리 / `불러오는 중…`

  @CORE-ST-009-V03
  Scenario: CORE-ST-009-V03 빈 결과
    Given 대상 화면이 PRD의 「빈 결과」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 탭별 빈 안내 / 위 3번 표

  @CORE-ST-009-V04
  Scenario: CORE-ST-009-V04 조회 실패
    Given 대상 화면이 PRD의 「조회 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 본문 자리 / `스터디 목록을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`

  @CORE-ST-009-V05
  Scenario: CORE-ST-009-V05 권한 없음
    Given 대상 화면이 PRD의 「권한 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 로그인 화면으로 이동. `next` = 이 화면 / (로그인 화면 카피)

