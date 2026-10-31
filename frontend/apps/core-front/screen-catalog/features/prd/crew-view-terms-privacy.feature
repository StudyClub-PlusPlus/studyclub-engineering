# PRD: 01-planning/stories/crew-view-terms-privacy/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: PRD 개발 범위의 /terms·/privacy 미구현 표기는 현재 코드와 다르다. 두 경로와 푸터 링크가 존재한다. 처리방침 초안값·문안 확정과 표의 실제 가로 스크롤 동작은 스크린샷만으로 완료 판정하지 않는다.
@planned @ST-014
Feature: ST-014 크루는 이용약관과 개인정보처리방침을 확인할 수 있다.

  @CORE-ST-014-S01
  Scenario: CORE-ST-014-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 각 화면의 푸터에서 약관·처리방침 링크를 누른다
    Then 모든 화면 하단에서 약관·처리방침 열기

  @CORE-ST-014-S02 @catalog-partial
  Scenario: CORE-ST-014-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 비로그인 상태로 두 문서에 직접 접근한다
    Then 미로그인 열람
    # 부분 실행 근거: terms--default, privacy--default

  @CORE-ST-014-S03
  Scenario: CORE-ST-014-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 푸터의 처리방침 링크와 다른 링크의 표시를 비교한다
    Then 처리방침 링크는 다른 링크와 구분

  @CORE-ST-014-S04 @catalog-partial
  Scenario: CORE-ST-014-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 두 문서의 개정일과 시행일을 확인한다
    Then 문서별 최종 개정일·시행일 표기
    # 부분 실행 근거: terms--default, privacy--default

  @CORE-ST-014-S05 @catalog-partial
  Scenario: CORE-ST-014-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 문서 전문을 끝까지 읽는다
    Then 장·조항 단위 전문 열람
    # 부분 실행 근거: terms--default, privacy--default

  @CORE-ST-014-S06 @catalog-partial
  Scenario: CORE-ST-014-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 약관 원문에서 강조한 조항의 표시를 확인한다
    Then 원문 강조 유지
    # 부분 실행 근거: terms--default

  @CORE-ST-014-S07 @catalog-partial
  Scenario: CORE-ST-014-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 모바일에서 처리방침 표를 가로로 스크롤한다
    Then 좁은 화면에서 표의 열 대응 유지
    # 부분 실행 근거: privacy--default

  @CORE-ST-014-V01 @catalog-partial
  Scenario: CORE-ST-014-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 제목 · 개정일 · 도입부 · 본문 / —
    # 부분 실행 근거: terms--default, privacy--default

  @CORE-ST-014-V02 @catalog-partial
  Scenario: CORE-ST-014-V02 en 로케일
    Given 대상 화면이 PRD의 「en 로케일」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 제목만 영문, 본문 한국어 / `Terms of Service`
    # 부분 실행 근거: terms--english

