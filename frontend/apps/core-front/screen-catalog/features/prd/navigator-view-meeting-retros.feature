# PRD: 01-planning/stories/navigator-view-meeting-retros/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다. 연결된 표시 상태는 .meta.ts 가 실행한다.
# 현재 코드 기준: 네비게이터는 11번, 담당 캡틴은 1번 스터디(개발 MSW 목).
@planned @ST-040
Feature: ST-040 네비게이터는 반의 회차별 회고 작성 현황을 볼 수 있다.

# 실행 카탈로그(표시 상태 일부): my-joined-retro--navigator
  @CORE-ST-040-S01 @catalog-partial
  Scenario: CORE-ST-040-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 네비게이터 · 캡틴 · 크루로 같은 회차의 회고 탭을 연다
    Then 회고 탭 작성 현황 — 참여자마다 작성 · 미작성 구분, 「n명 중 m명 작성」 (크루에게는 둘 다 보이지 않는다)

# 실행 카탈로그(표시 상태 일부): my-joined-retro--navigator
  @CORE-ST-040-S02 @catalog-partial
  Scenario: CORE-ST-040-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 👍 수가 다른 답이 있는 회차를 네비게이터로 연다
    Then 문항별 보기의 👍 많은 순 정렬 (크루와 같다)

# 실행 카탈로그(표시 상태 일부): my-joined-retro--navigator
  @CORE-ST-040-S03 @catalog-partial
  Scenario: CORE-ST-040-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 네비게이터로 본인 회고를 쓰고 고친다
    Then 네비게이터 본인의 회고 작성 · 수정 (크루와 같은 규칙)

# 실행 카탈로그(표시 상태 일부): my-joined-retro--captain
  @CORE-ST-040-S04 @catalog-partial
  Scenario: CORE-ST-040-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 담당 캡틴으로 회고 탭과 작성 주소를 연다
    Then 캡틴에게는 작성 버튼이 없다 — 미팅 참여자가 아니라 쓰지 않는다

# 실행 카탈로그(표시 상태 일부): my-joined-retro--navigator
  @CORE-ST-040-V01 @catalog-partial
  Scenario: CORE-ST-040-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 회고 탭 작성 현황 / 「n명 중 m명 작성」 · 참여자마다 「작성」 · 「미작성」

  @CORE-ST-040-V02
  Scenario: CORE-ST-040-V02 권한 없음
    Given 대상 화면이 PRD의 「권한 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 캡틴이 작성 페이지를 열었을 때 / 「캡틴은 미팅 참여자가 아니라 회고를 쓰지 않아요.」
