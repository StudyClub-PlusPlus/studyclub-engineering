# PRD: 01-planning/stories/crew-leave/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: PRD 기본 상태는 안내 세 줄, 현재 화면은 두 줄 구성이다. 현재 카피와 화면을 기준으로 캡처하며 실제 탈퇴 요청은 실행하지 않는다.
@planned @ST-013
Feature: ST-013 크루는 회원에서 탈퇴할 수 있다.

  @CORE-ST-013-S01
  Scenario: CORE-ST-013-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 마이페이지에서 회원 탈퇴 링크를 누른다
    Then 마이페이지 내 정보에서 탈퇴 지면 진입

  @CORE-ST-013-S02 @catalog-partial @code-baseline
  Scenario: CORE-ST-013-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 탈퇴 지면의 사전 고지를 확인한다
    Then 되돌릴 수 없음·재가입해도 기록 미복구 사전 고지
    # 부분 실행 근거: my-leave--default

  @CORE-ST-013-S03 @catalog-partial
  Scenario: CORE-ST-013-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 사유 선택 유무별로 탈퇴를 요청한다
    Then 탈퇴 사유 선택 — 고르지 않아도 탈퇴 가능
    # 부분 실행 근거: my-leave--default

  @CORE-ST-013-S04
  Scenario: CORE-ST-013-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 네비게이터로 맡은 진행 중 스터디가 있는 상태로 탈퇴 화면을 연다
    Then 네비게이터로 맡은 진행 중 스터디 이름·수 표시

  @CORE-ST-013-S05
  Scenario: CORE-ST-013-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 맡은 스터디가 있는 경우와 없는 경우에 탈퇴를 누른다
    Then 맡은 스터디 있으면 재확인 후 탈퇴, 없으면 즉시 탈퇴

  @CORE-ST-013-S06
  Scenario: CORE-ST-013-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 탈퇴 재확인에서 취소를 누른다
    Then 탈퇴 취소 시 지면 유지

  @CORE-ST-013-S07
  Scenario: CORE-ST-013-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 탈퇴 요청을 완료한다
    Then 탈퇴 완료 시 로그아웃 상태로 홈 이동

  @CORE-ST-013-V01 @catalog-partial @code-baseline
  Scenario: CORE-ST-013-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 안내 세 줄 · 사유 · 탈퇴 · 취소
    # 부분 실행 근거: my-leave--default

  @CORE-ST-013-V02
  Scenario: CORE-ST-013-V02 맡은 스터디 있음
    Given 대상 화면이 PRD의 「맡은 스터디 있음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 위에 경고가 하나 더 붙는다

  @CORE-ST-013-V03
  Scenario: CORE-ST-013-V03 재확인
    Given 대상 화면이 PRD의 「재확인」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 경고 안에 「그래도 탈퇴하시겠습니까?」와 버튼 둘

  @CORE-ST-013-V04
  Scenario: CORE-ST-013-V04 처리 중
    Given 대상 화면이 PRD의 「처리 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 탈퇴가 눌리지 않는다

  @CORE-ST-013-V05
  Scenario: CORE-ST-013-V05 완료
    Given 대상 화면이 PRD의 「완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 홈으로 보내고 로그아웃한다

