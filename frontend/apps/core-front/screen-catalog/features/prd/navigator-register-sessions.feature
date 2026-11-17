# PRD: 01-planning/stories/navigator-register-sessions/PRD.md
# 대응표: docs/frontend-development-guide/core-e2e-prd-map.md
# 예정 명세. .meta.ts의 prdScenarios는 부분 화면 근거이며 전체 행동을 증명하지 않는다.
@planned @ST-015
Feature: ST-015 네비게이터는 스터디 회차를 등록할 수 있다.

  @CORE-ST-015-S01
  Scenario: CORE-ST-015-S01 완료 기준 1
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 스터디 카드·주간 칸에서 일정으로 이동하고 참여 중단 카드도 누른다
    Then 내 스터디 카드·주간 칸에서 일정 탭 진입 — 참여 중단 스터디는 진입 불가

  @CORE-ST-015-S02
  Scenario: CORE-ST-015-S02 완료 기준 2
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 미참여 스터디의 일정 주소에 접근한다
    Then 미참여 스터디 주소 진입 시 안내만 표시

  @CORE-ST-015-S03 @catalog-partial
  Scenario: CORE-ST-015-S03 완료 기준 3
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 내 분반 일정을 열고 표시 시간대를 전환한다
    Then 내 분반 회차 일정순 조회 — 분반 시간대 기본, KST·PDT 탭 전환
    # 부분 실행 근거: my-joined-schedule--navigator

  @CORE-ST-015-S04 @catalog-partial
  Scenario: CORE-ST-015-S04 완료 기준 4
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 회차 추가에서 단건·매일·매주 반복을 선택하고 미리보기 후 생성한다
    Then 회차 추가 — 단건 또는 매일·매주 반복. 생성 결과 미리보기(날짜·건너뛰는 날·번호 밀림)
    # 부분 실행 근거: my-joined-schedule--create

  @CORE-ST-015-S05
  Scenario: CORE-ST-015-S05 완료 기준 5
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 예정 회차 여러 줄의 일자·시각·제목·발표자를 바꾸고 저장한다
    Then 예정 회차 표에서 일자·시각·제목·발표자 수정, 여러 줄 일괄 저장

  @CORE-ST-015-S06
  Scenario: CORE-ST-015-S06 완료 기준 6
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 예정 회차를 여러 개 선택하고 삭제 확인 창에서 확정한다
    Then 예정 회차를 체크박스로 골라 일괄 삭제 — 확인 모달을 거친다. 「이후 반복 모두」 삭제 없음

  @CORE-ST-015-S07
  Scenario: CORE-ST-015-S07 완료 기준 7
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 크루로 일정 편집과 빈 발표자 신청·취소를 시도한다
    Then 크루는 조회만. 예정 회차의 빈 발표자 칸만 선착순 등록·취소 (한 회차 한 칸)

  @CORE-ST-015-S08
  Scenario: CORE-ST-015-S08 완료 기준 8
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 킥오프의 수정·삭제·발표자 컨트롤과 출석률 포함 여부를 확인한다
    Then 분반마다 킥오프(0회차) 한 건 — 삭제 불가, 발표자 없음, 출석률 제외. **캡틴이 백오피스에서 정하고, 이 화면에서는 고치지 않는다**

  @CORE-ST-015-S09
  Scenario: CORE-ST-015-S09 완료 기준 9
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 출석 탭에서 출석·발표 표시·횟수를 확인한다
    Then 출석부에서 출석·발표를 한 격자로 조회 — 발표 횟수 열

  @CORE-ST-015-S10
  Scenario: CORE-ST-015-S10 완료 기준 10
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 캡틴·네비게이터로 규칙을 수정하고 크루로 조회한다
    Then 스터디 규칙 수정 (캡틴·네비게이터) 및 전원 열람

  @CORE-ST-015-S11
  Scenario: CORE-ST-015-S11 완료 기준 11
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 이미 시작한 회차의 수정·삭제를 시도한다
    Then 시작한 회차는 수정·삭제 불가

  @CORE-ST-015-S12
  Scenario: CORE-ST-015-S12 완료 기준 12
    Given PRD의 권한·데이터·응답 조건과 해당 완료 기준의 경계 조건이 준비되어 있다
    When 일정 저장 후 주간 일정·다가오는 회차·출석 탭을 다시 조회한다
    Then 저장 직후 주간 일정·다가오는 회차·출석 칸·출석부 반영

  @CORE-ST-015-V01 @catalog-partial
  Scenario: CORE-ST-015-V01 기본 (캡틴·네비게이터)
    Given 대상 화면이 PRD의 「기본 (캡틴·네비게이터)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 정보·규칙 · 회차 개수 · 시간대 탭 · 회차 추가 · 고칠 수 있는 표 / `일정 · 전체 n · 예정 n`
    # 부분 실행 근거: my-joined-schedule--navigator, my-joined-schedule--captain

  @CORE-ST-015-V02 @catalog-partial
  Scenario: CORE-ST-015-V02 기본 (크루)
    Given 대상 화면이 PRD의 「기본 (크루)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 정보·규칙 · 회차 개수 · 시간대 탭 · 글자 표 · 신청 / `신청`
    # 부분 실행 근거: my-joined-schedule--crew

  @CORE-ST-015-V03
  Scenario: CORE-ST-015-V03 볼 수 없음
    Given 대상 화면이 PRD의 「볼 수 없음」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 안내만 / `이 스터디의 일정을 볼 수 없습니다`

  @CORE-ST-015-V04
  Scenario: CORE-ST-015-V04 고치는 중
    Given 대상 화면이 PRD의 「고치는 중」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 일정: 고친 줄 색 · 작업 바 「저장」 활성 / 출석: 고친 칸 상태 색 테두리 · 「저장」 활성 / `변경 취소` · `저장`

  @CORE-ST-015-V05
  Scenario: CORE-ST-015-V05 검증 실패
    Given 대상 화면이 PRD의 「검증 실패」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 막힌 칸 아래 이유 · 저장 비활성 / `발표자1과 다른 사람을 골라 주세요.` 등

  @CORE-ST-015-V06
  Scenario: CORE-ST-015-V06 삭제 확인
    Given 대상 화면이 PRD의 「삭제 확인」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 확인 모달 (기본 포커스 「취소」) / `N회차(9/23(수))를 지울까요?` · `회차 n개(3회차, 4회차…)를 지울까요?`

  @CORE-ST-015-V07
  Scenario: CORE-ST-015-V07 신청 밀림
    Given 대상 화면이 PRD의 「신청 밀림」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 표 위 경고 한 줄 / `방금 다른 크루가 N회차 발표자1로 신청했습니다.`

  @CORE-ST-015-V08
  Scenario: CORE-ST-015-V08 회차 없음 (일정)
    Given 대상 화면이 PRD의 「회차 없음 (일정)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 표 대신 안내 / `아직 회차가 없습니다.` (캡틴·네비게이터는 「회차 추가」로 만들라는 말을 덧붙인다)

  @CORE-ST-015-V09
  Scenario: CORE-ST-015-V09 회차 없음 (출석)
    Given 대상 화면이 PRD의 「회차 없음 (출석)」 상태가 되도록 데이터·권한·응답을 준비한다
    When 대상 화면에 진입하거나 해당 상태로 전환하는 동작을 수행한다
    Then 격자 대신 안내 / `아직 회차가 없습니다.` (13-1)

