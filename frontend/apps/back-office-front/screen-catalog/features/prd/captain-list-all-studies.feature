# PRD: 01-planning/stories/captain-list-all-studies/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
# 현재 코드 기준: 같은 열은 오름→내림→오름 반복, 다른 열은 오름부터 시작한다. 기본 모집 상태 오름은 내부 값 all로 표현하며 정렬 해제 단계가 아니다. 근거: src/features/studies/list-filters.ts nextSortFor 및 list-filters.test.ts.
@planned @ST-022 @code-baseline
Feature: ST-022 캡틴은 모든 스터디의 리스트를 볼 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-022-S01 @AC-1 @AC-2 @AC-3 @AC-7 @AC-9
  Scenario: BO-ST-022-S01 목록 열과 값
    When 정원 유무와 작성자 유무가 다른 스터디 목록을 연다
    Then 한 행에서 카테고리·시간대·모집 일정·모집 상태·지원 현황·시작일·신청 폼·공개 상태·작성자 조회
    And 지원 현황 — 현재 인원 / 정원. 정원 없으면 「제한 없음」
    And 작성자 열 — 기록 없으면 「—」
    And 열 순서는 고정 — 끌어서 바꾸지 않음
    And 출석률은 목록에 두지 않음

  @BO-ST-022-S02 @AC-4 @AC-5
  Scenario: BO-ST-022-S02 목록 검색과 필터
    When 검색어와 각 필터를 바꾸고 조건을 조합한다
    Then 검색·카테고리·상태·모집·공개·신청 폼 필터
    And 신청 폼 드롭다운 — 있음 · 없음

  @BO-ST-022-S03 @AC-6 @AC-8
  Scenario: BO-ST-022-S03 정렬과 페이징
    When 21건 이상인 목록의 2페이지에서 열을 정렬하고 검색 조건을 바꾼다
    Then 기본은 모집 상태 오름차순이며 같은 열은 오름차순·내림차순을 반복하고 정렬 해제 단계는 없다
    And 다른 열을 누르면 그 열의 오름차순으로 바뀐다
    And 한 페이지 20개, 필터·검색·정렬 변경 시 1페이지로

  @BO-ST-022-V01
  Scenario: BO-ST-022-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 기본 순서로 첫 페이지 / 「N개」

  @BO-ST-022-V02
  Scenario: BO-ST-022-V02 빈 결과
    Given 대상 화면이 PRD의 "빈 결과" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 필터·검색에 걸린 스터디가 없음 / 「조건에 맞는 스터디가 없습니다.」

