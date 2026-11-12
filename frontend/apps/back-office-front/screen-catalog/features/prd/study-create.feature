# PRD: 01-planning/stories/study-create/PRD.md
# 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md
# 자동화 예정 명세. 이 파일만으로 실행·검증된 것으로 보지 않는다.
# 현재 코드 기준: 제목 권장 24자·소개 권장 25자는 경고만 표시한다. 제목은 trim().length > 60일 때 프론트 제출을 차단한다. PRD의 폭 40 기준과는 다르다. 근거: src/components/StudyForm.tsx (TITLE_RECOMMENDED, SUMMARY_RECOMMENDED, validateStudyForm).
@planned @ST-001 @code-baseline
Feature: ST-001 캡틴은 스터디를 등록할 수 있다.

  Background:
    Given 캡틴으로 인증되어 있고 해당 PRD의 대상 화면에 접근할 수 있다
    And 시각과 API 응답은 시나리오 조건에 맞는 테스트 데이터로 고정되어 있다

  @BO-ST-001-S01 @AC-1 @AC-2 @AC-6 @AC-7
  Scenario: BO-ST-001-S01 새 프로그램의 첫 기수 등록
    When 목록에서 등록 창을 열고 새 프로그램과 종류를 선택한다
    Then 스터디 목록에서 등록 창 열기
    And 새 프로그램 등록 — 프로그램과 첫 기수 동시 생성, 종류(스터디·클럽) 지정
    And 상세 설명 기본 템플릿 (목표 / 진행 방식 / 참가 대상 / 특이사항)
    And 정원 기본 제한 없음, 풀면 1 이상 정수

  @BO-ST-001-S02 @AC-3
  Scenario: BO-ST-001-S02 기존 클럽의 기수 자동 채움
    When 기존 클럽을 선택한다
    Then 기존 클럽의 새 기수 등록 — 제목·소개·설명·카테고리·시간대·채널·드라이브 주소 최신 기수 값 자동 채움

  @BO-ST-001-S03 @AC-4 @AC-5
  Scenario: BO-ST-001-S03 입력 검증과 경고
    When 필수값 누락과 길이 경계값을 각각 입력하고 등록한다
    Then 필수 네 항목(제목·한 줄 소개·카테고리·모집 마감일) 검증, 칸별 오류 안내
    # PRD AC-5의 권장 길이는 현재 프론트 코드 값으로 구체화한다. 서버 수락 여부를 뜻하지 않는다.
    And 제목 24자·한 줄 소개 25자를 초과하면 권장 길이 표시가 경고색이 되지만 그 이유만으로 제출을 막지 않는다
    And 제목의 앞뒤 공백을 제거한 JavaScript length가 60이면 길이 검증을 통과하고 61이면 "60자 이내로 입력하세요."로 제출을 막는다

  @BO-ST-001-S04 @AC-8 @AC-9
  Scenario: BO-ST-001-S04 미공개 생성과 중복 제출 방지
    When 유효한 값으로 등록하고 응답 대기 중 다시 제출한다
    Then 등록 결과는 항상 미공개
    And 처리 중 중복 제출 차단

# 실행 카탈로그(표시 상태 일부): study-list--create
  @BO-ST-001-V01 @catalog-partial
  Scenario: BO-ST-001-V01 기본
    Given 대상 화면이 PRD의 "기본" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 새 프로그램 · 스터디 · 정원 제한 없음 · 설명 템플릿 / —

# 실행 카탈로그(표시 상태 일부): study-list--create-invalid
  @BO-ST-001-V02 @catalog-partial
  Scenario: BO-ST-001-V02 검증 실패
    Given 대상 화면이 PRD의 "검증 실패" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 칸별 오류 / `60자 이내로 입력하세요.` · `모집 마감일을 입력하세요.` · `기수를 추가할 프로그램을 고르세요.` · `http(s):// 로 시작하는 주소를 입력하세요.` · `1 이상의 정수로 입력하세요. …`

  @BO-ST-001-V03
  Scenario: BO-ST-001-V03 처리중
    Given 대상 화면이 PRD의 "처리중" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 등록 잠김 / —

  @BO-ST-001-V04
  Scenario: BO-ST-001-V04 완료
    Given 대상 화면이 PRD의 "완료" 상태가 되도록 데이터와 응답을 준비한다
    When 해당 화면을 열거나 그 상태를 만드는 사용자 동작을 수행한다
    Then 완료 화면 / —

