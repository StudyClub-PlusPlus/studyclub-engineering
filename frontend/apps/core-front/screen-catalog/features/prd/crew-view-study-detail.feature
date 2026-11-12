# PRD: 01-planning/stories/crew-view-study-detail/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: 없는 주소의 PRD 카피는 영문 기본 404지만 현재 상세는 「스터디를 찾을 수 없어요」를 표시한다. 현재 문구를 assertion으로 사용한다. 비공개 접근 차단은 별도 응답 조건 검증이 필요하다.
@planned @ST-007
Feature: ST-007 크루는 스터디 상세 정보를 볼 수 있다.

  @CORE-ST-007-S01 @catalog-partial
  Scenario: CORE-ST-007-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 공개 스터디 상세를 연다
    Then 공개 스터디 상세 조회 — 제목·한 줄 소개·카테고리·모집 상태·일정 또는 시간대·시작 예정일
    # 부분 실행 근거: study-detail--recruiting

  @CORE-ST-007-S02
  Scenario: CORE-ST-007-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 소개가 있는 상세와 없는 상세를 각각 연다
    Then 상세 소개 있을 때만 본문 노출

  @CORE-ST-007-S03 @catalog-partial @code-baseline
  Scenario: CORE-ST-007-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 잘못된 ID와 비공개 스터디 ID로 상세에 접근한다
    Then 잘못된 키·비공개 스터디는 상세 열리지 않음
    # 부분 실행 근거: study-detail--not-found

  @CORE-ST-007-S04
  Scenario: CORE-ST-007-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 목록·신청·내 스터디 등 각 진입 링크의 상세 식별자를 확인한다
    Then 진입 경로 전부 `study_id` 키 사용

  @CORE-ST-007-S05
  Scenario: CORE-ST-007-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 같은 스터디의 목록과 상세 모집 상태를 비교한다
    Then 모집 상태 문구는 목록과 동일

  @CORE-ST-007-S06
  Scenario: CORE-ST-007-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 시작 예정일이 없는 상세를 연다
    Then 시작 예정일 없으면 「미정」

  @CORE-ST-007-S07
  Scenario: CORE-ST-007-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 상세에서 스터디 목록으로 돌아가기를 누른다
    Then 스터디 목록으로 돌아가기

  @CORE-ST-007-S08
  Scenario: CORE-ST-007-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 모집중·마감·기신청 상태별로 신청 CTA를 누른다
    Then 모집중이면 신청 흐름 시작 — 마감·기신청은 차단

  @CORE-ST-007-V01 @catalog-partial
  Scenario: CORE-ST-007-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 / 제목·한 줄 소개·분야·모집 상태·시작 예정일
    # 부분 실행 근거: study-detail--recruiting

  @CORE-ST-007-V02
  Scenario: CORE-ST-007-V02 소개 없음
    Given 대상 화면이 PRD의 「소개 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 소개 절 없음 / —

  @CORE-ST-007-V03
  Scenario: CORE-ST-007-V03 시작일 없음
    Given 대상 화면이 PRD의 「시작일 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 시작 예정일 / `시작 예정일 미정`

  @CORE-ST-007-V04 @catalog-partial
  Scenario: CORE-ST-007-V04 모집 마감
    Given 대상 화면이 PRD의 「모집 마감」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 / `모집 마감`
    # 부분 실행 근거: study-detail--ongoing

  @CORE-ST-007-V05
  Scenario: CORE-ST-007-V05 이미 신청
    Given 대상 화면이 PRD의 「이미 신청」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 / `신청 완료`

  @CORE-ST-007-V06 @catalog-partial @code-baseline
  Scenario: CORE-ST-007-V06 없는 주소
    Given 대상 화면이 PRD의 「없는 주소」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 찾을 수 없음 / `This page could not be found.`
    # 부분 실행 근거: study-detail--not-found

