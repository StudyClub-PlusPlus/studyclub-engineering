# PRD: 01-planning/stories/crew-view-notices/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: 현재 공지 빈 목록은 서버 API의 로컬 DB 상태에 의존한다. 빈 안내 문구 assertion을 추가했지만 독립 fixture는 아니다. 목록 있음·상세·오류·404는 아직 카탈로그에 연결하지 않았다.
@planned @ST-034
Feature: ST-034 크루는 스터디클럽 공지를 확인할 수 있다.

  @CORE-ST-034-S01
  Scenario: CORE-ST-034-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 비로그인으로 사이트 헤더의 공지를 누른다
    Then 사이트 헤더 「공지」에서 목록으로 진입 — 로그인 없이

  @CORE-ST-034-S02
  Scenario: CORE-ST-034-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 11건 이상 공지 목록을 열어 다음 페이지와 상세를 선택한다
    Then 목록 — 제목 · 게시일. 게시일 내림차순 고정, 10건씩. 줄을 누르면 상세

  @CORE-ST-034-S03
  Scenario: CORE-ST-034-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 공지 상세를 연다
    Then 상세 — 제목 · 게시일 · 본문

  @CORE-ST-034-S04
  Scenario: CORE-ST-034-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When HTML 모양 문자·줄바꿈·공백·URL이 있는 공지 본문을 연다
    Then 본문은 평문 — 줄바꿈·공백 보존, HTML 로 해석하지 않음, 본문 속 URL 은 링크

  @CORE-ST-034-S05
  Scenario: CORE-ST-034-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 첫·중간·마지막 공지에서 이전·다음 링크를 누른다
    Then 상세 아래 이전·다음 공지 — 이동할 공지의 제목 표시, 끝에서는 비활성

  @CORE-ST-034-S06
  Scenario: CORE-ST-034-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 상세 아래 목록으로를 누른다
    Then 상세 아래 「목록으로」

  @CORE-ST-034-S07
  Scenario: CORE-ST-034-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 삭제된 공지를 목록·이전다음·직접 주소로 조회한다
    Then 삭제된 공지는 목록·상세·이전다음 어디에도 없음 — 주소로 들어오면 404

  @CORE-ST-034-S08
  Scenario: CORE-ST-034-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 공지 목록과 상세의 작성자 노출 여부를 확인한다
    Then 작성자 비노출

  @CORE-ST-034-V01
  Scenario: CORE-ST-034-V01 불러오는 중
    Given 대상 화면이 PRD의 「불러오는 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 목록 · 본문 자리 스켈레톤 / —

  @CORE-ST-034-V02
  Scenario: CORE-ST-034-V02 목록 있음
    Given 대상 화면이 PRD의 「목록 있음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 제목 · 게시일 줄 / —

  @CORE-ST-034-V03 @catalog-partial
  Scenario: CORE-ST-034-V03 공지 없음
    Given 대상 화면이 PRD의 「공지 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 빈 카드 / `등록된 공지가 없습니다.`
    # 부분 실행 근거: notice-list--empty

  @CORE-ST-034-V04
  Scenario: CORE-ST-034-V04 오류
    Given 대상 화면이 PRD의 「오류」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 안내와 다시 시도 / `공지를 불러오지 못했습니다. 다시 시도해 주세요.` · `다시 시도`

  @CORE-ST-034-V05
  Scenario: CORE-ST-034-V05 404
    Given 대상 화면이 PRD의 「404」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 삭제된 공지 · 없는 id / 사이트 공통 404

