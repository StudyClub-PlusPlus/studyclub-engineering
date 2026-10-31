# PRD: 01-planning/stories/navigator-edit-attendance/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-017
Feature: ST-017 네비게이터는 스터디별 출석 상태를 수정할 수 있다.

  @CORE-ST-017-S01 @catalog-partial
  Scenario: CORE-ST-017-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 담당 분반의 출석 탭을 연다
    Then 내 분반 참여자 × 회차 출석 격자 조회
    # 부분 실행 근거: my-joined-attendance--navigator

  @CORE-ST-017-S02
  Scenario: CORE-ST-017-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 출석 칸을 눌러 다섯 상태를 전환한다
    Then 칸 클릭으로 출석·지각·결석·휴가·미체크 전환

  @CORE-ST-017-S03
  Scenario: CORE-ST-017-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 여러 출석 칸을 바꾸고 저장 전 표시를 확인한 뒤 저장한다
    Then 저장으로 일괄 반영. 저장 전 변경 칸만 그 상태 색 테두리로 구분 (평소에는 테두리 없음)

  @CORE-ST-017-S04
  Scenario: CORE-ST-017-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 여러 칸을 수정하고 변경 취소를 누른다
    Then 저장 전 변경 일괄 되돌리기

  @CORE-ST-017-S05
  Scenario: CORE-ST-017-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 출석을 수정한 뒤 다른 탭이나 화면으로 이동한다
    Then 미저장 상태로 이탈 시 재확인

  @CORE-ST-017-S06
  Scenario: CORE-ST-017-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 킥오프와 정규 회차의 출석을 바꿔 출석률을 비교한다
    Then 참여자별 출석률 실시간 재계산. 킥오프 제외

  @CORE-ST-017-S07 @catalog-partial
  Scenario: CORE-ST-017-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 담당 분반을 확인하고 캡틴의 백오피스 출석부 링크를 누른다
    Then 내 분반 참여자만 표시. 캡틴은 정보 카드의 「백오피스 출석부」로 이동
    # 부분 실행 근거: my-joined-attendance--captain

  @CORE-ST-017-S08
  Scenario: CORE-ST-017-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회차 없는 출석부에서 일정으로 이동한다
    Then 회차 없을 때 안내와 일정으로 가는 경로

  @CORE-ST-017-S09
  Scenario: CORE-ST-017-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 네비게이터·담당 캡틴·다른 회원으로 출석부를 연다
    Then 수정 권한: 네비게이터와 담당 캡틴. 그 외에는 조회 화면

  @CORE-ST-017-S10
  Scenario: CORE-ST-017-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여자를 선택하고 제목 인원과 작업 바 선택 인원을 비교한다
    Then 표 제목 「출석」 옆에는 전체 인원 N 만. 고른 인원은 작업 바의 「n명 선택」

  @CORE-ST-017-S11
  Scenario: CORE-ST-017-S11 완료 기준 11
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When KST·PDT 표시를 전환한다
    Then KST · PDT 탭으로 회차 머리의 일자를 바꿔 본다. 칸 값은 바뀌지 않는다

  @CORE-ST-017-S12
  Scenario: CORE-ST-017-S12 완료 기준 12
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 좁은 화면에서 회차 열을 가로로 스크롤한다
    Then 닉네임 · 디스코드 닉네임 · 발표 횟수(왼쪽)와 출석률(오른쪽)은 고정, 회차 열만 가로 스크롤

  @CORE-ST-017-S13 @catalog-partial
  Scenario: CORE-ST-017-S13 완료 기준 13
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 출석 제목 옆 발표 표시 설명을 누른다
    Then 제목 옆 「?」 로 발표(마이크) 표시 설명을 연다
    # 부분 실행 근거: my-joined-attendance--presenter-help

  @CORE-ST-017-V01 @catalog-partial
  Scenario: CORE-ST-017-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 출석부 (캡틴은 백오피스 출석부 버튼) / —
    # 부분 실행 근거: my-joined-attendance--navigator, my-joined-attendance--captain

  @CORE-ST-017-V02
  Scenario: CORE-ST-017-V02 고치는 중
    Given 대상 화면이 PRD의 「고치는 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 바뀐 칸에 상태 색 테두리 · 작업 바 「저장」 활성 / `변경 취소` · `저장`

  @CORE-ST-017-V03
  Scenario: CORE-ST-017-V03 처리중
    Given 대상 화면이 PRD의 「처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 저장 · 변경 취소 · 칸 잠김 / —

  @CORE-ST-017-V04
  Scenario: CORE-ST-017-V04 완료
    Given 대상 화면이 PRD의 「완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 테두리 사라짐 · 「저장」 잠김 / - (스크린리더 `출석 n칸을 저장했습니다.`)

  @CORE-ST-017-V05
  Scenario: CORE-ST-017-V05 나가기 확인
    Given 대상 화면이 PRD의 「나가기 확인」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 확인 창 / `저장하지 않은 변경이 있습니다`

  @CORE-ST-017-V06
  Scenario: CORE-ST-017-V06 회차 없음
    Given 대상 화면이 PRD의 「회차 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 격자 대신 안내 / `아직 회차가 없습니다.`

  @CORE-ST-017-V07 @catalog-partial
  Scenario: CORE-ST-017-V07 고칠 수 없음
    Given 대상 화면이 PRD의 「고칠 수 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 보기 화면 (crew-view-attendance-record) / —
    # 부분 실행 근거: my-joined-attendance--crew

