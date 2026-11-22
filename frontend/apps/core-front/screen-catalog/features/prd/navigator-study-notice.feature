# PRD: 01-planning/stories/navigator-study-notice/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: 현재 연결 근거는 캡틴의 공지 작성 화면이다. 네비게이터 권한, 실제 메일·Discord 발송, 제한 횟수·시간은 검증하지 않았다. PRD에 별도 상태별 화면 절이 없어 V 시나리오를 만들지 않는다.
@planned @ST-016
Feature: ST-016 네비게이터는 스터디별 공지를 등록할 수 있다.

  @CORE-ST-016-S01 @catalog-partial
  Scenario: CORE-ST-016-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 담당 캡틴·반 네비게이터·크루로 스터디 탭을 연다
    Then 캡틴·네비게이터에게만 「공지」 탭이 보인다 (반 네비게이터 · 그 스터디를 만든 캡틴)
    # 부분 실행 근거: my-joined-notice--captain

  @CORE-ST-016-S02 @catalog-partial
  Scenario: CORE-ST-016-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 제목 60/61자와 본문 1500/1501자를 입력하고 발송을 시도한다
    Then 제목(60자)·본문(1,500자)을 쓰고 글자 수가 보이며, 넘치면 말없이 자르지 않고 보내기를 막는다
    # 부분 실행 근거: my-joined-notice--captain

  @CORE-ST-016-S03
  Scenario: CORE-ST-016-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 채널을 모두 해제하거나 메일·디스코드를 선택하고 연동 불가 조건을 재현한다
    Then 메일·디스코드 중 하나 이상을 고르고, 디스코드를 못 쓰는 이유는 보내기 전에 보인다

  @CORE-ST-016-S04 @catalog-partial
  Scenario: CORE-ST-016-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여중·쉬는중 수신자를 선택하고 상태 필터와 전체 선택을 바꾼다
    Then 받는 사람은 이 반의 참여 중·쉬는 중 멤버이고, 상태로 거른 목록에서 고르고 전체 선택할 수 있다. 거르기는 이미 고른 사람을 지우지 않는다
    # 부분 실행 근거: my-joined-notice--captain

  @CORE-ST-016-S05
  Scenario: CORE-ST-016-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 수신자와 채널을 선택한 뒤 보내기를 누른다
    Then 보내기 전에 받는 사람 수·채널을 적은 확인 창으로 한 번 더 묻는다

  @CORE-ST-016-S06
  Scenario: CORE-ST-016-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 같은 반에서 1분 이내 재발송과 하루 31번째 발송을 시도한다
    Then 같은 반에서 1분 안 재발송과 하루 30회를 넘는 발송은 막고, 사유와 다시 보낼 수 있는 시각을 보여 준다

  @CORE-ST-016-S07 @catalog-partial
  Scenario: CORE-ST-016-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 성공·대기·실패·건너뜀 결과가 섞인 발송 기록을 연다
    Then 보낸 공지 기록에 제목·본문·보낸 사람·시각·받은 사람 수와 채널별 결과(메일 대기·완료·실패, 디스코드 완료·건너뜀·실패)가 보인다
    # 부분 실행 근거: my-joined-notice--captain

  @CORE-ST-016-S08
  Scenario: CORE-ST-016-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 디스코드 미연동자를 포함해 메일·디스코드로 발송한다
    Then 디스코드를 연동하지 않은 사람은 목록에서 알아볼 수 있고, 멘션에서 빠져도 메일은 간다

