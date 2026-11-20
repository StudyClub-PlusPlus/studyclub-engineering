# PRD: 01-planning/stories/captain-application-results/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-024
Feature: ST-024 캡틴은 스터디 신청서 결과를 모아볼 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-024-S01 @AC-1 @AC-2 @AC-3 @AC-4 @AC-5
  Scenario: BO-ST-024-S01 질문별과 응답자별 조회
    When 추가 질문과 신청이 있는 기수에서 두 보기를 전환한다
    Then 신청 결과 탭에서 추가 질문 응답 조회
    And 응답 인원 「응답자 N명」 표기
    And 질문별·응답자별 전환 — 기본은 질문별
    And 질문별 보기에는 응답자를 붙이지 않음 — 인원과 답 내용만
    And 응답자별 보기 — 디스코드 별명·이메일·질문별 답을 한 행으로

  @BO-ST-024-S02 @AC-6 @AC-7
  Scenario: BO-ST-024-S02 질문 또는 신청 없음
    When 추가 질문 없는 기수와 신청 없는 기수를 각각 연다
    Then 추가 질문 없을 때 안내. 모집 시작 전에는 신청 폼 탭에서 질문 추가
    And 신청 없을 때 「아직 들어온 신청이 없습니다.」

  @BO-ST-024-S03 @AC-8 @AC-9
  Scenario: BO-ST-024-S03 조회 권한과 실패
    When 담당 여부·세션 만료·조회 실패 조건으로 신청 결과를 연다
    Then 조회 전용 — 신청 수정·삭제 없음. 담당 기수만 열람
    And 불러오기 실패·미로그인 안내

  @BO-ST-024-S04 @AC-10
  Scenario: BO-ST-024-S04 긴 답변 표시
    When 긴 선택지·별명·이메일·여러 줄 답변이 있는 결과를 연다
    Then 긴 선택지·별명·이메일은 한 줄 말줄임, 답 본문은 줄바꿈으로 전부

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-loading
  @BO-ST-024-V01 @catalog-partial
  Scenario: BO-ST-024-V01 로딩
    Given 대상 화면이 PRD의 "로딩" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 신청 결과 탭 / `불러오는 중`

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-error
  @BO-ST-024-V02 @catalog-partial
  Scenario: BO-ST-024-V02 조회 실패
    Given 대상 화면이 PRD의 "조회 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `결과를 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`

  @BO-ST-024-V03
  Scenario: BO-ST-024-V03 미로그인
    Given 대상 화면이 PRD의 "미로그인" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 콘솔 로그인 / 로그인 화면 카피. `next` = 이 탭

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-forbidden
  @BO-ST-024-V04 @catalog-partial
  Scenario: BO-ST-024-V04 권한 없음
    Given 대상 화면이 PRD의 "권한 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `이 스터디의 신청 결과를 볼 권한이 없습니다.`

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-no-questions
  @BO-ST-024-V05 @catalog-partial
  Scenario: BO-ST-024-V05 추가 질문 없음
    Given 대상 화면이 PRD의 "추가 질문 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `이 스터디는 신청 폼에 추가 질문이 없습니다.`

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-empty
  @BO-ST-024-V06 @catalog-partial
  Scenario: BO-ST-024-V06 신청 없음
    Given 대상 화면이 PRD의 "신청 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `아직 들어온 신청이 없습니다.`

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-summary
  @BO-ST-024-V07 @catalog-partial
  Scenario: BO-ST-024-V07 질문별
    Given 대상 화면이 PRD의 "질문별" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `응답자 N명` · `질문별`

# 실행 카탈로그(표시 상태 일부): study-detail--application-results-individual
  @BO-ST-024-V08 @catalog-partial
  Scenario: BO-ST-024-V08 응답자별
    Given 대상 화면이 PRD의 "응답자별" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `응답자 N명` · `응답자별`

  @BO-ST-024-V09
  Scenario: BO-ST-024-V09 그 질문 답 없음
    Given 대상 화면이 PRD의 "그 질문 답 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 질문별 묶음 / `아직 답이 없습니다.`

