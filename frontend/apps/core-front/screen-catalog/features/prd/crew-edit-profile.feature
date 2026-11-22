# PRD: 01-planning/stories/crew-edit-profile/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
# 현재 코드 기준: 기본·편집 화면만 캡처한다. 저장/취소의 데이터 보존, 중복 검사, Discord 해제 제한과 재시도는 행동 E2E가 필요하다.
@planned @ST-012
Feature: ST-012 크루는 프로필을 수정할 수 있다.

  @CORE-ST-012-S01 @catalog-partial
  Scenario: CORE-ST-012-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 마이페이지 내 정보를 연다
    Then 마이페이지에서 닉네임·이메일·시간대·디스코드 연결 상태·마케팅 수신 조회
    # 부분 실행 근거: my--default

  @CORE-ST-012-S02 @catalog-partial
  Scenario: CORE-ST-012-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 닉네임·시간대를 수정해 저장하고 마케팅 수신은 별도로 바꾼다
    Then 내 정보 수정에서 닉네임·시간대를 함께 편집하고 저장 — 마케팅 수신은 별도로 즉시 반영
    # 부분 실행 근거: my--editing

  @CORE-ST-012-S03
  Scenario: CORE-ST-012-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 가입과 동일한 오류·중복·본인 현재 닉네임을 입력한다
    Then 닉네임은 가입과 같은 규칙으로 검사 — 자기 현재 닉네임은 중복 아님

  @CORE-ST-012-S04
  Scenario: CORE-ST-012-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 잘못된 닉네임과 확인 중 응답에서 저장을 시도한다
    Then 쓸 수 없는 값이거나 확인 중이면 닉네임 저장 차단

  @CORE-ST-012-S05
  Scenario: CORE-ST-012-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 닉네임·시간대를 바꿔 저장한다
    Then 저장 시 즉시 반영 및 저장 표시

  @CORE-ST-012-S06
  Scenario: CORE-ST-012-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 닉네임·시간대를 바꾼 뒤 취소한다
    Then 취소 시 닉네임·시간대 수정값을 모두 폐기

  @CORE-ST-012-S07
  Scenario: CORE-ST-012-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 미연결 회원으로 연결하고 계정 이름과 해제 버튼을 확인한다
    Then 미연결 시 연결하기, 연결 후 계정 이름 및 연결 해제 표시

  @CORE-ST-012-S08
  Scenario: CORE-ST-012-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 참여 중 스터디가 있는 회원으로 연결 해제를 요청한다
    Then 참여 중 스터디가 하나 이상이면 해제 차단 및 연결 유지

  @CORE-ST-012-S09
  Scenario: CORE-ST-012-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 해제 차단 안내에서 내 스터디를 열고 모든 참여 중단 후 해제를 다시 요청한다
    Then 모든 스터디 참여 중단 후 재시도 안내와 내 스터디룸 이동

  @CORE-ST-012-S10
  Scenario: CORE-ST-012-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 디스코드 연결 실패·인증 취소 후 다시 연결한다
    Then 연결 실패·인증 취소 시 미연결 유지 및 재시도

  @CORE-ST-012-S11 @catalog-partial
  Scenario: CORE-ST-012-S11 완료 기준 11
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 정보 편집 상태에서 이메일의 편집 가능 여부를 확인한다
    Then 이메일 수정 불가
    # 부분 실행 근거: my--default

  @CORE-ST-012-S12
  Scenario: CORE-ST-012-S12 완료 기준 12
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 정보 아래 회원 탈퇴 링크를 누른다
    Then 회원 탈퇴 지면으로 이동

  @CORE-ST-012-V01 @catalog-partial
  Scenario: CORE-ST-012-V01 기본
    Given 대상 화면이 PRD의 「기본」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 닉네임 · 이메일, 저장된 시간대 · 디스코드 · 마케팅 수신 줄 / —
    # 부분 실행 근거: my--default

  @CORE-ST-012-V02 @catalog-partial
  Scenario: CORE-ST-012-V02 내 정보 편집
    Given 대상 화면이 PRD의 「내 정보 편집」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 닉네임 입력칸 · 시간대 선택 · 취소 · 저장 / —
    # 부분 실행 근거: my--editing

  @CORE-ST-012-V03
  Scenario: CORE-ST-012-V03 검증 실패
    Given 대상 화면이 PRD의 「검증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 닉네임 상태 줄, 저장 불가 / 형식 오류 · 중복 문구

  @CORE-ST-012-V04
  Scenario: CORE-ST-012-V04 처리중
    Given 대상 화면이 PRD의 「처리중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 닉네임 확인 중, 저장 불가 / 확인 중

  @CORE-ST-012-V05
  Scenario: CORE-ST-012-V05 디스코드 미연결
    Given 대상 화면이 PRD의 「디스코드 미연결」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연결하기 / `연결 안 됨`

  @CORE-ST-012-V06
  Scenario: CORE-ST-012-V06 연결됨
    Given 대상 화면이 PRD의 「연결됨」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 계정 이름과 연결 해제 / `@jiwon_dev` (예시)

  @CORE-ST-012-V07
  Scenario: CORE-ST-012-V07 해제 차단
    Given 대상 화면이 PRD의 「해제 차단」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 연결 유지 · 내 스터디 확인하기 / `참여 중인 스터디가 있어 디스코드 연결을 해제할 수 없어요.`

  @CORE-ST-012-V08
  Scenario: CORE-ST-012-V08 연결 실패·취소
    Given 대상 화면이 PRD의 「연결 실패·취소」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 재시도 / 연결 결과별 오류 안내

  @CORE-ST-012-V09
  Scenario: CORE-ST-012-V09 마케팅 수신
    Given 대상 화면이 PRD의 「마케팅 수신」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 동의 여부를 체크 상태로. 누르면 바로 저장 / `스터디 소식과 행사 안내를 이메일로 받기`

  @CORE-ST-012-V10
  Scenario: CORE-ST-012-V10 완료
    Given 대상 화면이 PRD의 「완료」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 새 값 · 줄 끝 저장 표시 / `저장됨`

