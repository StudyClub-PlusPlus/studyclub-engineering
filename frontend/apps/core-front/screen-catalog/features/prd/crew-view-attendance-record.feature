# PRD: 01-planning/stories/crew-view-attendance-record/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-010
Feature: ST-010 크루는 스터디별 출석 기록을 볼 수 있다.

  @CORE-ST-010-S01 @catalog-partial
  Scenario: CORE-ST-010-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 크루로 내 스터디 일정의 출석 탭을 연다
    Then 스터디 일정 › 출석 탭에서 내 분반 전원의 회차별 출석 조회
    # 부분 실행 근거: my-joined-attendance--crew

  @CORE-ST-010-S02 @catalog-partial
  Scenario: CORE-ST-010-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 다섯 출석 상태가 있는 격자에서 변경을 시도한다
    Then 칸은 출석·지각·결석·휴가·미체크 — 크루는 변경 불가
    # 부분 실행 근거: my-joined-attendance--crew

  @CORE-ST-010-S03 @catalog-partial
  Scenario: CORE-ST-010-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 발표자 배정 회차와 발표 횟수를 확인하고 제목 옆 설명을 연다
    Then 발표 맡은 회차에 발표 표시, 발표 횟수 열. 제목 옆 「?」 로 발표 표시 설명
    # 부분 실행 근거: my-joined-attendance--presenter-help

  @CORE-ST-010-S04
  Scenario: CORE-ST-010-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 킥오프와 정규 회차의 출석 상태가 다른 참여자의 출석률을 확인한다
    Then 참여자별 출석률 — 킥오프 제외

  @CORE-ST-010-S05 @catalog-partial
  Scenario: CORE-ST-010-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 캡틴·네비게이터·크루의 이름과 디스코드 열을 확인한다
    Then 닉네임 옆 칩으로 캡틴·네비게이터 구분. 옆 열에 디스코드 닉네임
    # 부분 실행 근거: my-joined-attendance--crew

  @CORE-ST-010-S06
  Scenario: CORE-ST-010-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여 중단자가 포함된 출석부를 연다
    Then 참여 중단자는 흐린 이름과 「참여 중단」 칩으로 맨 아래

  @CORE-ST-010-S07
  Scenario: CORE-ST-010-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회차 없는 분반의 출석 탭을 연다
    Then 회차 없을 때 안내

  @CORE-ST-010-S08
  Scenario: CORE-ST-010-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 다른 분반과 미참여 스터디의 출석 주소에 접근한다
    Then 다른 분반·스터디 출석부 접근 불가

  @CORE-ST-010-V01 @catalog-partial
  Scenario: CORE-ST-010-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 출석부 격자 (보기만) / —
    # 부분 실행 근거: my-joined-attendance--crew

  @CORE-ST-010-V02
  Scenario: CORE-ST-010-V02 회차 없음
    Given 대상 화면이 PRD의 「회차 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 격자 대신 안내 / `아직 회차가 없습니다.` · `회차가 생기면 출석부가 보입니다.`

  @CORE-ST-010-V03
  Scenario: CORE-ST-010-V03 불러오는 중
    Given 대상 화면이 PRD의 「불러오는 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 격자 자리 로딩 / —

  @CORE-ST-010-V04
  Scenario: CORE-ST-010-V04 불러오기 실패
    Given 대상 화면이 PRD의 「불러오기 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 격자 자리 안내 · 다시 시도 / `출석부를 불러오지 못했습니다.`

  @CORE-ST-010-V05
  Scenario: CORE-ST-010-V05 볼 수 없음
    Given 대상 화면이 PRD의 「볼 수 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 안내만 / `이 스터디의 일정을 볼 수 없습니다`

