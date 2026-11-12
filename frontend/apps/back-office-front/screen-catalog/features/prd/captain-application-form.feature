# PRD: 01-planning/stories/captain-application-form/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
@planned @ST-023
Feature: ST-023 캡틴은 스터디 신청용 폼을 작성할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-023-S01 @AC-1 @AC-2 @AC-3 @AC-4 @AC-5
  Scenario: BO-ST-023-S01 신청 폼 편집과 고정 문항
    When 폼 제목과 설명을 고치고 질문을 추가·재정렬한 뒤 지원자 화면을 연다
    Then 설문 제목·설명 작성, 추가 질문 생성 및 순서 변경
    And 질문 설명 여러 줄 입력 — 마크다운이 지원자 화면에 그대로
    And 편집 카드가 지원자 화면과 같은 모양 — 별도 미리보기 없음
    And 디스코드 서버 별명 문항 고정 — 삭제·타입 변경 불가
    And 이름·이메일 문항 없음

  @BO-ST-023-S02 @AC-6 @AC-8 @AC-9
  Scenario: BO-ST-023-S02 최초 폼과 저장
    When 폼 없는 기수에서 기본 문항만 저장하고 다시 조회한다
    Then 저장 시 해당 기수 폼 반영 및 「저장되었습니다.」
    And 추가 질문 없이도 저장 — 지원자는 기본 문항만
    And 저장된 폼이 없어도 탭 열림 — 기수 제목·소개와 기본 질문 표시

  @BO-ST-023-S03 @AC-7 @AC-12
  Scenario: BO-ST-023-S03 수정 권한과 모집 잠금
    When 담당 캡틴·다른 캡틴·네비게이터·크루로 접근하고 모집 시작 전후에 편집한다
    Then 신청이 들어왔거나 모집 시작 시각이 지나면 수정 차단
    And 권한 — 담당 캡틴만 수정, 다른 캡틴은 조회. 네비게이터·크루는 백오피스 진입 불가

  @BO-ST-023-S04 @AC-10
  Scenario: BO-ST-023-S04 입력 길이와 접힌 카드
    When 제목과 설명 경계값을 입력한 뒤 카드를 접는다
    Then 입력 길이 상한, 접힌 카드의 제목·설명은 줄바꿈으로 전부 표시

  @BO-ST-023-S05 @AC-11
  Scenario: BO-ST-023-S05 조회와 저장 오류
    When 조회 지연·조회 실패·저장 실패·권한 없음 응답을 각각 재현한다
    Then 불러오기·저장 실패와 권한 없음 안내. 조회 완료 전 저장 차단

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-loading
  @BO-ST-023-V01 @catalog-partial
  Scenario: BO-ST-023-V01 로딩
    Given 대상 화면이 PRD의 "로딩" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 신청 폼 탭 / `불러오는 중`. 저장 불가

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-read-error
  @BO-ST-023-V02 @catalog-partial
  Scenario: BO-ST-023-V02 조회 실패
    Given 대상 화면이 PRD의 "조회 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`. 저장 불가

  @BO-ST-023-V03
  Scenario: BO-ST-023-V03 미로그인
    Given 대상 화면이 PRD의 "미로그인" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 콘솔 로그인 / 로그인 화면 카피. `next` = 이 탭

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-forbidden
  @BO-ST-023-V04 @catalog-partial
  Scenario: BO-ST-023-V04 권한 없음
    Given 대상 화면이 PRD의 "권한 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `이 스터디의 신청 폼을 고칠 권한이 없습니다.` 저장·삭제·순서 변경 없음

  @BO-ST-023-V05
  Scenario: BO-ST-023-V05 첫 진입 · 폼 없음
    Given 대상 화면이 PRD의 "첫 진입 · 폼 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / 기수 제목·한 줄 소개 · 기본 질문 · `질문 추가`

  @BO-ST-023-V06
  Scenario: BO-ST-023-V06 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / 제목·설명·기본 질문·추가 질문

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-empty
  @BO-ST-023-V07 @catalog-partial
  Scenario: BO-ST-023-V07 추가 질문 없음
    Given 대상 화면이 PRD의 "추가 질문 없음" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / 제목·설명·기본 질문 · `질문 추가`

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-editing
  @BO-ST-023-V08 @catalog-partial
  Scenario: BO-ST-023-V08 편집 중
    Given 대상 화면이 PRD의 "편집 중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 선택한 카드 / 제목·타입·설명·선택지·필수

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-invalid
  @BO-ST-023-V09 @catalog-partial
  Scenario: BO-ST-023-V09 검증 실패
    Given 대상 화면이 PRD의 "검증 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 해당 카드 / `질문 제목을 입력해 주세요.` / `선택지를 하나 이상 넣어 주세요.`

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-saving
  @BO-ST-023-V10 @catalog-partial
  Scenario: BO-ST-023-V10 처리중
    Given 대상 화면이 PRD의 "처리중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 저장 버튼 / `저장`. 다시 누르지 못함. 닫기 불가

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-saved
  @BO-ST-023-V11 @catalog-partial
  Scenario: BO-ST-023-V11 완료
    Given 대상 화면이 PRD의 "완료" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `저장되었습니다.`

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-save-error
  @BO-ST-023-V12 @catalog-partial
  Scenario: BO-ST-023-V12 저장 실패
    Given 대상 화면이 PRD의 "저장 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `저장하지 못했습니다. 다시 시도해 주세요.` `다시 시도`

# 실행 카탈로그(표시 상태 일부): study-detail--application-form-locked
  @BO-ST-023-V13 @catalog-partial
  Scenario: BO-ST-023-V13 잠금
    Given 대상 화면이 PRD의 "잠금" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 같은 탭 / `모집이 시작되어 신청 폼을 수정할 수 없습니다.` 연필·추가·삭제·저장 불가

