# PRD: 01-planning/stories/crew-apply-presenter/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-011
Feature: ST-011 크루는 발표자를 신청할 수 있다.

  @CORE-ST-011-S01 @catalog-partial
  Scenario: CORE-ST-011-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 예정 정규 회차의 빈 발표자 칸을 확인한다
    Then 예정 정규 회차의 빈 발표자 칸에 「신청」 표시
    # 부분 실행 근거: my-joined-schedule--crew

  @CORE-ST-011-S02
  Scenario: CORE-ST-011-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 빈 발표자 칸의 신청을 누르고 다시 조회한다
    Then 신청 즉시 저장 — 별도 저장 버튼 없음

  @CORE-ST-011-S03
  Scenario: CORE-ST-011-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 이름 칩의 취소를 누르고 다시 조회한다
    Then 내 이름 칩의 × 로 즉시 취소

  @CORE-ST-011-S04
  Scenario: CORE-ST-011-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 이미 본인이 신청한 회차의 다른 칸을 확인한다
    Then 한 회차 한 칸 — 이미 들어간 회차에는 「신청」 없음

  @CORE-ST-011-S05
  Scenario: CORE-ST-011-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 다른 사람 이름이 있는 발표자 칸에서 취소를 시도한다
    Then 다른 사람이 들어간 칸은 이름만 표시, 해제 불가

  @CORE-ST-011-S06
  Scenario: CORE-ST-011-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 두 회원이 같은 발표자 칸을 동시에 신청한다
    Then 동시 신청 시 먼저 저장된 사람이 차지, 늦은 사람에게 안내

  @CORE-ST-011-S07
  Scenario: CORE-ST-011-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 킥오프와 시작한 회차의 신청·취소 컨트롤을 확인한다
    Then 킥오프·시작한 회차는 신청·취소 없음

  @CORE-ST-011-S08
  Scenario: CORE-ST-011-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 발표 신청·취소 후 출석 탭의 표시와 횟수를 확인한다
    Then 출석부의 발표 표시·발표 횟수에 즉시 반영

  @CORE-ST-011-V01 @catalog-partial
  Scenario: CORE-ST-011-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 빈 칸에 「신청」 칩 / `신청`
    # 부분 실행 근거: my-joined-schedule--crew

  @CORE-ST-011-V02
  Scenario: CORE-ST-011-V02 신청함
    Given 대상 화면이 PRD의 「신청함」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 내 이름 칩 + × / — (스크린리더 `N회차 발표자1로 신청했습니다.`)

  @CORE-ST-011-V03
  Scenario: CORE-ST-011-V03 처리중
    Given 대상 화면이 PRD의 「처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 누른 칩 잠김 / —

  @CORE-ST-011-V04
  Scenario: CORE-ST-011-V04 신청 밀림
    Given 대상 화면이 PRD의 「신청 밀림」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 표 위 경고 · 표 다시 그림 / `방금 다른 크루가 N회차 발표자1로 신청했습니다.`

  @CORE-ST-011-V05
  Scenario: CORE-ST-011-V05 이미 시작함
    Given 대상 화면이 PRD의 「이미 시작함」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 표 다시 그림 · 칩 사라짐 / `이미 시작한 회차라 바꿀 수 없습니다.`

  @CORE-ST-011-V06
  Scenario: CORE-ST-011-V06 그 밖의 실패
    Given 대상 화면이 PRD의 「그 밖의 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 표 위 경고 / `신청하지 못했습니다. 잠시 후 다시 시도해 주세요.`

