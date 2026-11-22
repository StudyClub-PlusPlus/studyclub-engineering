# PRD: 01-planning/stories/study-edit/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-004
Feature: ST-004 캡틴은 등록된 스터디를 수정·삭제할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-004-S01 @AC-1 @AC-2 @AC-4 @AC-6
  Scenario: BO-ST-004-S01 정보 수정과 저장
    When 기존 스터디 정보를 고쳐 저장하고 사용자 사이트에서 확인한다
    Then 정보 탭에서 등록 항목 수정
    And 저장 시 사용자 사이트 목록·상세 반영
    And 저장 완료 표시
    And 소속 프로그램 표시 — 연결은 변경 불가

  @BO-ST-004-S02 @AC-3
  Scenario: BO-ST-004-S02 정보 검증 실패
    When 필수값을 비우거나 입력 범위를 벗어나 저장한다
    Then 등록과 같은 검증 — 실패 시 저장 차단 및 칸별 오류

  @BO-ST-004-S03 @AC-5
  Scenario: BO-ST-004-S03 삭제 확인과 영향 안내
    When 정보 탭에서 삭제를 누른다
    Then 삭제는 확인 후 실행 — 함께 사라지는 것 사전 고지

  @BO-ST-004-V01
  Scenario: BO-ST-004-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 저장된 값이 채워진 폼 / —

# 실행 카탈로그(표시 상태 일부): study-detail--edit-invalid
  @BO-ST-004-V02 @catalog-partial
  Scenario: BO-ST-004-V02 검증 실패
    Given 대상 화면이 PRD의 "검증 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 해당 칸에 오류와 문구 / 「제목을 입력하세요.」 / 「한 줄 소개를 입력하세요.」 / 「카테고리를 선택하세요.」 / 「모집 마감일을 고르세요.」 / 「60자 이내로 입력하세요.」

  @BO-ST-004-V03
  Scenario: BO-ST-004-V03 처리중
    Given 대상 화면이 PRD의 "처리중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 저장·삭제 모두 비활성 / —

  @BO-ST-004-V04
  Scenario: BO-ST-004-V04 저장 완료
    Given 대상 화면이 PRD의 "저장 완료" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 저장 버튼 옆에 안내 / 「저장되었습니다.」

# 실행 카탈로그(표시 상태 일부): study-detail--delete-confirm
  @BO-ST-004-V05 @catalog-partial
  Scenario: BO-ST-004-V05 삭제 확인
    Given 대상 화면이 PRD의 "삭제 확인" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 확인 창 / 「'{스터디명}' 스터디를 삭제합니다.」 / 「크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.」

