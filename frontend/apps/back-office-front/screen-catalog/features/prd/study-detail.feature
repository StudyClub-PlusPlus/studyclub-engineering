# PRD: 01-planning/stories/study-detail/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
# 현재 코드 기준: 정보·신청 폼·신청 결과·신청자·일정·출석 6개 탭. 탭 옆 저장 전 문구 없이 출석 칸 테두리와 aria-label로 변경을 표시하고 이탈 전에 묻는다. 근거: src/components/StudyConsole.tsx, src/features/attendance/AttendanceBook.tsx.
@planned @ST-003 @code-baseline
Feature: ST-003 캡틴은 개별 스터디의 운영 현황을 볼 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-003-S01 @AC-1 @AC-2
  Scenario: BO-ST-003-S01 상세 헤더 상태
    When 모집중과 미공개 스터디를 각각 연다
    Then 상단에서 스터디명·모집 상태 확인 — 남은 일수 포함
    And 미공개 스터디는 상단에 그 사실 표기

  @BO-ST-003-S02 @AC-3 @AC-6
  Scenario: BO-ST-003-S02 탭 전환과 목록 복귀
    When 각 탭을 전환한 다음 목록으로 돌아간다
    # PRD AC-3의 다섯 탭 대신 현재 코드의 여섯 탭을 기준으로 한다.
    Then 정보·신청 폼·신청 결과·신청자·일정·출석 여섯 탭을 전환할 수 있고 현재 탭이 표시된다
    And 목록으로 돌아가기

  @BO-ST-003-S03 @AC-4
  Scenario: BO-ST-003-S03 출석 변경 후 이탈
    When 출석을 고친 뒤 다른 탭을 누른다
    Then 출석 탭 미저장 변경 시 탭 이동 전 경고

  @BO-ST-003-S04 @AC-5
  Scenario: BO-ST-003-S04 클럽의 다음 기수 진입
    When 클럽 상세에서 다음 기수 만들기를 누른다
    Then 클럽은 이 화면에서 다음 기수 생성

  @BO-ST-003-V01
  Scenario: BO-ST-003-V01 모집중
    Given 대상 화면이 PRD의 "모집중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 헤더에 「모집중 · D-N」

  @BO-ST-003-V02
  Scenario: BO-ST-003-V02 오늘 마감
    Given 대상 화면이 PRD의 "오늘 마감" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 헤더에 「오늘 마감」 — 아직 신청을 받는다

# 실행 카탈로그(표시 상태 일부): study-detail--closed
  @BO-ST-003-V03 @catalog-partial
  Scenario: BO-ST-003-V03 모집 마감
    Given 대상 화면이 PRD의 "모집 마감" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 헤더에 「모집 마감」

# 실행 카탈로그(표시 상태 일부): study-detail--unpublished
  @BO-ST-003-V04 @catalog-partial
  Scenario: BO-ST-003-V04 미공개
    Given 대상 화면이 PRD의 "미공개" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 모집 상태 옆에 「미공개」

  @BO-ST-003-V05
  Scenario: BO-ST-003-V05 출석 저장 전
    Given 대상 화면이 PRD의 "출석 저장 전" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    # PRD의 탭 옆 문구 대신 현재 출석부의 변경 표시를 기준으로 한다.
    Then 출석 탭 이름 옆에 "저장 전" 문구는 보이지 않는다
    And 고친 출석 칸은 상태 색 테두리와 "저장되지 않음" 접근성 이름으로 구분된다
    And 다른 탭으로 이동하면 저장하지 않은 변경 확인 창이 열린다

