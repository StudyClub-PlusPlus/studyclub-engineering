# PRD: 01-planning/stories/captain-list-users/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-028
Feature: ST-028 캡틴은 전체 회원 리스트를 조회할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-028-S01 @AC-1 @AC-2 @AC-6
  Scenario: BO-ST-028-S01 회원 목록과 휴면
    When 탈퇴 회원과 참여 스터디 없는 회원이 포함된 데이터를 조회한다
    Then 가입 회원 전체 조회 — 탈퇴 회원 제외
    And 이름·이메일·권한·담당 스터디·가입일 표기
    And 참여 스터디 없는 회원은 휴면 구분

  @BO-ST-028-S02 @AC-3 @AC-4 @AC-5 @AC-7
  Scenario: BO-ST-028-S02 회원 검색 필터 페이징
    When 21명 이상인 목록에서 역할 필터·검색어·페이지를 바꾼다
    Then 전체·캡틴·네비게이터·크루 필터
    And 이름·이메일 검색
    And 걸러진 인원 수 표시
    And 20명씩 페이지 이동

# 실행 카탈로그(표시 상태 일부): user-list--default
  @BO-ST-028-V01 @catalog-partial
  Scenario: BO-ST-028-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 탭 · 검색 · 목록 / 인원 수

  @BO-ST-028-V02
  Scenario: BO-ST-028-V02 휴면
    Given 대상 화면이 PRD의 "휴면" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 이름 칸 / `휴면`

# 실행 카탈로그(표시 상태 일부): user-list--empty
  @BO-ST-028-V03 @catalog-partial
  Scenario: BO-ST-028-V03 검색 결과 없음
    Given 대상 화면이 PRD의 "검색 결과 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 인원 0 / —

