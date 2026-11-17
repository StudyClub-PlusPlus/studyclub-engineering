# PRD: 01-planning/stories/captain-reregister-cohort/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-021
Feature: ST-021 캡틴은 기존 스터디를 재등록할 수 있다(기수제).

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

# 실행 카탈로그(표시 상태 일부): study-detail--next-cohort
  @BO-ST-021-S01 @AC-1 @AC-2 @AC-3 @AC-4 @catalog-partial
  Scenario: BO-ST-021-S01 다음 기수 창 초기값
    When 클럽 상세에서 다음 기수 창을 열고 일반 스터디와 비교한다
    Then 클럽 운영 화면에서 다음 기수 생성 — 스터디 종류에는 없음
    And 등록 창의 「기존 클럽의 새 기수」와 같은 결과
    And 새 기수 창은 프로그램 고정, 제목·소개·설명·카테고리 자동 채움
    And 모집 마감일·진행 일정·정원은 비움 — 기수마다 재지정

  @BO-ST-021-S02 @AC-5 @AC-6
  Scenario: BO-ST-021-S02 기수 저장과 이전 기수 보존
    When 자동 채움 값을 수정해 새 기수를 저장하고 이전 기수를 다시 연다
    Then 채운 값 수정이 지난 기수에 영향 없음
    And 새 기수는 같은 프로그램 아래 미공개로 저장

  @BO-ST-021-V01
  Scenario: BO-ST-021-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 최신 기수 값이 채워진 창 / —

  @BO-ST-021-V02
  Scenario: BO-ST-021-V02 검증 실패
    Given 대상 화면이 PRD의 "검증 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 칸별 오류 / 신규 등록과 같은 문구

  @BO-ST-021-V03
  Scenario: BO-ST-021-V03 처리중
    Given 대상 화면이 PRD의 "처리중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 등록 잠김 / —

  @BO-ST-021-V04
  Scenario: BO-ST-021-V04 완료
    Given 대상 화면이 PRD의 "완료" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 완료 화면 / —

