# PRD: 01-planning/stories/crew-browse-studies/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-006
Feature: ST-006 크루는 스터디를 키워드로 검색하고 카테고리별로 나눠 볼 수 있다.

  @CORE-ST-006-S01 @catalog-partial
  Scenario: CORE-ST-006-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 비로그인으로 공개 스터디 목록을 연다
    Then 로그인 없이 전체 공개 스터디 조회
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S02
  Scenario: CORE-ST-006-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 검색어·모집 상태·시간대·카테고리를 함께 설정한다
    Then 검색어·모집 상태·시간대·카테고리 동시 적용

  @CORE-ST-006-S03
  Scenario: CORE-ST-006-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 검색어 유무별로 결과 없는 조건을 만들고 검색어 지우기를 누른다
    Then 결과 없음 안내 — 검색어가 있으면 지우기 버튼

  @CORE-ST-006-S04 @catalog-partial
  Scenario: CORE-ST-006-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 목록 카드의 버튼과 링크를 확인한다
    Then 카드에 신청·찜 버튼 없음 — 상세로 이동 후 처리
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S05 @catalog-partial
  Scenario: CORE-ST-006-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 모집중·진행중·모집 마감 카드의 상단 배지를 확인한다
    Then 카드 상단 모집 상태 배지 — 모집중(D-N) · 진행중 · 모집 마감
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S06 @catalog-partial
  Scenario: CORE-ST-006-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 시작 예정일 유무가 다른 카드를 확인한다
    Then 카드 본문에 시작 예정일 — 값이 없으면 「미정」
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S07 @catalog-partial
  Scenario: CORE-ST-006-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When KST·PST·동시 모집 스터디의 카드를 확인한다
    Then 카드에 진행 시간대 표기 (KST · PST · 동시 모집)
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S08 @catalog-partial
  Scenario: CORE-ST-006-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 생성 시점이 다른 목록에서 정렬 컨트롤과 카드 순서를 확인한다
    Then 정렬 컨트롤 없음 — 최신순 고정
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-S09
  Scenario: CORE-ST-006-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 스터디 카드를 누른다
    Then 카드 클릭 시 스터디 상세로 이동

  @CORE-ST-006-V01 @catalog-partial
  Scenario: CORE-ST-006-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 카드 그리드 / —
    # 부분 실행 근거: study-list--default

  @CORE-ST-006-V02
  Scenario: CORE-ST-006-V02 필터 결과 없음(검색어 없음)
    Given 대상 화면이 PRD의 「필터 결과 없음(검색어 없음)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 빈 상태 / 조건에 맞는 스터디가 없다는 안내

  @CORE-ST-006-V03
  Scenario: CORE-ST-006-V03 검색 결과 없음
    Given 대상 화면이 PRD의 「검색 결과 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 빈 상태 + 지우기 버튼 / `"{검색어}"에 해당하는 스터디를 찾을 수 없어요` / `검색어 지우기`

  @CORE-ST-006-V04
  Scenario: CORE-ST-006-V04 비공개 스터디
    Given 대상 화면이 PRD의 「비공개 스터디」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then — / 목록에 노출하지 않는다(서버·빌드 판정)

