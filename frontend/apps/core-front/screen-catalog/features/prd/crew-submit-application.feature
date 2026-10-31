# PRD: 01-planning/stories/crew-submit-application/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: PRD의 스터디 없음 카피와 현재 상세 문구가 다르다. 연동 팝업은 환경의 OAuth 준비 상태에도 영향받는다. 기본 폼·연동 게이트 캡처는 실제 OAuth 성공이나 신청 저장을 증명하지 않는다.
@planned @ST-008
Feature: ST-008 크루는 스터디 신청 폼을 제출할 수 있다.

  @CORE-ST-008-S01 @catalog-partial
  Scenario: CORE-ST-008-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 모집중 상세에서 신청하기를 누르고 목록의 컨트롤과 비교한다
    Then 모집중 스터디 상세에서 신청 폼 열기 — 목록에는 신청하기 없음
    # 부분 실행 근거: study-detail--application-form

  @CORE-ST-008-S02
  Scenario: CORE-ST-008-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 비로그인으로 신청하기를 누른 뒤 로그인한다
    Then 미로그인 시 로그인 화면으로, 로그인 후 신청 흐름 이어가기

  @CORE-ST-008-S03 @catalog-partial
  Scenario: CORE-ST-008-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 미연동 회원으로 신청하고 로그인·가입·연결 성공·건너뛰기 경로를 각각 진행한다
    Then 디스코드 미연동 시 연동 후에만 폼 열림
    And 로그인·온보딩을 거쳐도 선택한 스터디 유지
    And 가입 후 지금 연결 성공 시 선택했던 신청 폼으로 바로 복귀
    And 나중에 하기는 해당 상세로 복귀, 다시 신청하기를 누를 때 연결 안내
    # 부분 실행 근거: study-detail--discord-gate

  @CORE-ST-008-S04
  Scenario: CORE-ST-008-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 별명·요일·추가 질문·참여 확인을 각각 누락한 채 신청한다
    Then 별명·참여 가능 요일·필수 추가 질문·일정 참여 확인 검증

  @CORE-ST-008-S05
  Scenario: CORE-ST-008-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 여러 필수 항목을 누락하고 제출한다
    Then 미충족 항목으로 화면 이동 및 칸별 실패 문구

  @CORE-ST-008-S06
  Scenario: CORE-ST-008-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 신청을 완료하고 상세를 다시 열어 재제출을 시도한다
    Then 제출 후 「신청 완료」 표기 — 재제출·수정 불가

  @CORE-ST-008-S07
  Scenario: CORE-ST-008-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 신청 완료 창에서 상세 머무르기와 내 스터디 이동을 각각 선택한다
    Then 완료 후 상세 머무르기 또는 내 스터디 해당 탭 열기

  @CORE-ST-008-S08
  Scenario: CORE-ST-008-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 모집 마감과 정원 마감 상세에서 신청 진입을 시도한다
    Then 모집 마감·정원 마감 시 폼 열리지 않음

  @CORE-ST-008-S09
  Scenario: CORE-ST-008-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 제출과 연동의 실패·처리중 응답을 재현하고 재시도·닫기를 누른다
    Then 제출·연동 실패 시 같은 화면에서 재시도. 처리 중 창 닫기 차단

  @CORE-ST-008-S10
  Scenario: CORE-ST-008-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 스터디를 만든 캡틴으로 같은 신청 폼을 제출한다
    Then 스터디를 생성한 캡틴도 신청 폼을 제출하면 그 스터디에 참여 — 크루와 같은 흐름·검증

  @CORE-ST-008-V01
  Scenario: CORE-ST-008-V01 미로그인 CTA
    Given 대상 화면이 PRD의 「미로그인 CTA」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 / `신청하기`. 누르면 로그인. `next` = 이 신청 흐름

  @CORE-ST-008-V02
  Scenario: CORE-ST-008-V02 모집중 CTA
    Given 대상 화면이 PRD의 「모집중 CTA」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 / `신청하기`

  @CORE-ST-008-V03 @catalog-partial
  Scenario: CORE-ST-008-V03 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 폼 / 제목 `스터디 신청`. 제출 버튼 `신청`
    # 부분 실행 근거: study-detail--application-form

  @CORE-ST-008-V04
  Scenario: CORE-ST-008-V04 폼 로딩
    Given 대상 화면이 PRD의 「폼 로딩」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 폼 / `불러오는 중`. 신청 불가

  @CORE-ST-008-V05
  Scenario: CORE-ST-008-V05 폼 조회 실패
    Given 대상 화면이 PRD의 「폼 조회 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 폼 / `신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.` `다시 시도`. 신청 불가

  @CORE-ST-008-V06
  Scenario: CORE-ST-008-V06 추가 질문 없음
    Given 대상 화면이 PRD의 「추가 질문 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 폼 / 기본 문항만. 빈 안내 없음

  @CORE-ST-008-V07
  Scenario: CORE-ST-008-V07 연동 확인중
    Given 대상 화면이 PRD의 「연동 확인중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 CTA / `신청하기`. 스피너. 다시 누르지 못함. 8초 넘으면 폼을 연다(제출이 403 이면 연동 팝업)

  @CORE-ST-008-V08 @catalog-partial
  Scenario: CORE-ST-008-V08 연동 없음
    Given 대상 화면이 PRD의 「연동 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연동 팝업 / `스터디 신청 전 디스코드 연동은 필수입니다.`
    # 부분 실행 근거: study-detail--discord-gate

  @CORE-ST-008-V09
  Scenario: CORE-ST-008-V09 연동 준비 중
    Given 대상 화면이 PRD의 「연동 준비 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연동 팝업 / `디스코드 연동은 준비 중입니다. 운영진에게 문의해 주세요.` `닫기`만. OAuth 팝업·서버 시크릿 전

  @CORE-ST-008-V10
  Scenario: CORE-ST-008-V10 연동 처리중
    Given 대상 화면이 PRD의 「연동 처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연동 팝업 / `디스코드 연동하기`. 중복 연결 요청 방지. 취소로 연결 시뮬레이션 중단

  @CORE-ST-008-V11
  Scenario: CORE-ST-008-V11 연동 실패
    Given 대상 화면이 PRD의 「연동 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연동 팝업 / `디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.` 다른 계정에 이미 연동(409)이면 `이 디스코드 계정은 다른 StudyClub 계정에 이미 연동되어 있습니다.` 로그인 만료(401)면 로그인으로

  @CORE-ST-008-V12
  Scenario: CORE-ST-008-V12 서버 미가입
    Given 대상 화면이 PRD의 「서버 미가입」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연동 팝업 / `스터디클럽 디스코드 서버에 아직 가입하지 않았습니다. 서버에 가입한 뒤 다시 연동해 주세요.` `디스코드 서버 가입하기`(초대 링크, 새 탭). 연동 팝업에 잔류 (403 `DISCORD_NOT_IN_GUILD`)

  @CORE-ST-008-V13
  Scenario: CORE-ST-008-V13 검증 실패
    Given 대상 화면이 PRD의 「검증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 해당 항목 / §3 표의 실패 카피

  @CORE-ST-008-V14
  Scenario: CORE-ST-008-V14 처리중
    Given 대상 화면이 PRD의 「처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 버튼 / `신청`. 중복 제출 및 닫기 차단

  @CORE-ST-008-V15
  Scenario: CORE-ST-008-V15 제출 실패
    Given 대상 화면이 PRD의 「제출 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 신청 폼 / `신청하지 못했습니다. 다시 시도해 주세요.` `다시 시도`

  @CORE-ST-008-V16
  Scenario: CORE-ST-008-V16 완료
    Given 대상 화면이 PRD의 「완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 완료 팝업 / `스터디 신청이 완료되었습니다. 내 스터디로 이동할까요?`

  @CORE-ST-008-V17
  Scenario: CORE-ST-008-V17 이미 신청
    Given 대상 화면이 PRD의 「이미 신청」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 CTA / `신청 완료`. 폼 없음. 수정·삭제 없음

  @CORE-ST-008-V18
  Scenario: CORE-ST-008-V18 모집 마감
    Given 대상 화면이 PRD의 「모집 마감」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 CTA / `모집 마감`. 폼 없음

  @CORE-ST-008-V19
  Scenario: CORE-ST-008-V19 정원 마감
    Given 대상 화면이 PRD의 「정원 마감」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 CTA / `정원 마감`. 폼 없음

  @CORE-ST-008-V20 @catalog-partial @code-baseline
  Scenario: CORE-ST-008-V20 스터디 없음
    Given 대상 화면이 PRD의 「스터디 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 상세 / `이 스터디를 찾을 수 없습니다.` 폼 없음
    # 부분 실행 근거: study-detail--not-found

