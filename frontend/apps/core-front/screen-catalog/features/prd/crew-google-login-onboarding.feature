# PRD: 01-planning/stories/crew-google-login-onboarding/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: PRD 기준 1은 Google만 명시하지만 현재 로그인 화면에는 Apple도 있다. 기준 11의 나중에 하기 버튼은 현재 「스터디 신청할 때 하기」다. 현재 코드 캡처를 유지하며 OAuth 성공·복귀 검증과 구분한다.
@planned @ST-005
Feature: ST-005 크루는 Google 계정으로 로그인하고 온보딩을 마칠 수 있다.

  @CORE-ST-005-S01 @catalog-partial @code-baseline
  Scenario: CORE-ST-005-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 로그인 화면에서 제공하는 인증 수단을 확인한다
    Then Google 계정 로그인 — 다른 인증 수단 없음
    # 부분 실행 근거: login--default

  @CORE-ST-005-S02
  Scenario: CORE-ST-005-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 온보딩 완료 회원으로 next가 있는 경우와 없는 경우에 로그인한다
    Then 온보딩 완료 회원은 원래 보던 화면(없으면 홈)으로

  @CORE-ST-005-S03
  Scenario: CORE-ST-005-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 신규 회원과 온보딩 미완료 회원으로 로그인한다
    Then 신규·온보딩 미완료 회원은 온보딩 화면으로

  @CORE-ST-005-S04
  Scenario: CORE-ST-005-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 인증 팝업을 취소하거나 실패 응답을 받는다
    Then 인증 취소·실패 시 사유 안내 및 재시도

  @CORE-ST-005-S05 @catalog-partial
  Scenario: CORE-ST-005-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 신규 회원으로 온보딩에 진입하고 제안 닉네임을 수정한다
    Then 닉네임 제안값(Google 이름) 자동 채움 및 수정
    # 부분 실행 근거: onboarding--default

  @CORE-ST-005-S06
  Scenario: CORE-ST-005-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 형식 오류·중복·사용 가능한 닉네임을 차례로 입력한다
    Then 닉네임 형식·중복 검사 — 제출 전 결과 표시

  @CORE-ST-005-S07 @catalog-partial
  Scenario: CORE-ST-005-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 서로 다른 기기 시간대에서 온보딩을 열고 시간대를 선택한다
    Then 시간대 선택 3종 — 기기 시간대 기본 선택
    # 부분 실행 근거: onboarding--default

  @CORE-ST-005-S08 @catalog-partial
  Scenario: CORE-ST-005-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 필수 동의를 하나씩 누락하고 선택 동의 여부를 바꿔 제출한다
    Then 필수 동의 3종 검증, 마케팅 수신은 선택
    # 부분 실행 근거: onboarding--default

  @CORE-ST-005-S09
  Scenario: CORE-ST-005-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 약관과 방침 전문을 열어 읽고 해당 화면에서 동의한다
    Then 약관·방침 전문 열람 및 그 자리에서 동의

  @CORE-ST-005-S10
  Scenario: CORE-ST-005-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 입력 후 서버 오류와 세션 만료 응답으로 가입을 제출한다
    Then 서버 오류·세션 만료 시 입력값 유지

  @CORE-ST-005-S11 @catalog-partial @code-baseline
  Scenario: CORE-ST-005-S11 완료 기준 11
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 가입을 완료하고 디스코드 연결 선택 화면을 확인한다
    Then 가입 완료 후 「지금 연결 / 나중에 하기」 선택
    # 부분 실행 근거: onboarding--discord

  @CORE-ST-005-S12
  Scenario: CORE-ST-005-S12 완료 기준 12
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 가입 후 연결 실패·인증 취소·건너뛰기를 각각 수행한다
    Then 연결 실패·취소·건너뛰기 시 가입 완료 상태 유지

  @CORE-ST-005-S13
  Scenario: CORE-ST-005-S13 완료 기준 13
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 특정 스터디 신청에서 로그인·온보딩·디스코드 연결을 완료한다
    Then 스터디 신청에서 진입 후 연결 성공 시 선택했던 신청 폼 복귀

  @CORE-ST-005-S14
  Scenario: CORE-ST-005-S14 완료 기준 14
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 특정 스터디 신청에서 가입 후 연결을 건너뛰고 다시 신청하기를 누른다
    Then 나중에 하기 선택 시 해당 스터디 상세 복귀, 다음 신청 시 연결 안내

  @CORE-ST-005-V01 @catalog-partial @code-baseline
  Scenario: CORE-ST-005-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 로그인 버튼 / —
    # 부분 실행 근거: login--default

  @CORE-ST-005-V02
  Scenario: CORE-ST-005-V02 처리중
    Given 대상 화면이 PRD의 「처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 로그인 버튼 잠김 / —

  @CORE-ST-005-V03
  Scenario: CORE-ST-005-V03 인증 실패
    Given 대상 화면이 PRD의 「인증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 오류 안내 + 로그인 버튼 / 오류 이유와 다시 시도 안내

  @CORE-ST-005-V04 @catalog-partial
  Scenario: CORE-ST-005-V04 온보딩 기본
    Given 대상 화면이 PRD의 「온보딩 기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 제안 닉네임 · 기기 시간대 · 동의 모두 해제 / —
    # 부분 실행 근거: onboarding--default

  @CORE-ST-005-V05
  Scenario: CORE-ST-005-V05 검증 실패
    Given 대상 화면이 PRD의 「검증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 닉네임 상태 줄 / 형식 오류 · 중복 문구

  @CORE-ST-005-V06
  Scenario: CORE-ST-005-V06 제출 중
    Given 대상 화면이 PRD의 「제출 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 가입 완료 잠김 / —

  @CORE-ST-005-V07
  Scenario: CORE-ST-005-V07 처리 실패
    Given 대상 화면이 PRD의 「처리 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 오류 안내, 입력 유지 / 다시 시도

  @CORE-ST-005-V08
  Scenario: CORE-ST-005-V08 세션 만료
    Given 대상 화면이 PRD의 「세션 만료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 오류 안내, 입력 유지 / 다시 로그인

  @CORE-ST-005-V09 @catalog-partial @code-baseline
  Scenario: CORE-ST-005-V09 가입 완료
    Given 대상 화면이 PRD의 「가입 완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 디스코드 연결 선택 / `스터디는 디스코드에서 진행돼요. 지금 연결할까요?`
    # 부분 실행 근거: onboarding--discord

  @CORE-ST-005-V10
  Scenario: CORE-ST-005-V10 연결 실패·취소
    Given 대상 화면이 PRD의 「연결 실패·취소」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 안내 유지, 재시도·나중에 하기 가능 / `디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.` / `디스코드 연결을 취소했어요. 다시 연결할 수 있어요.`

  @CORE-ST-005-V11
  Scenario: CORE-ST-005-V11 연결 완료
    Given 대상 화면이 PRD의 「연결 완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 원래 화면 또는 선택한 스터디 신청 폼 / —

